import type { WASocket } from "@whiskeysockets/baileys";
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

// Frases que indican que la IA está derivando al cliente a un asesor humano.
const HANDOFF_PATTERNS = [
  /te paso con (un|una) asesor/i,
  /te comunico con (un|una) asesor/i,
  /paso con (un|una) persona/i,
  /derivarte con (un|una)/i,
  /en breve te contact/i,
  /alguien de nuestro equipo/i,
  /un asesor se (va a |va )poner en contacto/i,
  /mi colega/i,
  /dame un momento y lo consulto/i,
  /dejame confirmar/i,
  /lo reviso con el equipo/i,
  /consulto para no decirte algo incorrecto/i,
];

function isHandoffReply(text: string): boolean {
  return HANDOFF_PATTERNS.some((p) => p.test(text));
}
import { extractPhoneFromJid } from "../whatsapp-jid";
import { getConnectionState } from "../db";
import { analyzeConversationAction, generateReply, type ConversationAction } from "../openrouter";

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

  const text: string | undefined =
    msg.message?.conversation ??
    msg.message?.extendedTextMessage?.text ??
    msg.message?.ephemeralMessage?.message?.conversation ??
    msg.message?.ephemeralMessage?.message?.extendedTextMessage?.text ??
    msg.message?.viewOnceMessage?.message?.conversation ??
    msg.message?.documentWithCaptionMessage?.message?.imageMessage?.caption;

  if (!text?.trim()) {
    console.log(`[bot/${businessId}] Ignorado: sin texto (probablemente media)`);
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

  await insertMessage(convo.id, "user", text, externalId, businessId);
  await recordInboundMessageUsage(businessId);

  let fresh = await getConversationById(convo.id, businessId);
  if (!fresh) {
    console.log(`[bot/${businessId}] Conversación no encontrada — no respondo`);
    return;
  }

  if (fresh.mode === "HUMAN") {
    // Auto-return to AI if the human has been inactive for too long.
    const inactivityMs = HUMAN_INACTIVITY_MINUTES * 60 * 1000;
    const lastActivity = fresh.human_last_activity ? fresh.human_last_activity * 1000 : null;
    const isStale = !lastActivity || Date.now() - lastActivity > inactivityMs;
    if (isStale) {
      console.log(`[bot/${businessId}] Modo HUMAN inactivo (>${HUMAN_INACTIVITY_MINUTES}min) — volviendo a AI`);
      await setMode(convo.id, "AI", businessId);
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

  const history = await getRecentHistory(convo.id, 20, businessId);
  const t0 = Date.now();

  const action = await analyzeConversationAction(history, businessId, {
    customerName: fresh.name,
    customerPhone: fresh.phone_number,
  }).catch((err) => {
    console.warn(`[bot/${businessId}] action analysis falló:`, err instanceof Error ? err.message : err);
    return null;
  });

  let reply: string | null = null;
  let createdAppointmentId: string | null = null;

  if (action && action.confidence >= 0.62) {
    if (hasUsableAppointment(action)) {
      const recentAppointments = await listAppointments(businessId, {
        includeCancelled: true,
        limit: 25,
      }).catch(() => []);
      const duplicateRecent = recentAppointments.some((a) => {
        if (a.conversation_id !== convo.id || a.source !== "ai") return false;
        const createdAt = new Date(a.created_at).getTime();
        return !Number.isNaN(createdAt) && Date.now() - createdAt < 15 * 60 * 1000;
      });

      if (!duplicateRecent) {
        const appointment = action.appointment!;
        const startsAt = new Date(appointment.starts_at!).toISOString();
        const notes = [
          appointment.notes,
          action.summary ? `Resumen: ${action.summary}` : null,
          `Último mensaje: ${text.trim()}`,
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
            conversation_id: convo.id,
            contact_id: convo.contact_id,
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
    console.log(`[bot/${businessId}] Llamando LLM con ${history.length} mensajes...`);
    reply = await generateReply(history, businessId);
  }

  const elapsed = Date.now() - t0;
  console.log(`[bot/${businessId}] respuesta lista en ${elapsed}ms appointment=${createdAppointmentId ?? ""}`);

  // Usar directamente el remoteJid del mensaje entrante para responder.
  const replyJid = remoteJid;
  console.log(`[wa/incoming/${businessId}] selected_reply_jid=${replyJid}`);

  // Nunca responder al propio número conectado
  const agentPhone = await getAgentPhone(businessId);
  const replyPhone = extractPhoneFromJid(replyJid);
  if (agentPhone && replyPhone && replyPhone === agentPhone) {
    console.warn(`[wa/incoming/${businessId}] prevented reply to own number jid=${replyJid}`);
    return;
  }

  const assistantMsg = await insertMessage(convo.id, "assistant", reply, undefined, businessId);
  await recordAiReplyUsage(businessId);

  // Si la respuesta de la IA deriva al cliente a un asesor, cambia el modo a HUMAN
  // y marca la conversación para que el equipo sepa que necesita atención.
  const shouldHandoff =
    isHandoffReply(reply) ||
    (action?.event === "human_handoff" && action.confidence >= 0.62);

  if (shouldHandoff) {
    console.log(`[bot/${businessId}] Handoff detectado — cambiando a HUMAN + needs_attention`);
    await setMode(convo.id, "HUMAN", businessId).catch(() => undefined);
    await setNeedsAttention(convo.id, true, businessId).catch(() => undefined);

    // Aviso interno al encargado (dedup por conversación + día para no spamear).
    const day = new Date().toISOString().slice(0, 10);
    const customerPhone = fresh.phone_number ?? phoneNumberIfKnown ?? extractPhoneFromJid(remoteJid);
    const who = fresh.name || customerPhone || "Un cliente";
    await enqueueInternalNotification(
      {
        event_type: "human_handoff",
        dedup_key: `handoff:${convo.id}:${day}`,
        content: buildHumanHandoffMessage({
          customerLabel: who,
          customerPhone,
          reason: action?.reason ?? "Necesita confirmación del equipo",
          lastMessage: text.trim(),
          summary: action?.summary ?? null,
          assistantReply: reply,
        }),
      },
      businessId
    ).catch((err) => console.error(`[notify/${businessId}] handoff enqueue falló:`, err));
  }

  if (action?.event === "hot_lead" && action.confidence >= 0.7 && !shouldHandoff) {
    const day = new Date().toISOString().slice(0, 10);
    const customerPhone = fresh.phone_number ?? phoneNumberIfKnown ?? extractPhoneFromJid(remoteJid);
    const who = fresh.name || customerPhone || "Un cliente";
    await enqueueInternalNotification(
      {
        event_type: "hot_lead",
        dedup_key: `hot_lead:${convo.id}:${day}`,
        content: [
          "🔥 *Cliente interesado*",
          `Cliente: ${who}`,
          customerPhone ? `WhatsApp: ${customerPhone}` : null,
          action.reason ? `Motivo: ${action.reason}` : null,
          `Último mensaje: ${text.trim()}`,
          action.summary ? `Resumen: ${action.summary}` : null,
          "Revisar en el panel de Atende.",
        ].filter(Boolean).join("\n"),
      },
      businessId
    ).catch((err) => console.error(`[notify/${businessId}] hot_lead enqueue falló:`, err));
  }

  const sentResult = await sock.sendMessage(replyJid, { text: reply });
  console.log(`[wa/outgoing/${businessId}] conversation_id=${convo.id} target_jid=${replyJid} source=ai status=sent`);

  // Guardar el key.id de Baileys para deduplicar el echo fromMe
  const sentId = sentResult?.key?.id;
  if (sentId) {
    await setMessageExternalId(assistantMsg.id, sentId, businessId).catch(() => undefined);
  }
}
