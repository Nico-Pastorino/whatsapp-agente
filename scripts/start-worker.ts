/**
 * Worker multi-tenant de Baileys.
 *
 * Gestiona UNA sesión de WhatsApp por cada negocio con suscripción activa o en trial.
 * NO requiere BUSINESS_ID — auto-descubre negocios desde Supabase.
 *
 * Variables de entorno requeridas:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   OPENAI_API_KEY  (o OPENROUTER_API_KEY)
 *   BAILEYS_AUTH_BASE_PATH  (default: /data/baileys-auth — debe ser volumen persistente)
 *   WORKER_INSTANCE_NAME    (default: primary)
 *
 * Variables opcionales (ya NO necesarias):
 *   BUSINESS_ID  ← eliminada, el worker la auto-descubre
 *
 * Uso local:
 *   npm run dev:worker
 *
 * En producción:
 *   npm run start:worker
 */

import "./env-loader";
import fs from "node:fs";
import {
  clearRequestedSessionAction,
  checkAccountAccess,
  getBestOutgoingJidForConversation,
  getRequestedSessionAction,
  getPendingOutbox,
  markOutboxSent,
  setOutboxError,
  setOutboxExternalId,
  setConnectionState,
  updateWorkerHeartbeat,
  getActiveBusinessIdsForWorker,
  returnInactiveConversationsToAI,
  getPendingInternalNotifications,
  markInternalNotificationSent,
  setInternalNotificationError,
} from "../src/lib/db";
import {
  startSession,
  stopSession,
  getHandle,
  getAuthDir,
  getAllSessionBusinessIds,
  isSessionConnected,
  beginManualDisconnect,
} from "../src/lib/baileys/client";
import { getWorkerInstanceName, getBaileysAuthBasePath } from "../src/lib/env";

const INSTANCE = getWorkerInstanceName();
const AUTH_BASE = getBaileysAuthBasePath();
const SCAN_INTERVAL_MS        = 60_000;      // re-escanear negocios nuevos cada 60s
// Intervalos ajustados para minimizar egress de Supabase (plan free).
// El gateo por estado de conexión ahora es en memoria (isSessionConnected),
// así que estos loops ya NO consultan whatsapp_sessions en cada iteración.
const OUTBOX_INTERVAL_MS      = 5_000;       // procesar outbox cada 5s (antes 2s)
const INTERNAL_NOTIF_INTERVAL_MS = 10_000;   // avisos internos cada 10s (antes 4s)
const HEARTBEAT_INTERVAL_MS   = 15_000;      // heartbeat cada 15s (antes 10s; sigue < ventana de 30s)
const DISCONNECT_CHECK_MS     = 20_000;      // desconexión remota cada 20s (antes 2s)
const AUTO_RETURN_INTERVAL_MS = 5 * 60_000;  // auto-retorno a IA cada 5min

console.log(`[worker] Iniciando worker multi-tenant`);
console.log(`[worker] instance_name=${INSTANCE}`);
console.log(`[worker] auth_base=${AUTH_BASE}`);

if (!process.env.BAILEYS_AUTH_BASE_PATH) {
  console.warn(
    "[worker] BAILEYS_AUTH_BASE_PATH no está configurada — usando /data/baileys-auth por defecto. " +
    "En prod, montá un volumen persistente y apuntá esta variable ahí, " +
    "si no el QR se perderá con cada reinicio del container."
  );
}

// ──────────────────────────────────────────────
// Gestión de sesiones activas
// ──────────────────────────────────────────────

const managedBusinessIds = new Set<string>();

