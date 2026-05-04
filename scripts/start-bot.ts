import "./env-loader";
import fs from "node:fs";
import {
  clearRequestedSessionAction,
  getBestOutgoingJidForConversation,
  getConnectionState,
  getRequestedSessionAction,
  getPendingOutbox,
  markOutboxSent,
  setOutboxError,
  setConnectionState,
  updateWorkerHeartbeat,
} from "../src/lib/db";
import { start, getAuthDir, getHandle, beginManualDisconnect } from "../src/lib/baileys/client";

const AUTH_DIR = getAuthDir();

console.log("[worker] Iniciando agente WhatsApp...");

void setConnectionState({
  status: "disconnected",
  qr_string: null,
  phone: null,
  auth_path: AUTH_DIR,
});

start().catch((err) => {
  console.error("[worker] Error fatal al iniciar:", err);
  process.exit(1);
});

// Procesa outbox pendiente cada 2s
setInterval(async () => {
  const handle = getHandle();
  if (!handle) return;

  await updateWorkerHeartbeat(AUTH_DIR).catch(() => undefined);

  const state = await getConnectionState();
  if (state.status !== "connected") return;

  const pending = await getPendingOutbox(20);
  for (const item of pending) {
    try {
      console.log(`[outbox] id=${item.id}`);
      console.log(`[outbox] original targetJid=${item.target_jid}`);
      const preferred = await getBestOutgoingJidForConversation(item.conversation_id);
      const targetJid = preferred.targetJid || item.target_jid;

      console.log(`[outbox] resolved targetJid=${targetJid}`);
      if (!preferred.targetJid) {
        await setOutboxError(
          item.id,
          "No hay JID telefónico disponible para enviar de forma segura."
        );
        console.error(`[outbox] send error=${item.id}`);
        continue;
      }

      if (targetJid.endsWith("@lid")) {
        console.warn("[outbox] warning: intentando enviar a @lid porque no hay pn_jid disponible");
      }

      await handle.sock.sendMessage(targetJid, { text: item.content });
      await markOutboxSent(item.id);
      console.log(`[outbox] sent ok=${item.id}`);
    } catch (err) {
      await setOutboxError(
        item.id,
        err instanceof Error ? err.message : "Error enviando outbox"
      ).catch(() => undefined);
      console.error(`[outbox] sent error=${item.id}:`, err);
    }
  }
}, 2000);

setInterval(async () => {
  const action = await getRequestedSessionAction().catch(() => "none");
  if (action !== "disconnect") return;

  console.log("[worker] Solicitud de desconexión detectada");
  const handle = getHandle();
  if (handle) {
    try {
      beginManualDisconnect();
      await handle.shutdown();
    } catch {}
  }

  try {
    fs.rmSync(AUTH_DIR, { recursive: true, force: true });
  } catch {}

  await setConnectionState({
    status: "disconnected",
    qr_string: null,
    phone: null,
    auth_path: AUTH_DIR,
  });
  await clearRequestedSessionAction();

  setTimeout(() => {
    start().catch((err) => console.error("[worker] Error al reiniciar:", err));
  }, 1000);
}, 1000);

process.on("SIGINT", () => {
  console.log("[worker] Deteniendo...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("[worker] Deteniendo (SIGTERM)...");
  process.exit(0);
});
