import { downloadMediaMessage, type WASocket } from "@whiskeysockets/baileys";
import {
  canUseAssistant,
  derivePhoneNumberFromMessage,
  getOrCreateConversation,
  getConversationById,
  insertMessage,
  isExternalMessageDuplicate,
  setMessageExternalId,
  getRecentHistory,
  recordAiReplyUsage,
  recordInboundMessageUsage,
  checkAccountAccess,
  setMode,
  setNeedsAttention,
  enqueueInternalNotification,
  createAppointment,
  listAppointments,
  HUMAN_INACTIVITY_MINUTES,
} from "../db";

// ── Dos niveles de escalamiento, con efectos distintos ──────────────────────
//
// 1. DERIVACIÓN REAL (HANDOFF): la IA le dijo al cliente que lo pasa con una
//    persona. Cambia el modo a HUMAN (la IA deja de responder), marca
//    needs_attention y avisa al encargado. Solo frases de transferencia
//    explícita — derivar de más destruye el valor del producto.
const HANDOFF_PATTERNS = [
  /te paso con (un|una) asesor/i,
  /te comunico con (un|una) asesor/i,
  /paso con (un|una) persona/i,
  /derivarte con (un|una)/i,
  /te paso con alguien/i,
  /en breve te contact/i,
  /un asesor se (va a |va )poner en contacto/i,
  /alguien del? (nuestro )?equipo (se pone|se va a poner|te va a (escribir|contactar|responder))/i,
  /mi colega/i,
];

// 2. CONSULTA PENDIENTE: la IA dijo que va a chequear un dato con el equipo
//    ("lo consulto y te confirmo"). NO cambia el modo — la IA sigue activa y
//    el cliente puede seguir preguntando. Solo marca needs_attention y avisa
//    al encargado (evento "unanswered") para que cargue la info o responda.
const CONSULT_PATTERNS = [
  /dame un momento y lo consulto/i,
  /dejame confirmar/i,
  /lo reviso con el equipo/i,
  /consulto para no decirte algo incorrecto/i,
  /lo (paso|consulto) (al|con el) equipo/i,
  /para no (decirte|pasarte) (cualquier cosa|mal (la info|el precio))/i,
  /no quiero pasarte mal (la info|el precio)/i,
  /te confirmamos por ac[áa]/i,
  /ahora te averiguo/i,
];

function isHandoffReply(text: string): boolean {
  return HANDOFF_PATTERNS.some((p) => p.test(text));
}

function isConsultReply(text: string): boolean {
  return CONSULT_PATTERNS.some((p) => p.test(text));
}
import { extractPhoneFromJid } from "../whatsapp-jid";
import { getConnectionState } from "../db";
import { analyzeConversationAction, generateReply, transcribeAudioBuffer, type ConversationAction } from "../openrouter";

const AI_REPLY_DEBOUNCE_MS = readPositiveInt(process.env.AI_REPLY_DEBOUNCE_MS, 8000);
const AI_REPLY_MAX_WAIT_MS = readPositiveInt(process.env.AI_REPLY_MAX_WAIT_MS, 20_000);
const ENABLE_AUDIO_TRANSCRIPTION = process.env.ENABLE_AUDIO_TRANSCRIPTION !== "false";

type PendingInboundMessage = {
  messageId: string;
  text: string;
  externalId: string | null;
  receivedAt: number;
  kind: "text" | "audio" | "audio_fallback";
};

type ConversationBuffer = {
  businessId: string;
  conversationId: string;
  contactId: string;
  remoteJid: string;
  phoneNumberIfKnown: string | null;
  timer: ReturnType<typeof setTimeout> | null;
  firstReceivedAt: number;
  processing: boolean;
  items: PendingInboundMessage[];
};

const conversationBuffers = new Map<string, ConversationBuffer>();
const processingGroupIds = new Set<string>();

function readPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function bufferKey(businessId: string, remoteJid: string): string {
  return `${businessId}:${remoteJid}`;
}

function safeTextPreview(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 80);
}

