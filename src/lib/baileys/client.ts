/**
 * Gestor multi-sesión de Baileys.
 *
 * Cada negocio tiene su propia instancia de socket, reconexión y auth.
 * El auth dir se construye como: BAILEYS_AUTH_BASE_PATH / businessId / instanceName
 */

import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers,
  DisconnectReason,
  type WASocket,
} from "@whiskeysockets/baileys";
import pino from "pino";
import qrcodeTerminal from "qrcode-terminal";
import path from "node:path";
import fs from "node:fs";
import { getBaileysAuthBasePath, getWorkerInstanceName } from "../env";
import { setConnectionState, getConnectionState, updateWorkerHeartbeat } from "../db";
import { setupMessageHandler } from "./handler";

const logger = pino({ level: "silent" });

export interface BotHandle {
  sock: WASocket;
  shutdown: () => Promise<void>;
}

interface SessionState {
  handle: BotHandle | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  manualDisconnectInProgress: boolean;
  /**
   * Estado de conexión en memoria (lo conoce el propio worker via connection.update).
   * Permite que los loops del worker (outbox, avisos) NO consulten whatsapp_sessions
   * en Supabase cada pocos segundos — reduce egress de forma drástica.
   */
  connected: boolean;
}

// Map de businessId → estado de sesión
const sessions = new Map<string, SessionState>();

export function getAuthDir(businessId: string): string {
  return path.resolve(
    getBaileysAuthBasePath(),
    businessId,
    getWorkerInstanceName()
  );
}

function getOrCreateSession(businessId: string): SessionState {
  if (!sessions.has(businessId)) {
    sessions.set(businessId, {
      handle: null,
      reconnectTimer: null,
      manualDisconnectInProgress: false,
      connected: false,
    });
  }
  return sessions.get(businessId)!;
}

function clearReconnectTimer(businessId: string): void {
  const session = sessions.get(businessId);
  if (!session?.reconnectTimer) return;
  clearTimeout(session.reconnectTimer);
  session.reconnectTimer = null;
}

export function beginManualDisconnect(businessId: string): void {
  const session = getOrCreateSession(businessId);
  session.manualDisconnectInProgress = true;
  clearReconnectTimer(businessId);
}

