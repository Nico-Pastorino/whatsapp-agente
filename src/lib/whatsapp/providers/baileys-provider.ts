import { getConnectionState } from "@/lib/db";
import {
  beginManualDisconnect,
  getHandle,
  start as startBaileysClient,
} from "@/lib/baileys/client";
import type { WhatsAppProvider } from "../provider";

export class BaileysProvider implements WhatsAppProvider {
  async start(): Promise<void> {
    await startBaileysClient();
  }

  async sendText(to: string, text: string): Promise<string | null> {
    const handle = getHandle();
    if (!handle) {
      throw new Error("WhatsApp no está conectado.");
    }

    const result = await handle.sock.sendMessage(to, { text });
    return result?.key?.id ?? null;
  }

  async disconnect(): Promise<void> {
    const handle = getHandle();
    if (!handle) return;
    beginManualDisconnect();
    await handle.shutdown();
  }

  async getConnectionStatus(): Promise<{
    status: "disconnected" | "qr" | "connecting" | "connected";
    phone: string | null;
  }> {
    const state = await getConnectionState();
    return {
      status: state.status,
      phone: state.phone,
    };
  }
}
