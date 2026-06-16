const DEFAULT_WORKER_INSTANCE_NAME = "main";
const DEFAULT_BAILEYS_AUTH_BASE_PATH = "/data/baileys-auth";
const DEFAULT_WHATSAPP_PROVIDER = "baileys";

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export function getRequiredEnv(name: string): string {
  const value = readEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getBusinessId(): string {
  return getRequiredEnv("BUSINESS_ID");
}

export function getWorkerInstanceName(): string {
  return readEnv("WORKER_INSTANCE_NAME") ?? DEFAULT_WORKER_INSTANCE_NAME;
}

export function getBaileysAuthBasePath(): string {
  return readEnv("BAILEYS_AUTH_BASE_PATH") ?? DEFAULT_BAILEYS_AUTH_BASE_PATH;
}

export function getWhatsappProvider(): string {
  return readEnv("WHATSAPP_PROVIDER") ?? DEFAULT_WHATSAPP_PROVIDER;
}

/**
 * Fuentes externas (links web / scraping) como fuente de conocimiento de la IA.
 *
 * Quedó DESACTIVADO por defecto: el scraping de páginas web inyectaba ruido
 * (menús, footers, banners) y snapshots desactualizados al prompt, lo que
 * degradaba la calidad y producía respuestas inventadas. El conocimiento del
 * asistente ahora se construye desde datos estructurados del negocio
 * (catálogo, FAQs, horarios, promos).
 *
 * Para reactivarlo (server/worker): ENABLE_EXTERNAL_SOURCES=true
 * Para reactivar la UI en el dashboard: NEXT_PUBLIC_ENABLE_EXTERNAL_SOURCES=true
 */
export function isExternalSourcesEnabled(): boolean {
  const value = readEnv("ENABLE_EXTERNAL_SOURCES")?.toLowerCase();
  return value === "true" || value === "1" || value === "yes";
}