function normalizeReplyForDedup(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildHumanHandoffMessage(input: {
  customerLabel: string;
  customerPhone: string | null;
  reason: string | null;
  lastMessage: string;
  summary: string | null;
  assistantReply: string;
}): string {
  const lines = ["⚠️ *Requiere atención humana*"];
  lines.push(`Cliente: ${input.customerLabel}`);
  if (input.customerPhone) lines.push(`WhatsApp: ${input.customerPhone}`);
  if (input.reason) lines.push(`Motivo: ${input.reason}`);
  lines.push(`Último mensaje: ${input.lastMessage}`);
  if (input.summary) lines.push(`Resumen: ${input.summary}`);
  lines.push(`La IA ya le respondió: "${input.assistantReply}"`);
  lines.push("Revisar en el panel de Atende.");
  return lines.join("\n");
}

function buildAppointmentInterestMessage(input: {
  customerLabel: string;
  customerPhone: string | null;
  lastMessage: string;
  summary: string | null;
  missingFields: string[];
}): string {
  const lines = ["📅 *Cliente quiere reservar*"];
  lines.push(`Cliente: ${input.customerLabel}`);
  if (input.customerPhone) lines.push(`WhatsApp: ${input.customerPhone}`);
  lines.push(`Último mensaje: ${input.lastMessage}`);
  if (input.summary) lines.push(`Resumen: ${input.summary}`);
  if (input.missingFields.length > 0) {
    lines.push(`Faltan datos: ${input.missingFields.join(", ")}`);
  }
  lines.push("El asistente está pidiendo los datos que faltan. Revisar en el panel de Atende.");
  return lines.join("\n");
}

function hasUsableAppointment(action: ConversationAction): boolean {
  if (action.event !== "appointment_ready" || !action.appointment) return false;
  if (!action.appointment.customer_name || !action.appointment.service || !action.appointment.starts_at) return false;
  const startsAt = new Date(action.appointment.starts_at);
  return !Number.isNaN(startsAt.getTime());
}

export function setupMessageHandler(sock: WASocket, businessId: string): void {
  console.log(`[bot/${businessId}] Handler de mensajes registrado`);

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    console.log(`[bot/${businessId}] messages.upsert: type=${type}, count=${messages.length}`);

    for (const msg of messages) {
      const jid = msg.key?.remoteJid ?? "(sin jid)";
      const fromMe = msg.key?.fromMe;
      const msgType = Object.keys(msg.message ?? {}).join(",") || "(vacío)";
      console.log(`[bot/${businessId}] RAW msg → jid=${jid} fromMe=${fromMe} type=${msgType}`);
    }

    if (type !== "notify") return;

    for (const msg of messages) {
      try {
        await processMessage(sock, msg, businessId);
      } catch (err) {
        console.error(`[bot/${businessId}] Error procesando mensaje:`, err);
      }
    }
  });
}