export async function startSession(businessId: string): Promise<void> {
  const session = getOrCreateSession(businessId);
  session.manualDisconnectInProgress = false;

  const authDir = getAuthDir(businessId);
  const instanceName = getWorkerInstanceName();

  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  console.log(`[worker/${businessId}] Iniciando sesión — authDir=${authDir}`);

  let version: [number, number, number] | undefined;
  try {
    const fetched = await fetchLatestBaileysVersion();
    version = fetched.version;
    console.log(`[worker/${businessId}] WhatsApp Web versión: ${version.join(".")}`);
  } catch (err) {
    console.warn(`[worker/${businessId}] No se pudo obtener última versión:`, err);
  }

  // Baileys expone este helper con prefijo `use*`, pero no es un React Hook.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { state, saveCreds } = await useMultiFileAuthState(authDir);

  const sock = makeWASocket({
    version,
    auth: state,
    logger,
    browser: Browsers.macOS("Desktop"),
    markOnlineOnConnect: false,
    syncFullHistory: false,
  });

  const handle: BotHandle = {
    sock,
    shutdown: async () => {
      beginManualDisconnect(businessId);
      try {
        console.log(`[worker/${businessId}] Ejecutando logout de WhatsApp...`);
        await sock.logout();
        console.log(`[worker/${businessId}] Logout completado`);
      } catch (error) {
        console.error(`[worker/${businessId}] Logout falló:`, error);
      }
      try {
        sock.end(undefined);
      } catch {}
    },
  };

  session.handle = handle;

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;
    await updateWorkerHeartbeat(authDir, businessId).catch((err) => {
      console.error(`[worker/${businessId}] Error actualizando heartbeat:`, err);
    });

    if (qr) {
      console.log(`[worker/${businessId}] QR generado — escanea desde el dashboard`);
      qrcodeTerminal.generate(qr, { small: true });
      await setConnectionState(
        { status: "qr", qr_string: qr, phone: null, auth_path: authDir },
        businessId,
        instanceName
      );
    }

    if (connection === "connecting") {
      const current = await getConnectionState(businessId, instanceName).catch(() => ({ status: "disconnected" }));
      if (current.status === "disconnected") {
        await setConnectionState(
          { status: "connecting", auth_path: authDir },
          businessId,
          instanceName
        );
      }
    }

    if (connection === "open") {
      const openSession = sessions.get(businessId);
      if (openSession) openSession.connected = true;
      const rawId = sock.user?.id ?? "";
      const phone = rawId.split(":")[0];
      console.log(`[worker/${businessId}] Conectado como ${phone}`);
      await setConnectionState(
        { status: "connected", qr_string: null, phone, auth_path: authDir },
        businessId,
        instanceName
      );
    }

    if (connection === "close") {
      const code = (lastDisconnect?.error as { output?: { statusCode?: number } })
        ?.output?.statusCode;
      console.log(`[worker/${businessId}] Conexión cerrada, código: ${code}`);

      const currentSession = sessions.get(businessId);
      if (currentSession) currentSession.connected = false;
      if (currentSession?.manualDisconnectInProgress) {
        console.log(`[worker/${businessId}] Cierre manual en progreso — no se reconecta`);
        await setConnectionState(
          { status: "disconnected", qr_string: null, phone: null, auth_path: authDir },
          businessId,
          instanceName
        );
        return;
      }

      if (code === DisconnectReason.loggedOut) {
        console.log(`[worker/${businessId}] Sesión cerrada (loggedOut). Limpiando auth y regenerando QR...`);
        await setConnectionState(
          { status: "disconnected", qr_string: null, phone: null, auth_path: authDir },
          businessId,
          instanceName
        );

        // Limpiar archivos de auth invalidados por el logout
        try {
          fs.rmSync(authDir, { recursive: true, force: true });
          console.log(`[worker/${businessId}] Auth limpiado: ${authDir}`);
        } catch (err) {
          console.error(`[worker/${businessId}] Error limpiando auth:`, err);
        }

        // Reconectar (sin auth → Baileys genera nuevo QR automáticamente)
        scheduleReconnect(businessId, code);
        return;
      }

      scheduleReconnect(businessId, code);
    }
  });

  setupMessageHandler(sock, businessId);
  await updateWorkerHeartbeat(authDir, businessId);
}

function scheduleReconnect(businessId: string, code: number | undefined): void {
  const session = sessions.get(businessId);
  if (!session) return;
  if (session.manualDisconnectInProgress) return;
  if (session.reconnectTimer) return;

  // Code 440 = connectionReplaced — esperar más para evitar loop
  const delay = code === 440 ? 15_000 : 5_000;
  console.log(`[worker/${businessId}] Reconectando en ${delay / 1000}s...`);

  session.reconnectTimer = setTimeout(() => {
    session.reconnectTimer = null;
    if (session.handle) {
      try {
        session.handle.sock.end(undefined);
      } catch {}
      session.handle = null;
    }
    startSession(businessId).catch((err) =>
      console.error(`[worker/${businessId}] Error al reconectar:`, err)
    );
  }, delay);
}

export async function stopSession(businessId: string): Promise<void> {
  const session = sessions.get(businessId);
  if (!session) return;

  clearReconnectTimer(businessId);
  session.manualDisconnectInProgress = true;

  if (session.handle) {
    try {
      await session.handle.shutdown();
    } catch {}
    session.handle = null;
  }

  sessions.delete(businessId);
  console.log(`[worker/${businessId}] Sesión detenida`);
}

export function getHandle(businessId: string): BotHandle | null {
  return sessions.get(businessId)?.handle ?? null;
}

/**
 * Estado de conexión en memoria. Lo usa el worker para gatear sus loops sin
 * consultar whatsapp_sessions en cada iteración (gran ahorro de egress).
 */
export function isSessionConnected(businessId: string): boolean {
  return sessions.get(businessId)?.connected === true;
}

export function getAllSessionBusinessIds(): string[] {
  return Array.from(sessions.keys());
}
