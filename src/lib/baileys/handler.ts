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
];

function isHandoffReply(text: string): boolean {
  return HANDOFF_PATTERNS.some((p) => p.test(text));
}
import { extractPhoneFromJid } from "../whatsapp-jid";
import { getConnectionState } from "../db";
import { generateReply } from "../openrouter";

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
  console.log(`[bot/${businessId}] Llamando LLM con ${history.length} mensajes...`);
  const t0 = Date.now();

  const reply = await generateReply(history, businessId);
  const elapsed = Date.now() - t0;
  console.log(`[bot/${businessId}] LLM respondió en ${elapsed}ms`);

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
  if (isHandoffReply(reply)) {
    console.log(`[bot/${businessId}] Handoff detectado — cambiando a HUMAN + needs_attention`);
    await setMode(convo.id, "HUMAN", businessId).catch(() => undefined);
    await setNeedsAttention(convo.id, true, businessId).catch(() => undefined);
  }

  const sentResult = await sock.sendMessage(replyJid, { text: reply });
  console.log(`[wa/outgoing/${businessId}] conversation_id=${convo.id} target_jid=${replyJid} source=ai status=sent`);

  // Guardar el key.id de Baileys para deduplicar el echo fromMe
  const sentId = sentResult?.key?.id;
  if (sentId) {
    await setMessageExternalId(assistantMsg.id, sentId, businessId).catch(() => undefined);
  }
}
