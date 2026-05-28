/**
 * BaileysProvider — stub de compatibilidad.
 *
 * En la arquitectura multi-tenant, el worker llama directamente a
 * `startSession(businessId)` en `lib/baileys/client.ts`.
 * Esta clase ya no es el punto de entrada del worker pero se mantiene
 * para no romper la interfaz WhatsAppProvider si se usa en el futuro.
 */

import type { WhatsAppProvider } from "../provider";

export class BaileysProvider implements WhatsAppProvider {
  async start(): Promise<void> {
    throw new Error(
      "BaileysProvider.start() está deprecado. Usá startSession(businessId) desde lib/baileys/client."
    );
  }

  async sendText(_to: string, _text: string): Promise<string | null> {
    throw new Error("BaileysProvider.sendText() está deprecado en modo multi-tenant.");
  }

  async disconnect(): Promise<void> {
    throw new Error("BaileysProvider.disconnect() está deprecado en modo multi-tenant.");
  }

  async getConnectionStatus(): Promise<{
    status: "disconnected" | "qr" | "connecting" | "connected";
    phone: string | null;
  }> {
    throw new Error("BaileysProvider.getConnectionStatus() está deprecado en modo multi-tenant.");
  }
}