async function ensureSessions(): Promise<void> {
  let businessIds: string[];
  try {
    businessIds = await getActiveBusinessIdsForWorker();
  } catch (err) {
    console.error("[worker] Error al obtener negocios activos:", err);
    return;
  }

  console.log(`[worker] Negocios activos encontrados: ${businessIds.length}`);

  for (const businessId of businessIds) {
    if (managedBusinessIds.has(businessId)) continue; // ya tiene sesión

    console.log(`[worker] Iniciando sesión para negocio ${businessId}`);
    managedBusinessIds.add(businessId);

    // Marcar disconnected al inicio para limpiar estado previo
    setConnectionState(
      { status: "disconnected", qr_string: null, phone: null },
      businessId,
      INSTANCE
    ).catch((err) =>
      console.error(`[worker/${businessId}] Error limpiando estado inicial:`, err)
    );

    startSession(businessId).catch((err) => {
      console.error(`[worker/${businessId}] Error fatal al iniciar:`, err);
      managedBusinessIds.delete(businessId); // permitir reintento en próximo scan
    });
  }
}

// Arrancar sesiones al inicio
ensureSessions();

// Re-escanear periódicamente para detectar negocios que se registraron después
setInterval(ensureSessions, SCAN_INTERVAL_MS);

// ──────────────────────────────────────────────
// Outbox processor (cada 2s, por negocio)
// ──────────────────────────────────────────────

setInterval(async () => {
  for (const businessId of managedBusinessIds) {
    const handle = getHandle(businessId);
    if (!handle) continue;

    // Gateo en memoria — sin consultar whatsapp_sessions (ahorro de egress).
    if (!isSessionConnected(businessId)) continue;

    const access = await checkAccountAccess(businessId).catch((err) => {
      console.error(`[worker/${businessId}] Error validando acceso:`, err);
      return null;
    });
    if (!access?.canUseApp) {
      if (access) {
        console.log(`[worker/${businessId}] Outbox bloqueado (${access.reason})`);
      }
      continue;
    }

    const pending = await getPendingOutbox(20, businessId).catch(() => []);
    for (const item of pending) {
      try {
        console.log(`[outbox/${businessId}] id=${item.id}`);
        const preferred = await getBestOutgoingJidForConversation(item.conversation_id, businessId);
        const targetJid = preferred.targetJid || item.target_jid;

        if (!preferred.targetJid) {
          await setOutboxError(item.id, "needs_phone_mapping", 3, businessId);
          console.error(`[outbox/${businessId}] send error=${item.id} — contact needs phone mapping`);
          continue;
        }

        if (targetJid.endsWith("@lid")) {
          console.warn(`[outbox/${businessId}] warning: intentando enviar a @lid`);
        }

        const { sock } = handle;
        const sentResult = await sock.sendMessage(targetJid, { text: item.content });
        const sentId = sentResult?.key?.id;
        if (sentId) {
          await setOutboxExternalId(item.id, sentId, businessId).catch(() => undefined);
        }
        await markOutboxSent(item.id, businessId);
        console.log(`[outbox/${businessId}] sent ok=${item.id} externalId=${sentId ?? ""}`);
      } catch (err) {
        const nextRetry = item.retry_count + 1;
        const errMsg = err instanceof Error ? err.message : "Error enviando outbox";
        await setOutboxError(item.id, errMsg, nextRetry, businessId).catch(() => undefined);
        if (nextRetry >= 3) {
          console.error(`[outbox/${businessId}] sent error=${item.id} (reintento ${nextRetry}/3, ABANDONADO):`, errMsg);
        } else {
          console.warn(`[outbox/${businessId}] sent error=${item.id} (reintento ${nextRetry}/3):`, errMsg);
        }
      }
    }
  }
}, OUTBOX_INTERVAL_MS);

// ──────────────────────────────────────────────
// Avisos internos al encargado (cada 4s)
// Envía al número configurado del dueño/encargado. Independiente del outbox
// de conversaciones: no usa last_inbound_jid ni la lógica de JID de clientes.
// ──────────────────────────────────────────────

