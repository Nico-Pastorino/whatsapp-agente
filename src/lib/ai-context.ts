import { getBusinessProfile, isPromotionActive, listActiveItemsForPrompt } from "./db";
import { getEnabledSourcesContent } from "./knowledge-sources";
import { toneHint } from "./onboarding";
import type { CatalogItem } from "./db";

const INJECTION_PATTERNS = [
  /ignore\s+(previous|above|all)\s+instructions?/gi,
  /ignorar?\s+(instrucciones?|todo\s+lo\s+anterior)/gi,
  /you\s+are\s+now\s+(?:a|an)\s+/gi,
  /act\s+as\s+(?:a|an)\s+/gi,
  /system\s*:\s*/gi,
  /\[INST\]/gi,
  /###\s*instruction/gi,
  /<\|im_start\|>/gi,
  /<\|im_end\|>/gi,
];

const PLACEHOLDER_TEXT_PATTERNS = [
  /^\$?\s*x+\s*$/i,
  /^\$?\s*\?\s*$/i,
  /^\[.*\]$/i,
  /^-+$/i,
  /^(n\/a|na|no aplica|sin dato|sin datos|sin definir|pendiente|por confirmar|a confirmar|tbd)$/i,
  /^(completar|completar precio|precio|precio a consultar|consultar|consultar precio)$/i,
  /^(no tengo|no se|no sé|desconocido)$/i,
];

export interface BusinessAIContext {
  prompt: string;
  stats: {
    hasProfile: boolean;
    catalogItems: number;
    featuredItems: number;
    activePromotions: number;
    hasKnowledgeBase: boolean;
    externalSources: number;
    promptChars: number;
  };
}

export function sanitizeForPrompt(input: string, maxLength = 2000): string {
  let out = input
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/(\r?\n){3,}/g, "\n\n")
    .trim();

  for (const pattern of INJECTION_PATTERNS) {
    out = out.replace(pattern, "[...]");
  }

  if (out.length > maxLength) {
    out = `${out.slice(0, maxLength)}...`;
  }
  return out;
}

function isPlaceholderText(input: string | null | undefined): boolean {
  const value = input?.trim();
  if (!value) return true;
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return PLACEHOLDER_TEXT_PATTERNS.some((pattern) => pattern.test(normalized));
}

function catalogValue(input: string | null | undefined, maxLength: number): string | null {
  if (isPlaceholderText(input)) return null;
  return sanitizeForPrompt(input!, maxLength);
}

function formatItem(item: CatalogItem, prefix = "-"): string {
  const parts = [`${prefix} ${sanitizeForPrompt(item.name, 120)}`];
  const category = catalogValue(item.category, 80);
  const price = catalogValue(item.price, 80);
  const promoPrice = catalogValue(item.promo_price, 80);
  const duration = catalogValue(item.duration, 80);
  const paymentOptions = catalogValue(item.payment_options, 100);
  const financingOptions = catalogValue(item.financing_options, 100);
  const description = catalogValue(item.description, 260);

  if (category) parts.push(`Categoria: ${category}`);
  parts.push(price ? `Precio: ${price}` : "Precio: no cargado");
  if (promoPrice && isPromotionActive(item)) parts.push(`Precio promo: ${promoPrice}`);
  if (item.stock_status === "unavailable") parts.push("Disponibilidad: sin stock");
  if (item.stock_status === "on_demand") parts.push("Disponibilidad: bajo pedido");
  if (item.item_type === "service") {
    if (duration) parts.push(`Duracion: ${duration}`);
    if (item.requires_booking) parts.push("Requiere turno");
  }
  if (paymentOptions) parts.push(`Pagos: ${paymentOptions}`);
  if (financingOptions) parts.push(`Financiacion: ${financingOptions}`);
  if (description) parts.push(`Detalle: ${description}`);
  return parts.join(" | ");
}

