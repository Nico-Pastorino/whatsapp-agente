import "./env-loader";
import fs from "node:fs";
import {
  clearRequestedSessionAction,
  getConnectionState,
  getRequestedSessionAction,
  getPendingOutbox,
  markOutboxSent,
  setConnectionState,
  updateWorkerHeartbeat,
} from "../src/lib/db";
import { start, getAuthDir, getHandle } from "../src/lib/baileys/client";

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
      // phone almacena el JID completo (e.g. "123@lid" o "549...@s.whatsapp.net")
      const jid = item.phone.includes("@") ? item.phone : `${item.phone}@s.whatsapp.net`;
      await handle.sock.sendMessage(jid, { text: item.content });
      await markOutboxSent(item.id);
      console.log(
        `[worker] → Outbox enviado a ${item.phone}: "${item.content.slice(0, 50)}"`
      );
    } catch (err) {
      console.error(`[worker] Error enviando outbox ${item.id}:`, err);
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