setInterval(async () => {
  for (const businessId of managedBusinessIds) {
    const handle = getHandle(businessId);
    if (!handle) continue;

    // Gateo en memoria — sin consultar whatsapp_sessions (ahorro de egress).
    if (!isSessionConnected(businessId)) continue;

    const access = await checkAccountAccess(businessId).catch(() => null);
    if (!access?.canUseApp) continue;

    const pending = await getPendingInternalNotifications(10, businessId).catch(() => []);
    for (const notif of pending) {
      try {
        const { sock } = handle;
        await sock.sendMessage(notif.target_jid, { text: notif.content });
        await markInternalNotificationSent(notif.id, businessId);
        console.log(`[notify/${businessId}] sent ok=${notif.id} event=${notif.event_type}`);
      } catch (err) {
        const nextRetry = notif.retry_count + 1;
        const errMsg = err instanceof Error ? err.message : "Error enviando aviso interno";
        await setInternalNotificationError(notif.id, errMsg, nextRetry, businessId).catch(() => undefined);
        console.warn(`[notify/${businessId}] send error=${notif.id} (reintento ${nextRetry}/3):`, errMsg);
      }
    }
  }
}, INTERNAL_NOTIF_INTERVAL_MS);

// ──────────────────────────────────────────────
// Heartbeat independiente (cada 10s)
// ──────────────────────────────────────────────

setInterval(async () => {
  for (const businessId of managedBusinessIds) {
    await updateWorkerHeartbeat(getAuthDir(businessId), businessId, INSTANCE)
      .catch(() => undefined);
  }
}, HEARTBEAT_INTERVAL_MS);

// ──────────────────────────────────────────────
// Auto-retorno a IA por inactividad (cada 5min)
// ──────────────────────────────────────────────

setInterval(async () => {
  for (const businessId of managedBusinessIds) {
    try {
      const count = await returnInactiveConversationsToAI(businessId);
      if (count > 0) {
        console.log(`[worker/${businessId}] Auto-returned ${count} conversation(s) to AI (inactividad)`);
      }
    } catch (err) {
      console.error(`[worker/${businessId}] Error en auto-return a IA:`, err);
    }
  }
}, AUTO_RETURN_INTERVAL_MS);

// ──────────────────────────────────────────────
// Watcher de disconnect remoto (cada 2s, por negocio)
// ──────────────────────────────────────────────

setInterval(async () => {
  for (const businessId of managedBusinessIds) {
    const action = await getRequestedSessionAction(businessId, INSTANCE).catch(() => "none");
    if (action !== "disconnect") continue;

    console.log(`[worker/${businessId}] Solicitud de desconexión desde el dashboard`);

    // Marcar manual ANTES del logout para que client.ts no dispare su propio reconnect
    beginManualDisconnect(businessId);

    const handle = getHandle(businessId);
    if (handle) {
      try {
        await handle.sock.logout();
      } catch {}
    }

    const authDir = getAuthDir(businessId);
    try {
      fs.rmSync(authDir, { recursive: true, force: true });
    } catch {}

    await setConnectionState(
      { status: "disconnected", qr_string: null, phone: null, auth_path: authDir },
      businessId,
      INSTANCE
    ).catch(() => undefined);

    await clearRequestedSessionAction(businessId, INSTANCE).catch(() => undefined);

    // Remover de managed para que el próximo ciclo de ensureSessions lo re-inicie
    managedBusinessIds.delete(businessId);

    console.log(`[worker/${businessId}] Sesión desconectada. Reiniciando en 3s...`);
    setTimeout(() => {
      managedBusinessIds.add(businessId);
      startSession(businessId).catch((err) =>
        console.error(`[worker/${businessId}] Error al reiniciar:`, err)
      );
    }, 3_000);
  }
}, DISCONNECT_CHECK_MS);

// ──────────────────────────────────────────────
// Señales del proceso
// ──────────────────────────────────────────────

async function gracefulShutdown(signal: string): Promise<void> {
  console.log(`[worker] Deteniendo (${signal})...`);
  for (const businessId of managedBusinessIds) {
    await stopSession(businessId).catch(() => undefined);
  }
  process.exit(0);
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