function appendCatalog(lines: string[], items: CatalogItem[]): void {
  if (items.length === 0) {
    lines.push("No hay productos o servicios estructurados cargados.");
    return;
  }

  const featured = items.filter((item) => item.is_featured);
  const promos = items.filter((item) => isPromotionActive(item));
  const regular = items.filter((item) => !item.is_featured);

  if (featured.length > 0) {
    lines.push("Destacados:");
    for (const item of featured.slice(0, 12)) lines.push(formatItem(item, "*"));
  }

  if (promos.length > 0) {
    lines.push("", "Promociones activas:");
    for (const item of promos.slice(0, 12)) {
      const bits = [`- ${sanitizeForPrompt(item.name, 100)}`];
      if (item.promotion_label) bits.push(sanitizeForPrompt(item.promotion_label, 140));
      if (item.promo_price) bits.push(`Precio promo: ${sanitizeForPrompt(item.promo_price, 80)}`);
      if (item.promotion_ends_at) {
        const ends = new Date(item.promotion_ends_at);
        if (!Number.isNaN(ends.getTime())) bits.push(`Hasta: ${ends.toLocaleDateString("es-AR")}`);
      }
      lines.push(bits.join(" | "));
    }
  }

  lines.push("", "Catalogo completo:");
  for (const item of regular.slice(0, 50)) lines.push(formatItem(item));
}

// Presupuesto del texto libre del negocio (no del catálogo, que es la fuente
// principal y se prioriza). Evita prompts gigantes que diluyen la señal.
const MAX_KNOWLEDGE_CHARS = 2000;
const MAX_BOOKING_CHARS = 1200;
const MAX_DESCRIPTION_CHARS = 700;

export async function buildBusinessAIContext(businessId: string): Promise<BusinessAIContext | null> {
  const [profile, items, externalSources] = await Promise.all([
    getBusinessProfile(businessId).catch(() => null),
    listActiveItemsForPrompt(businessId).catch(() => []),
    getEnabledSourcesContent(businessId).catch(() => []),
  ]);

  if (!profile) return null;

  const lines: string[] = [];
  lines.push("CONTEXTO CONFIABLE DEL NEGOCIO");
  lines.push("");
  lines.push("DATOS BASICOS:");
  lines.push(profile.name ? `Nombre: ${sanitizeForPrompt(profile.name, 120)}` : "Nombre: negocio sin nombre cargado");
  if (profile.description) lines.push(`Descripcion: ${sanitizeForPrompt(profile.description, MAX_DESCRIPTION_CHARS)}`);

  const tone = toneHint(profile.response_tone);
  if (tone) lines.push(`Tono: responder con estilo ${tone}.`);

  lines.push("", "HORARIOS / RESERVAS:");
  if (profile.booking_enabled) {
    lines.push("Agenda activada: si el cliente quiere reservar, pedi nombre, servicio, dia y horario preferido.");
    if (profile.booking_config) lines.push(sanitizeForPrompt(profile.booking_config, MAX_BOOKING_CHARS));
    lines.push("No confirmes disponibilidad real si no esta explicitamente cargada.");
  } else {
    lines.push("Agenda automatica no activada. No prometas turnos confirmados.");
  }

  lines.push("", "PRODUCTOS Y SERVICIOS (FUENTE PRINCIPAL):");
  appendCatalog(lines, items);

  const knowledge = [profile.extra, profile.knowledge_base].filter(Boolean).join("\n\n");
  lines.push("", "DATOS FRECUENTES Y PREGUNTAS (FUENTE SECUNDARIA):");
  if (knowledge) {
    lines.push(sanitizeForPrompt(knowledge, MAX_KNOWLEDGE_CHARS));
  } else {
    lines.push("No hay datos frecuentes adicionales cargados.");
  }

  if (externalSources.length > 0) {
    lines.push("", "FUENTES EXTERNAS NORMALIZADAS:");
    lines.push(
      "Revisalas con cuidado si el cliente pregunta por productos, modelos, capacidades, colores, precios o stock. Usalas como evidencia solo cuando el dato aparezca textual."
    );
    for (const source of externalSources.slice(0, 3)) {
      lines.push(
        "",
        `Fuente: ${sanitizeForPrompt(source.label, 80)}`,
        `Tipo: ${source.sourceType === "sheet" ? "planilla/csv" : "web"}`,
        source.lastFetchedAt ? `Ultima lectura: ${source.lastFetchedAt}` : "Ultima lectura: no registrada",
        sanitizeForPrompt(source.content, items.length > 0 ? 4500 : 6000)
      );
    }
  }

  const prompt = lines.join("\n");
  return {
    prompt,
    stats: {
      hasProfile: true,
      catalogItems: items.length,
      featuredItems: items.filter((item) => item.is_featured).length,
      activePromotions: items.filter((item) => isPromotionActive(item)).length,
      hasKnowledgeBase: Boolean(knowledge.trim()),
      externalSources: externalSources.length,
      promptChars: prompt.length,
    },
  };
}
