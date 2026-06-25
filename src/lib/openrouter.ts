import OpenAI, { toFile } from "openai";
import { getBusinessProfile } from "./db";
import { buildBusinessAIContext, sanitizeForPrompt } from "./ai-context";
import { buildBehaviorRules } from "./ai-rules";
import { SYSTEM_PROMPT } from "./system-prompt";
import type { Message } from "./db";

// ---------------------------------------------------------------------------
// API key: soporta OPENAI_API_KEY (primaria) y OPENROUTER_API_KEY (alias).
// Si usás OpenRouter, apuntá OPENAI_BASE_URL a https://openrouter.ai/api/v1
// ---------------------------------------------------------------------------
const API_KEY =
  process.env.OPENAI_API_KEY?.trim() ||
  process.env.OPENROUTER_API_KEY?.trim() ||
  "";

// Base URL opcional: no la definas para OpenAI, seteala para OpenRouter u otros.
const BASE_URL = process.env.OPENAI_BASE_URL?.trim() || undefined;

const client = new OpenAI({
  apiKey: API_KEY,
  ...(BASE_URL && { baseURL: BASE_URL }),
  // Anti-cuelgue: sin timeout, una llamada colgada dejaba el buffer de la
  // conversación en "procesando" para siempre. 30s + 2 reintentos.
  timeout: 30_000,
  maxRetries: 2,
});

const transcriptionClient = process.env.OPENAI_API_KEY?.trim()
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY.trim(), timeout: 30_000, maxRetries: 2 })
  : null;

// Model base: soporta OPENAI_MODEL (primario) y OPENROUTER_MODEL (alias legacy).
const MODEL =
  process.env.OPENAI_MODEL?.trim() ||
  process.env.OPENROUTER_MODEL?.trim() ||
  "gpt-4o-mini";

// Modelo del paso de RESPUESTA al cliente (el que más impacta en precisión y en
// seguir reglas duras tipo "plan canje desde iPhone 13"). Se puede subir a un
// modelo más fuerte (gpt-4o / gpt-4.1) SÓLO acá, sin encarecer el análisis.
// Fallback seguro: usa el modelo base si no se configura (no cambia el costo
// hasta que definas AI_REPLY_MODEL en el entorno del worker).
const REPLY_MODEL = process.env.AI_REPLY_MODEL?.trim() || MODEL;

// Modelo del paso de ANÁLISIS interno (JSON de intención/acción). Conviene
// mantenerlo barato; por defecto sigue al modelo base.
const ANALYSIS_MODEL = process.env.AI_ANALYSIS_MODEL?.trim() || MODEL;

const AUDIO_TRANSCRIPTION_MODEL =
  process.env.AUDIO_TRANSCRIPTION_MODEL?.trim() ||
  "whisper-1";

export type ConversationActionEvent = "none" | "appointment_request" | "appointment_ready" | "human_handoff" | "hot_lead";

export interface ConversationAction {
  event: ConversationActionEvent;
  confidence: number;
  customer_reply: string | null;
  reason: string | null;
  summary: string | null;
  appointment: {
    customer_name: string | null;
    service: string | null;
    starts_at: string | null;
    notes: string | null;
    missing_fields: string[];
  } | null;
}

function extractJsonObject(input: string): Record<string, unknown> | null {
  const trimmed = input.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string").map((v) => v.trim()).filter(Boolean) : [];
}

function normalizeAction(raw: Record<string, unknown> | null): ConversationAction | null {
  if (!raw) return null;
  const event = raw.event;
  if (
    event !== "none" &&
    event !== "appointment_request" &&
    event !== "appointment_ready" &&
    event !== "human_handoff" &&
    event !== "hot_lead"
  ) {
    return null;
  }

  const appointmentRaw =
    raw.appointment && typeof raw.appointment === "object"
      ? (raw.appointment as Record<string, unknown>)
      : null;

  return {
    event,
    confidence:
      typeof raw.confidence === "number" && Number.isFinite(raw.confidence)
        ? Math.max(0, Math.min(1, raw.confidence))
        : 0,
    customer_reply: asString(raw.customer_reply),
    reason: asString(raw.reason),
    summary: asString(raw.summary),
    appointment: appointmentRaw
      ? {
          customer_name: asString(appointmentRaw.customer_name),
          service: asString(appointmentRaw.service),
          starts_at: asString(appointmentRaw.starts_at),
          notes: asString(appointmentRaw.notes),
          missing_fields: asStringArray(appointmentRaw.missing_fields),
        }
      : null,
  };
}

