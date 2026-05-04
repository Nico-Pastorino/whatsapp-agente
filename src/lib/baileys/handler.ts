import type { WASocket } from "@whiskeysockets/baileys";
import {
  canUseAssistant,
  derivePhoneNumberFromMessage,
  getBestOutgoingJidForConversation,
  getOrCreateConversation,
  getConversationById,
  insertMessage,
  isExternalMessageDuplicate,
  setMessageExternalId,
  getRecentHistory,
  recordAiReplyUsage,
  recordInboundMessageUsage,
} from "../db";
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

async function processMessage(
  sock: WASocket,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  msg: any
): Promise<void> {
  const remoteJid: string = msg.key.remoteJid ?? "";
  const fromMe: boolean = !!msg.key.fromMe;
  const externalId: string | undefined = msg.key.id || undefined;

  console.log(`[baileys] id=${externalId ?? ""} fromMe=${fromMe} remoteJid=${remoteJid}`);

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

  // Deduplication: skip if this Baileys message ID was already stored
  // (covers echoes of dashboard messages and AI replies).
  if (externalId) {
    const isDup = await isExternalMessageDuplicate(externalId);
    if (isDup) {
      console.log(`[baileys] skipped duplicate external_message_id=${externalId}`);
      return;
    }
  }

  const pushName: string | undefined = msg.pushName;
  let phoneNumberIfKnown = derivePhoneNumberFromMessage(msg);

  // For @lid messages, reject "phone numbers" that are actually just the LID
  // local part (e.g. senderPn=119142476693596 when remoteJid=119142476693596@lid).
  if (remoteJid.endsWith("@lid") && phoneNumberIfKnown) {
    const lidLocalPart = remoteJid.split("@")[0] ?? "";
    if (phoneNumberIfKnown === lidLocalPart) {
      console.log(`[identity] rechazando senderPn=${phoneNumberIfKnown} — coincide con LID local, no es teléfono real`);
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

  const convo = await getOrCreateConversation({
    rawJid: remoteJid,
    pushName,
    phoneNumberIfKnown,
  });

  // ── fromMe=true: mensaje enviado desde el celular/web del dueño ──
  if (fromMe) {
    await insertMessage(convo.id, "human", text, externalId);
    console.log(`[baileys] saved manual phone message id=${externalId ?? ""} conv=${convo.id}`);
    return;
  }

  // ── fromMe=false: mensaje entrante del cliente ──
  console.log(`[baileys] classified role=user conv=${convo.id}`);
  await insertMessage(convo.id, "user", text, externalId);
  await recordInboundMessageUsage();

  const fresh = await getConversationById(convo.id);
  if (!fresh || fresh.mode !== "AI") {
    console.log(`[bot] Modo ${fresh?.mode ?? "?"} — no respondo automáticamente`);
    return;
  }

  const allowed = await canUseAssistant();
  if (!allowed) {
    console.log("[bot] Plan o límites impiden responder automáticamente");
    return;
  }

  const history = await getRecentHistory(convo.id, 20);
  console.log(`[bot] Llamando LLM con ${history.length} mensajes...`);
  const t0 = Date.now();

  const reply = await generateReply(history);
  const elapsed = Date.now() - t0;
  console.log(`[bot] LLM respondió en ${elapsed}ms`);

  const preferredTarget = await getBestOutgoingJidForConversation(convo.id);
  if (!preferredTarget.targetJid) {
    console.warn(`[ai-send] contact_id=${convo.contact_id}`);
    console.warn("[ai-send] contacto sin pn_jid, no se envía respuesta");
    return;
  }

  const assistantMsg = await insertMessage(convo.id, "assistant", reply);
  await recordAiReplyUsage();

  const sentResult = await sock.sendMessage(preferredTarget.targetJid, { text: reply });
  console.log(`[bot] → Enviado a ${preferredTarget.targetJid} (${preferredTarget.targetType})`);

  // Save Baileys key.id so the fromMe echo is deduplicated later.
  const sentId = sentResult?.key?.id;
  if (sentId) {
    await setMessageExternalId(assistantMsg.id, sentId).catch(() => undefined);
  }
}
