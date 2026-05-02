import type { WASocket } from "@whiskeysockets/baileys";
import {
  canUseAssistant,
  getOrCreateConversation,
  getConversationById,
  insertMessage,
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
  if (msg.key.fromMe) {
    console.log("[bot] Ignorado: fromMe=true");
    return;
  }

  const remoteJid: string = msg.key.remoteJid ?? "";

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

  // Guardamos el JID completo como identificador para poder reenviar al sufijo correcto (@lid o @s.whatsapp.net)
  const phone = remoteJid;
  const pushName: string | undefined = msg.pushName;

  console.log(`[bot] ← Mensaje de ${phone} (${pushName ?? "?"}): "${text}"`);

  const convo = await getOrCreateConversation(phone, pushName);
  await insertMessage(convo.id, "user", text);
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

  await insertMessage(convo.id, "assistant", reply);
  await recordAiReplyUsage();

  await sock.sendMessage(remoteJid, { text: reply });
  console.log(`[bot] → Enviado a ${phone}`);
}