async function buildSystemPrompt(
  businessId: string,
  conversationSummary?: string | null,
  query?: string | null
): Promise<string> {
  const context = await buildBusinessAIContext(businessId, query);
  if (!context) return SYSTEM_PROMPT;

  console.log(
    `[ai-context/${businessId}] catalog=${context.stats.catalogItems} featured=${context.stats.featuredItems} promos=${context.stats.activePromotions} kb=${context.stats.hasKnowledgeBase ? "yes" : "no"} external=${context.stats.externalSources} chars=${context.stats.promptChars}`
  );

  const rules = buildBehaviorRules({
    hasCatalog: context.stats.catalogItems > 0,
    hasExternalSources: context.stats.externalSources > 0,
  });

  // Memoria: resumen de lo hablado hasta ahora (lo que ya quiso, datos dados,
  // objeciones). Ayuda en conversaciones largas sin reenviar todo el historial.
  const summary = conversationSummary?.trim()
    ? `\n\nRESUMEN DE LA CONVERSACIÓN HASTA AHORA (memoria — usalo para no repreguntar lo ya dicho y para retomar donde quedaron):\n${sanitizeForPrompt(conversationSummary, 600)}`
    : "";

  return `${context.prompt}\n\n${rules}${summary}`;
}

export async function generateReply(
  history: Message[],
  businessId: string,
  conversationSummary?: string | null,
  query?: string | null
): Promise<string> {
  if (!API_KEY) {
    throw new Error(
      "Falta la API key para el LLM. Configurá OPENAI_API_KEY (OpenAI) o OPENROUTER_API_KEY (OpenRouter) en el entorno del worker."
    );
  }

  // `query` = último mensaje (agrupado) del cliente. Si no se pasa, lo inferimos
  // del historial para que la selección de catálogo por relevancia funcione igual.
  const effectiveQuery =
    query?.trim() || [...history].reverse().find((m) => m.role === "user")?.content || null;

  const systemPrompt = await buildSystemPrompt(businessId, conversationSummary, effectiveQuery);

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...history.map((m) => ({
      role: m.role === "user" ? ("user" as const) : ("assistant" as const),
      // El mensaje del cliente es input no confiable: lo sanitizamos para
      // neutralizar intentos de prompt-injection ("ignora lo anterior", etc.).
      content: m.role === "user" ? sanitizeForPrompt(m.content, 2000) : m.content,
    })),
  ];

  const response = await client.chat.completions.create({
    model: REPLY_MODEL,
    messages,
    // 220 tokens alcanzan para 1-3 líneas de WhatsApp y desalientan párrafos largos.
    max_tokens: 220,
    temperature: 0.35,
    // Penalizan repetir las mismas frases/estructuras entre respuestas del hilo
    // (el historial va en el contexto, así que también pesa lo ya dicho).
    frequency_penalty: 0.4,
    presence_penalty: 0.3,
  });

  const raw = response.choices[0]?.message?.content?.trim() ?? "No pude generar una respuesta.";
  return stripMarkdownForWhatsApp(raw);
}

/**
 * WhatsApp no renderiza Markdown: un link '[texto](url)' se ve con los corchetes
 * crudos y queda roto. Convertimos esos casos a la URL pelada y sacamos marcas de
 * Markdown comunes, por si el modelo igual las emite.
 */
