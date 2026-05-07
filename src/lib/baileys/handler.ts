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
} from "../db";
import { extractPhoneFromJid } from "../whatsapp-jid";
import { getConnectionState } from "../db";
import { generateReply } from "../openrouter";

export function setupMessageHandler(sock: WASocket): void {
  console.log("[bot] Handler de mensajes registrado");

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    console.log(`[bot] messages.upsert: type=${type}, count=${messages.length}`);

    for (const msg of messages) {
      const jid = msg.key?.remoteJid ?? "(sin jid)";
      const fromMe = msg.key?.fromMe;
      const msgType = Object.keys(msg.message ?? {}).join(",") || "(vacío)";
      console.log(`[bot] RAW msg → jid=${jid} fromMe=${fromMe} type=${msgType}`);
    }

    if (type !== "notify") return;

    for (const msg of messages) {
      try {
        await processMessage(sock, msg);
      } catch (err) {
        console.error("[bot] Error procesando mensaje:", err);
      }
    }
  });
}

async function getAgentPhone(): Promise<string | null> {
  try {
    const state = await getConnectionState();
    return state.phone ? state.phone.replace(/[^\d]/g, "") : null;
  } catch {
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processMessage(sock: WASocket, msg: any): Promise<void> {
  const remoteJid: string = msg.key.remoteJid ?? "";
  const fromMe: boolean = !!msg.key.fromMe;
  const externalId: string | undefined = msg.key.id || undefined;

  console.log(`[wa/incoming] message_id=${externalId ?? ""}`);
  console.log(`[wa/incoming] fromMe=${fromMe} remoteJid=${remoteJid}`);

  if (remoteJid.endsWith("@g.us") || remoteJid.endsWith("@newsletter")) {
    console.log("[bot] Ignorado: grupo / newsletter");
    return;
  }

  const isOneToOne =
    remoteJid.endsWith("@s.whatsapp.net") || remoteJid.endsWith("@lid");

  if (!isOneToOne) {
    console.log(`[bot] Ignorado: jid no reconocido → ${remoteJid}`);
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
    console.log("[bot] Ignorado: sin texto (probablemente media)");
    return;
  }

  // Deduplication: skip if this Baileys message ID was already stored.
  if (externalId) {
    const isDup = await isExternalMessageDuplicate(externalId);
    if (isDup) {
      console.log(`[baileys] skipped duplicate external_message_id=${externalId}`);
      return;
    }
  }

  // ── fromMe=true: mensaje enviado desde el celular/web del dueño ──
  //
  // IMPORTANTE: para mensajes fromMe=true:
  // - remoteJid = destinatario (el cliente), no el dueño → correcto para buscar la conversación
  // - msg.pushName = nombre del dueño, NO del cliente → no lo pasamos para evitar pisar el nombre del cliente
  // - derivePhoneNumberFromMessage puede retornar el propio teléfono del dueño → lo ignoramos
  //
  // No pasamos pushName ni phoneNumberIfKnown para evitar corromper datos del contacto cliente.
  if (fromMe) {
    const convo = await getOrCreateConversation({
      rawJid: remoteJid,
      pushName: undefined,       // no usar el nombre del dueño para el contacto cliente
      phoneNumberIfKnown: null,  // no inferir teléfono de mensajes salientes
      inboundJid: null,          // no actualizar last_inbound_jid (esto es saliente)
    });

    await insertMessage(convo.id, "human", text, externalId);
    console.log(`[wa/outgoing] conversation_id=${convo.id} source=phone status=saved`);
    return;
  }

  // ── fromMe=false: mensaje entrante del cliente ──

  const pushName: string | undefined = msg.pushName;
  let phoneNumberIfKnown = derivePhoneNumberFromMessage(msg);

  console.log(`[wa/incoming] participant=${msg.key?.participant ?? "(none)"}`);
  console.log(`[wa/incoming] pushName=${pushName ?? "(none)"}`);
  console.log(`[wa/incoming] derivedPhone=${phoneNumberIfKnown ?? "(none)"}`);

  // For @lid messages, reject "phone numbers" that are actually the LID local part.
  // e.g. senderPn=119142476693596 when remoteJid=119142476693596@lid is NOT a real phone.
  if (remoteJid.endsWith("@lid") && phoneNumberIfKnown) {
    const lidLocalPart = remoteJid.split("@")[0] ?? "";
    if (phoneNumberIfKnown === lidLocalPart) {
      console.log(`[wa/incoming] rejected fake senderPn=${phoneNumberIfKnown} — matches LID local part`);
      phoneNumberIfKnown = null;
    }
  }

  if (remoteJid.endsWith("@lid")) {
    console.log(
      `[identity] lid metadata keys=${Object.keys(msg ?? {}).join(",")}`
    );
    console.log(
      `[identity] lid key fields=${Object.keys(msg.key ?? {}).join(",")}`
    );
    console.log(
      `[identity] lid message fields=${Object.keys(msg.message ?? {}).join(",")}`
    );
    console.log(`[identity] derived phone from metadata=${phoneNumberIfKnown ?? ""}`);
  }

  // Pass inboundJid so the conversation records the real source JID for outbox routing.
  const convo = await getOrCreateConversation({
    rawJid: remoteJid,
    pushName,
    phoneNumberIfKnown,
    inboundJid: remoteJid,
  });

  console.log(`[wa/incoming] resolved_contact_id=${convo.contact_id}`);
  console.log(`[wa/incoming] resolved_conversation_id=${convo.id}`);

  await insertMessage(convo.id, "user", text, externalId);
  await recordInboundMessageUsage();

  const fresh = await getConversationById(convo.id);
  if (!fresh || fresh.mode !== "AI") {
    console.log(`[bot] Modo ${fresh?.mode ?? "?"} — no respondo automáticamente`);
    return;
  }

  let allowed = false;
  try {
    allowed = await canUseAssistant();
  } catch (err) {
    console.error("[bot] canUseAssistant falló (suscripción faltante o error de DB):", err);
    return;
  }
  if (!allowed) {
    console.log("[bot] Plan o límites impiden responder automáticamente — verificá que el estado de suscripción sea 'active' o 'trial'");
    return;
  }

  const history = await getRecentHistory(convo.id, 20);
  console.log(`[bot] Llamando LLM con ${history.length} mensajes...`);
  const t0 = Date.now();

  const reply = await generateReply(history);
  const elapsed = Date.now() - t0;
  console.log(`[bot] LLM respondió en ${elapsed}ms`);

  // ── Selección del JID de respuesta ──
  //
  // Para respuestas IA a un mensaje entrante, usamos directamente el remoteJid
  // del mensaje original. Es el JID verificado por WhatsApp/Baileys como la
  // dirección activa del cliente, y es 100% correcto en este contexto.
  //
  // No usamos getBestOutgoingJidForConversation aquí porque ese camino puede
  // devolver un JID inferido/almacenado que puede ser incorrecto (e.g., un @lid
  // número convertido en falso @s.whatsapp.net).
  //
  // getBestOutgoingJidForConversation se usa solo para el outbox (mensajes del
  // dashboard), donde no tenemos el remoteJid del mensaje entrante en scope.
  const replyJid = remoteJid;
  console.log(`[wa/incoming] selected_reply_jid=${replyJid}`);

  // Seguridad: nunca responder al propio número conectado
  const agentPhone = await getAgentPhone();
  const replyPhone = extractPhoneFromJid(replyJid);
  if (agentPhone && replyPhone && replyPhone === agentPhone) {
    console.warn(`[wa/incoming] prevented reply to own number jid=${replyJid}`);
    return;
  }

  const assistantMsg = await insertMessage(convo.id, "assistant", reply);
  await recordAiReplyUsage();

  const sentResult = await sock.sendMessage(replyJid, { text: reply });
  console.log(`[wa/outgoing] conversation_id=${convo.id} target_jid=${replyJid} source=ai status=sent`);

  // Save Baileys key.id so the fromMe echo is deduplicated later.
  const sentId = sentResult?.key?.id;
  if (sentId) {
    await setMessageExternalId(assistantMsg.id, sentId).catch(() => undefined);
  }
}
