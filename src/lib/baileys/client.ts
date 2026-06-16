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
import { randomUUID } from "node:crypto";
import { getBaileysAuthBasePath, getWorkerInstanceName } from "../env";
import {
  setConnectionState,
  getConnectionState,
  updateWorkerHeartbeat,
  tryAdoptSessionOwnership,
  renewSessionOwnership,
} from "../db";
import { setupMessageHandler } from "./handler";

const logger = pino({ level: "silent" });

// Anti-ban: id único de este proceso worker, para el lock de sesión única.
const PROCESS_ID = randomUUID();
// El lock requiere la migración 031. Se activa con WA_SESSION_LOCK=true.
function isSessionLockEnabled(): boolean {
  return process.env.WA_SESSION_LOCK?.toLowerCase() === "true";
}

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
  /**
   * Evita pedir más de un código de vinculación por socket. Se resetea en cada
   * startSession (un socket nuevo permite un código nuevo).
   */
  pairingRequested: boolean;
  /**
   * Anti-ban: contador de intentos de reconexión consecutivos para aplicar
   * backoff exponencial. Se resetea al conectar (connection === "open").
   */
  reconnectAttempts: number;
  /**
   * Anti-ban: marcas de tiempo (ms) de los últimos envíos, para limitar el
   * volumen por hora y no parecer un bot que dispara mensajes en ráfaga.
   */
  sendTimestamps: number[];
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
      pairingRequested: false,
      reconnectAttempts: 0,
      sendTimestamps: [],
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

  // Anti-ban: lock de sesión única. Si otra instancia viva ya gestiona este
  // número, NO abrimos un segundo socket (evita conflicto 440 → baneo).
  if (isSessionLockEnabled()) {
    const adopted = await tryAdoptSessionOwnership(businessId, instanceName, PROCESS_ID).catch(() => true);
    if (!adopted) {
      console.warn(
        `[worker/${businessId}] Otra instancia tiene la sesión activa — no abro socket (lock anti-doble-sesión).`
      );
      return;
    }
  }

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
    if (isSessionLockEnabled()) {
      renewSessionOwnership(businessId, instanceName, PROCESS_ID).catch(() => undefined);
    }

    if (qr) {
      console.log(`[worker/${businessId}] QR generado — escanea desde el dashboard`);
      qrcodeTerminal.generate(qr, { small: true });
      await setConnectionState(
        { status: "qr", qr_string: qr, phone: null, auth_path: authDir },
        businessId,
        instanceName
      );

      // ── Vinculación por CÓDIGO (alternativa al QR, aditivo) ──────────────
      // Si el dashboard pidió un código (pairing_phone seteado) y este socket
      // todavía no generó uno, lo pedimos a WhatsApp y lo publicamos.
      // El QR sigue vigente en paralelo: el usuario usa el método que quiera.
      const pairingSession = sessions.get(businessId);
      if (pairingSession && !pairingSession.pairingRequested && !sock.authState.creds.registered) {
        try {
          const st = await getConnectionState(businessId, instanceName);
          const pairingPhone = st.pairing_phone?.replace(/[^\d]/g, "") ?? "";
          if (pairingPhone.length >= 10) {
            pairingSession.pairingRequested = true;
            const code = await sock.requestPairingCode(pairingPhone);
            console.log(`[worker/${businessId}] Código de vinculación generado para ${pairingPhone}`);
            await setConnectionState(
              { status: "qr", pairing_code: code, auth_path: authDir },
              businessId,
              instanceName
            );
          }
        } catch (err) {
          console.error(`[worker/${businessId}] Error generando código de vinculación:`, err);
          // No rompe el flujo QR: el usuario puede escanear igual.
        }
      }
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
      if (openSession) {
        openSession.connected = true;
        openSession.reconnectAttempts = 0; // reconexión exitosa: reiniciamos backoff
      }
      const rawId = sock.user?.id ?? "";
      const phone = rawId.split(":")[0];
      console.log(`[worker/${businessId}] Conectado como ${phone}`);
      await setConnectionState(
        { status: "connected", qr_string: null, phone, auth_path: authDir, pairing_phone: null, pairing_code: null },
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

// Anti-ban: backoff de reconexión.
const RECONNECT_BASE_MS = 5_000;
const RECONNECT_MAX_MS = 5 * 60_000; // tope 5 min
// Code 440 = connectionReplaced (otra sesión abrió WhatsApp Web del mismo número).
// Reconectar agresivamente "roba" la sesión en ping-pong y degrada el número:
// tras varios intentos dejamos la sesión quieta y esperamos acción del dueño.
const MAX_REPLACED_ATTEMPTS = 5;

function scheduleReconnect(businessId: string, code: number | undefined): void {
  const session = sessions.get(businessId);
  if (!session) return;
  if (session.manualDisconnectInProgress) return;
  if (session.reconnectTimer) return;

  session.reconnectAttempts += 1;
  const attempt = session.reconnectAttempts;

  // Ante 440 repetido, frenamos para no entrar en loop con la otra sesión.
  if (code === 440 && attempt > MAX_REPLACED_ATTEMPTS) {
    console.warn(
      `[worker/${businessId}] Conexión reemplazada ${attempt} veces (otra sesión activa). ` +
        `Dejo la sesión quieta para no degradar el número. Reconectá desde el dashboard cuando corresponda.`
    );
    session.reconnectAttempts = 0;
    return;
  }

  // Backoff exponencial con jitter: 5s, 10s, 20s, 40s… con tope de 5 min.
  // El 440 arranca un escalón más arriba (espera más desde el principio).
  const base = code === 440 ? RECONNECT_BASE_MS * 2 : RECONNECT_BASE_MS;
  const expo = Math.min(base * 2 ** (attempt - 1), RECONNECT_MAX_MS);
  const jitter = Math.floor(Math.random() * 1_000);
  const delay = expo + jitter;
  console.log(`[worker/${businessId}] Reconectando en ${Math.round(delay / 1000)}s (intento ${attempt})...`);

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

// ── Anti-ban: envío con presencia humana, jitter y tope por hora ──────────────
// Baileys imita a WhatsApp Web: enviar al instante, en ráfaga y sin "escribiendo…"
// es un patrón de bot que acelera el baneo. Este emisor:
//   1) Limita el volumen por hora por número (cap configurable).
//   2) Muestra "escribiendo…" y espera un tiempo proporcional al texto (con jitter).
//   3) Recién entonces envía.
// Todos los envíos salientes (respuestas de IA, outbox del dashboard, avisos)
// deberían pasar por acá.

const MAX_SENDS_PER_HOUR = Number(process.env.WA_MAX_SENDS_PER_HOUR) || 250;
const TYPING_MIN_MS = 700;
const TYPING_MAX_MS = 3_500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** ¿El número superó el tope de envíos en la última hora? (poda la ventana). */
function isOverHourlyCap(session: SessionState): boolean {
  const now = Date.now();
  const cutoff = now - 60 * 60_000;
  session.sendTimestamps = session.sendTimestamps.filter((t) => t > cutoff);
  return session.sendTimestamps.length >= MAX_SENDS_PER_HOUR;
}

export class SendRateLimitedError extends Error {
  constructor() {
    super("WhatsApp send rate cap reached for this hour");
    this.name = "SendRateLimitedError";
  }
}

/**
 * Envía un texto por WhatsApp simulando comportamiento humano y respetando el
 * tope horario. Devuelve el resultado de Baileys (con key.id) o lanza si no hay
 * sesión o se alcanzó el tope.
 */
export async function sendThrottledText(
  businessId: string,
  jid: string,
  text: string
): Promise<Awaited<ReturnType<WASocket["sendMessage"]>>> {
  const session = sessions.get(businessId);
  const sock = session?.handle?.sock;
  if (!session || !sock) {
    throw new Error(`No hay sesión activa de WhatsApp para ${businessId}`);
  }

  if (isOverHourlyCap(session)) {
    console.warn(
      `[wa/throttle/${businessId}] Tope de ${MAX_SENDS_PER_HOUR} envíos/hora alcanzado — se difiere el envío`
    );
    throw new SendRateLimitedError();
  }

  // "Escribiendo…": tiempo proporcional a la longitud del texto, con jitter, acotado.
  const typingMs = Math.min(
    TYPING_MAX_MS,
    Math.max(TYPING_MIN_MS, text.length * 28 + Math.floor(Math.random() * 600))
  );
  try {
    await sock.presenceSubscribe(jid).catch(() => undefined);
    await sock.sendPresenceUpdate("composing", jid).catch(() => undefined);
    await sleep(typingMs);
    await sock.sendPresenceUpdate("paused", jid).catch(() => undefined);
  } catch {
    // La presencia es best-effort: si falla, igual enviamos.
  }

  const result = await sock.sendMessage(jid, { text });
  session.sendTimestamps.push(Date.now());
  return result;
}