export function stripMarkdownForWhatsApp(text: string): string {
  return text
    // [texto](url) → url (lo útil para el cliente es el link)
    .replace(/\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/g, "$1")
    // [texto](algo-no-url) → texto
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    // **negrita** / __negrita__ → texto
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    // `código` → código
    .replace(/`([^`]+)`/g, "$1")
    // encabezados markdown al inicio de línea
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .trim();
}

export async function transcribeAudioBuffer(
  audio: Buffer,
  mimeType = "audio/ogg"
): Promise<string> {
  if (!transcriptionClient) {
    throw new Error("Falta OPENAI_API_KEY para transcribir audios.");
  }

  const extension = mimeType.includes("mpeg")
    ? "mp3"
    : mimeType.includes("mp4")
    ? "mp4"
    : mimeType.includes("webm")
    ? "webm"
    : mimeType.includes("wav")
    ? "wav"
    : mimeType.includes("m4a")
    ? "m4a"
    : "ogg";

  const response = await transcriptionClient.audio.transcriptions.create({
    file: await toFile(audio, `whatsapp-audio.${extension}`, { type: mimeType }),
    model: AUDIO_TRANSCRIPTION_MODEL,
    language: "es",
  });

  return response.text.trim();
}

export async function analyzeConversationAction(
  history: Message[],
  businessId: string,
  context: { customerName?: string | null; customerPhone?: string | null } = {}
): Promise<ConversationAction | null> {
  if (!API_KEY) return null;

  const profile = await getBusinessProfile(businessId).catch(() => null);
  if (!profile) return null;

  const lastUser = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
  const actionSignals =
    /(turno|reserva|reservar|agendar|cita|horario|mañana|hoy|pasado|lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo|hablar|persona|asesor|encargad|precio|stock|disponible|confirmar|consult|me interesa|quiero comprar)/i;
  // Memoria en hilos largos: aunque no haya señales de acción ni agenda, si la
  // conversación ya es larga corremos el análisis igual para refrescar el
  // RESUMEN (summary) y no perder contexto más allá de la ventana de historial.
  const isLongThread = history.length >= 10;
  if (!profile.booking_enabled && !actionSignals.test(lastUser) && !isLongThread) return null;

  const now = new Date();
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: [
        "Analizá una conversación de WhatsApp para detectar acciones internas del negocio.",
        "Respondé SOLO JSON válido, sin markdown.",
        `Fecha y hora actual del negocio (hora LOCAL, America/Argentina/Buenos_Aires): ${now.toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", weekday: "long", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })}. Interpretá "hoy", "mañana", "pasado" y los días de la semana SOBRE esta fecha local. Las horas que diga el cliente son hora local.`,
        `Agenda activada: ${profile.booking_enabled ? "sí" : "no"}.`,
        profile.booking_config ? `Reglas de agenda del negocio:\n${sanitizeForPrompt(profile.booking_config, 1200)}` : "No hay disponibilidad real configurada.",
        context.customerName ? `Nombre conocido del cliente: ${sanitizeForPrompt(context.customerName, 120)}` : "Nombre conocido del cliente: desconocido.",
        context.customerPhone ? `WhatsApp conocido del cliente: ${sanitizeForPrompt(context.customerPhone, 60)}` : "WhatsApp conocido del cliente: desconocido.",
        "",
        "Eventos posibles:",
        "- none: no hace falta acción.",
        "- appointment_request: el cliente quiere reservar, pero faltan datos. customer_reply debe pedir solo los datos faltantes con tono natural.",
        "- appointment_ready: hay nombre, servicio o motivo, y día/hora suficientes para registrar una solicitud de reserva pendiente. No confirmes disponibilidad real.",
        "- human_handoff: SOLO si el cliente pide explícitamente hablar con una persona, está claramente enojado/reclamando, o insiste después de que el asistente ya intentó resolver. NO uses human_handoff para dudas que solo requieren chequear un dato del negocio — en ese caso usá none.",
        "- hot_lead: el cliente muestra intención clara de compra o reserva, pero no corresponde crear turno todavía.",
        "",
        "Para appointment_ready, appointment.starts_at debe ser la fecha y hora LOCAL del negocio (la hora de pared que pidió el cliente) en formato 'YYYY-MM-DDTHH:MM', SIN 'Z', SIN offset y SIN zona horaria. Ejemplo: si el cliente pide mañana a las 13:30, devolvé exactamente '<fecha>T13:30'. NO conviertas a UTC, NO sumes ni restes horas: copiá la hora tal cual la dijo el cliente. Si no hay año, usá la próxima fecha futura razonable.",
        "Si falta nombre, servicio/motivo, día u hora, NO uses appointment_ready; usá appointment_request.",
        "El customer_reply para appointment_ready debe sonar como: 'Perfecto, te dejo la reserva solicitada 🙌 La paso para confirmar y te avisamos apenas quede confirmada.'",
        "Para human_handoff, customer_reply debe sonar humano: 'Dame un momento y lo consulto para responderte bien.'",
        "",
        "JSON esperado:",
        '{"event":"none|appointment_request|appointment_ready|human_handoff|hot_lead","confidence":0.0,"customer_reply":null,"reason":null,"summary":null,"appointment":{"customer_name":null,"service":null,"starts_at":null,"notes":null,"missing_fields":[]}}',
      ].join("\n"),
    },
    ...history.slice(-12).map((m) => ({
      role: m.role === "user" ? ("user" as const) : ("assistant" as const),
      content: m.role === "user" ? sanitizeForPrompt(m.content, 2000) : m.content,
    })),
  ];

  const response = await client.chat.completions.create({
    model: ANALYSIS_MODEL,
    messages,
    max_tokens: 450,
    temperature: 0.1,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content ?? "";
  return normalizeAction(extractJsonObject(content));
}
