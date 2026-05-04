export interface WhatsAppProvider {
  start(): Promise<void>;
  sendText(to: string, text: string): Promise<string | null>;
  disconnect(): Promise<void>;
  getConnectionStatus(): Promise<{
    status: "disconnected" | "qr" | "connecting" | "connected";
    phone: string | null;
  }>;
}
