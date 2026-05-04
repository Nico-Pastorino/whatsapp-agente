import { getWhatsappProvider } from "@/lib/env";
import { BaileysProvider } from "./providers/baileys-provider";
import type { WhatsAppProvider } from "./provider";

let providerInstance: WhatsAppProvider | null = null;

export function getWhatsAppProvider(): WhatsAppProvider {
  if (providerInstance) return providerInstance;

  const provider = getWhatsappProvider();
  switch (provider) {
    case "baileys":
      providerInstance = new BaileysProvider();
      return providerInstance;
    default:
      throw new Error(`WHATSAPP_PROVIDER no soportado: ${provider}`);
  }
}
