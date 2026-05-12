/**
 * Worker persistente de Baileys.
 *
 * Corre como proceso separado en VPS / EasyPanel / Coolify.
 * NO correr en Vercel — Baileys necesita un proceso long-running.
 *
 * Requiere en .env.local (o variables de entorno del servidor):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   BUSINESS_ID
 *   WORKER_INSTANCE_NAME   (default: main)
 *   BAILEYS_AUTH_BASE_PATH (default: ./auth)
 *   OPENROUTER_API_KEY
 *   OPENROUTER_MODEL       (default: openai/gpt-4o-mini)
 *
 * Uso local:
 *   npm run dev:worker
 *
 * En producción (VPS):
 *   npm run start:worker
 */

import "./env-loader";
import fs from "node:fs";
import {
  clearRequestedSessionAction,
  checkAccountAccess,
  getBestOutgoingJidForConversation,
  getConnectionState,
  getRequestedSessionAction,
  getPendingOutbox,
  markOutboxSent,
  setOutboxError,
  setOutboxExternalId,
  setConnectionState,
  updateWorkerHeartbeat,
} from "../src/lib/db";
import { getWhatsAppProvider } from "../src/lib/whatsapp";
import { getAuthDir, getHandle } from "../src/lib/baileys/client";

const INSTANCE = process.env.WORKER_INSTANCE_NAME ?? "main";
const AUTH_DIR = getAuthDir();
const provider = getWhatsAppProvider();

console.log(`[worker] Iniciando — instance=${INSTANCE}`);
console.log(`[worker] Auth dir: ${AUTH_DIR}`);

// Marca disconnected al inicio para limpiar estado previo
setConnectionState({
  status: "disconnected",
  qr_string: null,
  phone: null,
  auth_path: AUTH_DIR,
}).catch((err) => console.error("[worker] Error limpiando estado inicial:", err));

// Inicia Baileys
provider.start().catch((err) => {
  console.error("[worker] Error fatal al iniciar:", err);
  process.exit(1);
});

// ---- Outbox processor (cada 2s) ----
setInterval(async () => {
  const handle = getHandle();
  if (!handle) return;

  // Heartbeat
  await updateWorkerHeartbeat(AUTH_DIR).catch(() => undefined);

  const state = await getConnectionState().catch(() => null);
  if (!state || state.status !== "connected") return;

  const access = await checkAccountAccess().catch((err) => {
    console.error("[worker] Error validando acceso de cuenta:", err);
    return null;
  });
  if (!access?.canUseApp) {
    console.log(`[worker] Outbox bloqueado (${access?.reason ?? "access_check_failed"})`);
    return;
  }

  const pending = await getPendingOutbox(20).catch(() => []);
  for (const item of pending) {
    try {
      console.log(`[outbox] id=${item.id}`);
      console.log(`[outbox] original targetJid=${item.target_jid}`);
      const preferred = await getBestOutgoingJidForConversation(item.conversation_id);
      const targetJid = preferred.targetJid || item.target_jid;

      console.log(`[outbox] resolved targetJid=${targetJid}`);
      if (!preferred.targetJid) {
        // needs_phone_mapping is a permanent error (no phone linked to contact).
        // Set retry_count to max (3) so the worker stops retrying this item.
        await setOutboxError(item.id, "needs_phone_mapping", 3);
        console.error(`[outbox] send error=${item.id} — contact needs phone mapping, will not retry`);
        continue;
      }

      if (targetJid.endsWith("@lid")) {
        console.warn("[outbox] warning: intentando enviar a @lid porque no hay pn_jid disponible");
      }

      const sentId = await provider.sendText(targetJid, item.content);
      if (sentId) {
        await setOutboxExternalId(item.id, sentId).catch(() => undefined);
      }
      await markOutboxSent(item.id);
      console.log(`[outbox] sent ok=${item.id} externalId=${sentId ?? ""}`);
    } catch (err) {
      const nextRetry = item.retry_count + 1;
      const errMsg = err instanceof Error ? err.message : "Error enviando outbox";
      await setOutboxError(item.id, errMsg, nextRetry).catch(() => undefined);
      if (nextRetry >= 3) {
        console.error(`[outbox] sent error=${item.id} (reintento ${nextRetry}/3, ABANDONADO):`, errMsg);
      } else {
        console.warn(`[outbox] sent error=${item.id} (reintento ${nextRetry}/3):`, errMsg);
      }
    }
  }
}, 2000);

// ---- Heartbeat independiente (cada 10s) ----
setInterval(async () => {
  await updateWorkerHeartbeat(AUTH_DIR).catch(() => undefined);
}, 10_000);

// ---- Watcher de disconnect remoto (cada 2s) ----
setInterval(async () => {
  const action = await getRequestedSessionAction().catch(() => "none");
  if (action !== "disconnect") return;

  console.log("[worker] Solicitud de desconexión desde el dashboard");

  const handle = getHandle();
  if (handle) {
    try {
      await provider.disconnect();
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
  }).catch(() => undefined);

  await clearRequestedSessionAction().catch(() => undefined);

  console.log("[worker] Reiniciando en 2s para generar nuevo QR...");
  setTimeout(() => {
    provider.start().catch((err) => console.error("[worker] Error al reiniciar:", err));
  }, 2000);
}, 2000);

process.on("SIGINT", () => {
  console.log("[worker] Deteniendo (SIGINT)...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("[worker] Deteniendo (SIGTERM)...");
  process.exit(0);
});
