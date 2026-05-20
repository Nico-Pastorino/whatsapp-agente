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
import { getBaileysAuthBasePath, getBusinessId, getWorkerInstanceName } from "../env";
import { setConnectionState, getConnectionState, updateWorkerHeartbeat } from "../db";
import { setupMessageHandler } from "./handler";

const logger = pino({ level: "silent" });

export function getAuthDir(): string {
  return path.resolve(
    getBaileysAuthBasePath(),
    getBusinessId(),
    getWorkerInstanceName()
  );
}

export interface BotHandle {
  sock: WASocket;
  shutdown: () => Promise<void>;
}

let handle: BotHandle | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let manualDisconnectInProgress = false;

function clearReconnectTimer(): void {
  if (!reconnectTimer) return;
  clearTimeout(reconnectTimer);
  reconnectTimer = null;
}

export function beginManualDisconnect(): void {
  manualDisconnectInProgress = true;
  clearReconnectTimer();
}

export async function start(): Promise<void> {
  manualDisconnectInProgress = false;
  const authDir = getAuthDir();

  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  let version: [number, number, number] | undefined;
  try {
    const fetched = await fetchLatestBaileysVersion();
    version = fetched.version;
    console.log("[bot] Versión de WhatsApp Web:", version.join("."));
  } catch (err) {
    console.warn("[bot] No se pudo obtener última versión:", err);
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

  handle = {
    sock,
    shutdown: async () => {
      beginManualDisconnect();
      try {
        console.log("[worker] Ejecutando logout de WhatsApp...");
        await sock.logout();
        console.log("[worker] Logout de WhatsApp completado");
      } catch (error) {
        console.error("[worker] Logout de WhatsApp falló:", error);
      }
      try {
        sock.end(undefined);
      } catch {}
    },
  };

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;
    await updateWorkerHeartbeat(authDir).catch((err) => {
      console.error("[worker] Error actualizando heartbeat:", err);
    });

    if (qr) {
      console.log("[worker] QR generado — escanea desde el dashboard");
      qrcodeTerminal.generate(qr, { small: true });
      await setConnectionState({
        status: "qr",
        qr_string: qr,
        phone: null,
        auth_path: authDir,
      });
    }

    if (connection === "connecting") {
      const current = await getConnectionState();
      if (current.status === "disconnected") {
        await setConnectionState({
          status: "connecting",
          auth_path: authDir,
        });
      }
    }

    if (connection === "open") {
      const rawId = sock.user?.id ?? "";
      const phone = rawId.split(":")[0];
      console.log(`[worker] Conectado como ${phone}`);
      await setConnectionState({
        status: "connected",
        qr_string: null,
        phone,
        auth_path: authDir,
      });
    }

    if (connection === "close") {
      const code = (lastDisconnect?.error as { output?: { statusCode?: number } })
        ?.output?.statusCode;
      console.log(`[worker] Conexión cerrada, código: ${code}`);

      if (manualDisconnectInProgress) {
        console.log("[worker] Cierre manual en progreso — no se reconecta automáticamente");
        await setConnectionState({
          status: "disconnected",
          qr_string: null,
          phone: null,
          auth_path: authDir,
        });
        return;
      }

      if (code === DisconnectReason.loggedOut) {
        console.log("[worker] Sesión cerrada (loggedOut). No se reconecta.");
        await setConnectionState({
          status: "disconnected",
          qr_string: null,
          phone: null,
          auth_path: authDir,
        });
        return;
      }

      scheduleReconnect(code);
    }
  });

  setupMessageHandler(sock);
  await updateWorkerHeartbeat(authDir);
}

function scheduleReconnect(code: number | undefined): void {
  if (manualDisconnectInProgress) return;
  if (reconnectTimer) return;
  // Code 440 = connectionReplaced — esperar más para evitar loop
  const delay = code === 440 ? 15000 : 5000;
  console.log(`[bot] Reconectando en ${delay / 1000}s...`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (handle) {
      try {
        handle.sock.end(undefined);
      } catch {}
      handle = null;
    }
    start().catch((err) => console.error("[bot] Error al reconectar:", err));
  }, delay);
}

export function getHandle(): BotHandle | null {
  return handle;
}