async function getAgentPhone(businessId: string): Promise<string | null> {
  try {
    const state = await getConnectionState(businessId);
    return state.phone ? state.phone.replace(/[^\d]/g, "") : null;
  } catch {
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getMessageContent(msg: any): any {
  return (
    msg.message?.ephemeralMessage?.message ??
    msg.message?.viewOnceMessage?.message ??
    msg.message?.documentWithCaptionMessage?.message ??
    msg.message
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractTextFromMessage(msg: any): string | null {
  const content = getMessageContent(msg);
  const text =
    content?.conversation ??
    content?.extendedTextMessage?.text ??
    content?.imageMessage?.caption ??
    content?.videoMessage?.caption ??
    content?.documentMessage?.caption;
  return typeof text === "string" && text.trim() ? text.trim() : null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getAudioMessage(msg: any): { mimetype: string | null; seconds: number | null } | null {
  const audio = getMessageContent(msg)?.audioMessage;
  if (!audio) return null;
  return {
    mimetype: typeof audio.mimetype === "string" ? audio.mimetype : null,
    seconds: typeof audio.seconds === "number" ? audio.seconds : null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function transcribeWhatsAppAudio(msg: any, businessId: string): Promise<string | null> {
  if (!ENABLE_AUDIO_TRANSCRIPTION) return null;

  const audio = getAudioMessage(msg);
  if (!audio) return null;

  try {
    const buffer = await downloadMediaMessage(msg, "buffer", {});
    console.log(
      `[audio/${businessId}] downloaded bytes=${buffer.length} seconds=${audio.seconds ?? ""} mime=${audio.mimetype ?? "unknown"}`
    );
    const transcript = await transcribeAudioBuffer(buffer, audio.mimetype ?? "audio/ogg");
    if (!transcript) return null;
    console.log(`[audio/${businessId}] transcription ok chars=${transcript.length}`);
    return transcript;
  } catch (err) {
    console.warn(`[audio/${businessId}] transcription failed:`, err instanceof Error ? err.message : err);
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processMessage(sock: WASocket, msg: any, businessId: string): Promise<void> {
  const remoteJid: string = msg.key.remoteJid ?? "";
  const fromMe: boolean = !!msg.key.fromMe;
  const externalId: string | undefined = msg.key.id || undefined;

  console.log(`[wa/incoming/${businessId}] message_id=${externalId ?? ""}`);
  console.log(`[wa/incoming/${businessId}] fromMe=${fromMe} remoteJid=${remoteJid}`);

  if (remoteJid.endsWith("@g.us") || remoteJid.endsWith("@newsletter")) {
    console.log(`[bot/${businessId}] Ignorado: grupo / newsletter`);
    return;
  }

  const isOneToOne =
    remoteJid.endsWith("@s.whatsapp.net") || remoteJid.endsWith("@lid");

  if (!isOneToOne) {
    console.log(`[bot/${businessId}] Ignorado: jid no reconocido → ${remoteJid}`);
    return;
  }

  // Deduplication: skip if this Baileys message ID was already stored.
  if (externalId) {
    const isDup = await isExternalMessageDuplicate(externalId, businessId);
    if (isDup) {
      console.log(`[baileys/${businessId}] skipped duplicate external_message_id=${externalId}`);
      return;
    }
  }

  const audioMessage = getAudioMessage(msg);
  let text: string | null = extractTextFromMessage(msg);
  let inboundKind: PendingInboundMessage["kind"] = "text";

  if (!text && audioMessage && !fromMe) {
    const transcript = await transcribeWhatsAppAudio(msg, businessId);
    if (transcript) {
      text = transcript;
      inboundKind = "audio";
    } else {
      text = "Audio recibido, pero no se pudo entender bien. Pedir al cliente que lo repita o lo mande por texto.";
      inboundKind = "audio_fallback";
    }
  }

  if (!text?.trim()) {
    console.log(`[bot/${businessId}] Ignorado: sin texto ni audio transcribible`);
    return;
  }

  // ── fromMe=true: mensaje enviado desde el celular/web del dueño ──
  if (fromMe) {
    const convo = await getOrCreateConversation({
      businessId,
      rawJid: remoteJid,
      pushName: undefined,
      phoneNumberIfKnown: null,
      inboundJid: null,
    });

    await insertMessage(convo.id, "human", text, externalId, businessId);
    console.log(`[wa/outgoing/${businessId}] conversation_id=${convo.id} source=phone status=saved`);
    return;
  }

  // ── fromMe=false: mensaje entrante del cliente ──

  const pushName: string | undefined = msg.pushName;
  let phoneNumberIfKnown = derivePhoneNumberFromMessage(msg);

  console.log(`[wa/incoming/${businessId}] participant=${msg.key?.participant ?? "(none)"}`);
  console.log(`[wa/incoming/${businessId}] pushName=${pushName ?? "(none)"}`);
  console.log(`[wa/incoming/${businessId}] derivedPhone=${phoneNumberIfKnown ?? "(none)"}`);

  // Para mensajes @lid: rechazar "teléfonos" que son en realidad el local part del LID.
  if (remoteJid.endsWith("@lid") && phoneNumberIfKnown) {
    const lidLocalPart = remoteJid.split("@")[0] ?? "";
    if (phoneNumberIfKnown === lidLocalPart) {
      console.log(`[wa/incoming/${businessId}] rejected fake senderPn=${phoneNumberIfKnown} — matches LID local part`);
      phoneNumberIfKnown = null;
    }
  }

  if (remoteJid.endsWith("@lid")) {
    console.log(`[identity/${businessId}] lid metadata keys=${Object.keys(msg ?? {}).join(",")}`);
    console.log(`[identity/${businessId}] derived phone from metadata=${phoneNumberIfKnown ?? ""}`);
  }

  const convo = await getOrCreateConversation({
    businessId,
    rawJid: remoteJid,
    pushName,
    phoneNumberIfKnown,
    inboundJid: remoteJid,
  });

  console.log(`[wa/incoming/${businessId}] resolved_contact_id=${convo.contact_id}`);
  console.log(`[wa/incoming/${businessId}] resolved_conversation_id=${convo.id}`);

  const userMessage = await insertMessage(convo.id, "user", text, externalId, businessId);
  await recordInboundMessageUsage(businessId);
  scheduleBufferedReply({
    businessId,
    conversationId: convo.id,
    contactId: convo.contact_id,
    remoteJid,
    phoneNumberIfKnown,
    item: {
      messageId: userMessage.id,
      text,
      externalId: externalId ?? null,
      receivedAt: Date.now(),
      kind: inboundKind,
    },
    sock,
  });
  return;
}

function scheduleBufferedReply(input: {
  businessId: string;
  conversationId: string;
  contactId: string;
  remoteJid: string;
  phoneNumberIfKnown: string | null;
  item: PendingInboundMessage;
  sock: WASocket;
}): void {
  const key = bufferKey(input.businessId, input.remoteJid);
  let buffer = conversationBuffers.get(key);
  if (!buffer) {
    buffer = {
      businessId: input.businessId,
      conversationId: input.conversationId,
      contactId: input.contactId,
      remoteJid: input.remoteJid,
      phoneNumberIfKnown: input.phoneNumberIfKnown,
      timer: null,
      firstReceivedAt: input.item.receivedAt,
      processing: false,
      items: [],
    };
    conversationBuffers.set(key, buffer);
  }

  buffer.conversationId = input.conversationId;
  buffer.contactId = input.contactId;
  buffer.phoneNumberIfKnown = input.phoneNumberIfKnown;
  buffer.items.push(input.item);

  console.log(
    `[buffer/${input.businessId}] queued key=${key} count=${buffer.items.length} kind=${input.item.kind} preview="${safeTextPreview(input.item.text)}"`
  );
  armBufferTimer(key, buffer, input.sock);
}

function armBufferTimer(key: string, buffer: ConversationBuffer, sock: WASocket): void {
  if (buffer.timer) clearTimeout(buffer.timer);

  const ageMs = Date.now() - buffer.firstReceivedAt;
  const waitMs = Math.max(0, Math.min(AI_REPLY_DEBOUNCE_MS, AI_REPLY_MAX_WAIT_MS - ageMs));
  console.log(
    `[buffer/${buffer.businessId}] timer key=${key} count=${buffer.items.length} wait_ms=${waitMs}`
  );

  buffer.timer = setTimeout(() => {
    void flushBufferedReply(key, sock);
  }, waitMs);
}

function buildGroupedHistory(history: Awaited<ReturnType<typeof getRecentHistory>>, items: PendingInboundMessage[]) {
  const pendingIds = new Set(items.map((item) => item.messageId));
  const groupedText = items
    .map((item) => item.text.trim())
    .filter(Boolean)
    .join("\n");
  const firstPending = history.find((message) => pendingIds.has(message.id));
  const withoutPending = history.filter((message) => !pendingIds.has(message.id));

  if (!firstPending || !groupedText) return history;

  return [
    ...withoutPending,
    {
      ...firstPending,
      content: groupedText,
      created_at: Math.floor(Date.now() / 1000),
    },
  ];
}

async function flushBufferedReply(key: string, sock: WASocket): Promise<void> {
  const buffer = conversationBuffers.get(key);
  if (!buffer || buffer.processing || buffer.items.length === 0) return;

  const items = buffer.items;
  buffer.items = [];
  buffer.processing = true;
  if (buffer.timer) {
    clearTimeout(buffer.timer);
    buffer.timer = null;
  }

  const groupId = items.map((item) => item.externalId || item.messageId).join("|");
  if (processingGroupIds.has(groupId)) {
    console.log(`[buffer/${buffer.businessId}] duplicate group skipped size=${items.length}`);
    buffer.processing = false;
    return;
  }
  processingGroupIds.add(groupId);

  try {
    await processBufferedReply(buffer, items, sock);
  } catch (err) {
    console.error(`[buffer/${buffer.businessId}] flush failed:`, err);
  } finally {
    processingGroupIds.delete(groupId);
    buffer.processing = false;
    if (buffer.items.length > 0) {
      buffer.firstReceivedAt = buffer.items[0]?.receivedAt ?? Date.now();
      armBufferTimer(key, buffer, sock);
    } else {
      conversationBuffers.delete(key);
    }
  }
}

async function processBufferedReply(
  buffer: ConversationBuffer,
  items: PendingInboundMessage[],
  sock: WASocket
): Promise<void> {
  const { businessId, conversationId, remoteJid, phoneNumberIfKnown } = buffer;
  const groupedText = items.map((item) => item.text.trim()).filter(Boolean).join("\n");
  const t0 = Date.now();

  console.log(
    `[buffer/${businessId}] flushing conversation_id=${conversationId} count=${items.length} audio=${items.some((item) => item.kind === "audio")} fallback_audio=${items.some((item) => item.kind === "audio_fallback")}`
  );

  let fresh = await getConversationById(conversationId, businessId);
  if (!fresh) {
    console.log(`[bot/${businessId}] Conversación no encontrada — no respondo`);
    return;
  }

  if (fresh.mode === "HUMAN") {
    const inactivityMs = HUMAN_INACTIVITY_MINUTES * 60 * 1000;
    const lastActivity = fresh.human_last_activity ? fresh.human_last_activity * 1000 : null;
    const isStale = !lastActivity || Date.now() - lastActivity > inactivityMs;
    if (isStale) {
      console.log(`[bot/${businessId}] Modo HUMAN inactivo (>${HUMAN_INACTIVITY_MINUTES}min) — volviendo a AI`);
      await setMode(conversationId, "AI", businessId);
      fresh = { ...fresh, mode: "AI" };
    } else {
      console.log(`[bot/${businessId}] Modo HUMAN activo — no respondo automáticamente`);
      return;
    }
  }

  if (fresh.mode !== "AI") {
    console.log(`[bot/${businessId}] Modo ${fresh.mode} — no respondo automáticamente`);
    return;
  }

  const access = await checkAccountAccess(businessId);
  if (!access.canUseApp) {
    console.log(`[bot/${businessId}] Cuenta bloqueada (${access.reason}) — no respondo automáticamente`);
    return;
  }

  let allowed = false;
  try {
    allowed = await canUseAssistant(businessId);
  } catch (err) {
    console.error(`[bot/${businessId}] canUseAssistant falló:`, err);
    return;
  }
  if (!allowed) {
    console.log(`[bot/${businessId}] Plan o límites impiden responder automáticamente`);
    return;
  }

  const history = await getRecentHistory(conversationId, 20, businessId);
  const groupedHistory = buildGroupedHistory(history, items);
  const action = await analyzeConversationAction(groupedHistory, businessId, {
    customerName: fresh.name,
    customerPhone: fresh.phone_number,
  }).catch((err) => {
    console.warn(`[bot/${businessId}] action analysis falló:`, err instanceof Error ? err.message : err);
    return null;
  });

  let reply: string | null = null;
  let createdAppointmentId: string | null = null;

  if (items.every((item) => item.kind === "audio_fallback")) {
    reply = "Te escuché, pero no pude entender bien el audio. ¿Me lo podés repetir o mandar por texto?";
  } else if (action && action.confidence >= 0.62) {
    if (hasUsableAppointment(action)) {
      const recentAppointments = await listAppointments(businessId, {
        includeCancelled: true,
        limit: 25,
      }).catch(() => []);
      const duplicateRecent = recentAppointments.some((appointment) => {
        if (appointment.conversation_id !== conversationId || appointment.source !== "ai") return false;
        const createdAt = new Date(appointment.created_at).getTime();
        return !Number.isNaN(createdAt) && Date.now() - createdAt < 15 * 60 * 1000;
      });

      if (!duplicateRecent) {
        const appointment = action.appointment!;
        const startsAt = new Date(appointment.starts_at!).toISOString();
        const notes = [
          appointment.notes,
          action.summary ? `Resumen: ${action.summary}` : null,
          `Últimos mensajes:\n${groupedText}`,
        ].filter(Boolean).join("\n");

        const created = await createAppointment(
          {
            customer_name: appointment.customer_name,
            customer_phone: fresh.phone_number ?? phoneNumberIfKnown ?? extractPhoneFromJid(remoteJid),
            service: appointment.service,
            starts_at: startsAt,
            notes,
            status: "pending",
            source: "ai",
            conversation_id: conversationId,
            contact_id: buffer.contactId,
          },
          businessId
        ).catch((err) => {
          console.error(`[appointments/${businessId}] create from AI falló:`, err);
          return null;
        });
        createdAppointmentId = created?.id ?? null;
      }

      reply =
        action.customer_reply ??
        "Perfecto, te dejo la reserva solicitada 🙌\nLa paso para confirmar y te avisamos apenas quede confirmada.";
    } else if (action.event === "appointment_request" && action.customer_reply) {
      reply = action.customer_reply;
    } else if ((action.event === "human_handoff" || action.event === "hot_lead") && action.customer_reply) {
      reply = action.customer_reply;
    }
  }

  if (!reply) {
    console.log(`[bot/${businessId}] Llamando LLM con ${groupedHistory.length} mensajes, grouped=${items.length}...`);
    reply = await generateReply(groupedHistory, businessId);
  }

  const lastAssistant = [...history].reverse().find((message) => message.role === "assistant");
  if (lastAssistant && normalizeReplyForDedup(lastAssistant.content) === normalizeReplyForDedup(reply)) {
    console.warn(`[bot/${businessId}] respuesta duplicada omitida conversation_id=${conversationId}`);
    return;
  }

  const elapsed = Date.now() - t0;
  console.log(`[bot/${businessId}] respuesta lista en ${elapsed}ms appointment=${createdAppointmentId ?? ""}`);

  const replyJid = fresh.safe_outgoing_jid || fresh.primary_jid || remoteJid;
  console.log(`[wa/incoming/${businessId}] selected_reply_jid=${replyJid}`);

  const agentPhone = await getAgentPhone(businessId);
  const replyPhone = extractPhoneFromJid(replyJid);
  if (agentPhone && replyPhone && replyPhone === agentPhone) {
    console.warn(`[wa/incoming/${businessId}] prevented reply to own number jid=${replyJid}`);
    return;
  }

  const assistantMsg = await insertMessage(conversationId, "assistant", reply, undefined, businessId);
  await recordAiReplyUsage(businessId);

  const shouldHandoff =
    isHandoffReply(reply) ||
    (action?.event === "human_handoff" && action.confidence >= 0.62);
  const consultPending = !shouldHandoff && isConsultReply(reply);

  if (consultPending) {
    console.log(`[bot/${businessId}] Consulta pendiente — aviso al equipo SIN pasar a HUMAN`);
    await setNeedsAttention(conversationId, true, businessId).catch(() => undefined);

    const day = new Date().toISOString().slice(0, 10);
    const customerPhone = fresh.phone_number ?? phoneNumberIfKnown ?? extractPhoneFromJid(remoteJid);
    const who = fresh.name || customerPhone || "Un cliente";
    await enqueueInternalNotification(
      {
        event_type: "unanswered",
        dedup_key: `consult:${conversationId}:${day}`,
        content: [
          "🤔 *El asistente quedó debiendo una respuesta*",
          `Cliente: ${who}`,
          customerPhone ? `WhatsApp: ${customerPhone}` : null,
          `Preguntó: ${groupedText}`,
          `El asistente respondió: "${reply}"`,
          "El asistente sigue atendiendo el chat. Cargá la info que falta o respondé desde el panel.",
        ].filter(Boolean).join("\n"),
      },
      businessId
    ).catch((err) => console.error(`[notify/${businessId}] consult enqueue falló:`, err));
  }

  if (shouldHandoff) {
    console.log(`[bot/${businessId}] Handoff detectado — cambiando a HUMAN + needs_attention`);
    await setMode(conversationId, "HUMAN", businessId).catch(() => undefined);
    await setNeedsAttention(conversationId, true, businessId).catch(() => undefined);

    const day = new Date().toISOString().slice(0, 10);
    const customerPhone = fresh.phone_number ?? phoneNumberIfKnown ?? extractPhoneFromJid(remoteJid);
    const who = fresh.name || customerPhone || "Un cliente";
    await enqueueInternalNotification(
      {
        event_type: "human_handoff",
        dedup_key: `handoff:${conversationId}:${day}`,
        content: buildHumanHandoffMessage({
          customerLabel: who,
          customerPhone,
          reason: action?.reason ?? "Necesita confirmación del equipo",
          lastMessage: groupedText,
          summary: action?.summary ?? null,
          assistantReply: reply,
        }),
      },
      businessId
    ).catch((err) => console.error(`[notify/${businessId}] handoff enqueue falló:`, err));
  }

  if (action?.event === "appointment_request" && action.confidence >= 0.62 && !shouldHandoff) {
    const day = new Date().toISOString().slice(0, 10);
    const customerPhone = fresh.phone_number ?? phoneNumberIfKnown ?? extractPhoneFromJid(remoteJid);
    const who = fresh.name || customerPhone || "Un cliente";
    await enqueueInternalNotification(
      {
        event_type: "hot_lead",
        dedup_key: `appointment_request:${conversationId}:${day}`,
        content: buildAppointmentInterestMessage({
          customerLabel: who,
          customerPhone,
          lastMessage: groupedText,
          summary: action.summary ?? null,
          missingFields: action.appointment?.missing_fields ?? [],
        }),
      },
      businessId
    ).catch((err) => console.error(`[notify/${businessId}] appointment_request enqueue falló:`, err));
  }

  if (action?.event === "hot_lead" && action.confidence >= 0.7 && !shouldHandoff) {
    const day = new Date().toISOString().slice(0, 10);
    const customerPhone = fresh.phone_number ?? phoneNumberIfKnown ?? extractPhoneFromJid(remoteJid);
    const who = fresh.name || customerPhone || "Un cliente";
    await enqueueInternalNotification(
      {
        event_type: "hot_lead",
        dedup_key: `hot_lead:${conversationId}:${day}`,
        content: [
          "🔥 *Cliente interesado*",
          `Cliente: ${who}`,
          customerPhone ? `WhatsApp: ${customerPhone}` : null,
          action.reason ? `Motivo: ${action.reason}` : null,
          `Últimos mensajes:\n${groupedText}`,
          action.summary ? `Resumen: ${action.summary}` : null,
          "Revisar en el panel de Atende.",
        ].filter(Boolean).join("\n"),
      },
      businessId
    ).catch((err) => console.error(`[notify/${businessId}] hot_lead enqueue falló:`, err));
  }

  const sentResult = await sock.sendMessage(replyJid, { text: reply });
  console.log(`[wa/outgoing/${businessId}] conversation_id=${conversationId} target_jid=${replyJid} source=ai status=sent grouped=${items.length}`);

  const sentId = sentResult?.key?.id;
  if (sentId) {
    await setMessageExternalId(assistantMsg.id, sentId, businessId).catch(() => undefined);
  }
}
