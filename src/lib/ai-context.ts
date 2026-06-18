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

// Cuántos ítems "regulares" (no destacados) se incluyen en el prompt tras la
// selección por relevancia. Los destacados y las promos activas se incluyen
// SIEMPRE aparte (no descuentan de este tope).
const MAX_REGULAR_ITEMS_IN_PROMPT = (() => {
  const raw = Number.parseInt(process.env.CATALOG_PROMPT_MAX_ITEMS ?? "", 10);
  return Number.isFinite(raw) && raw > 0 ? Math.min(raw, 120) : 40;
})();

const RELEVANCE_STOPWORDS = new Set([
  "que", "los", "las", "del", "una", "uno", "unos", "unas", "por", "para", "con",
  "como", "cuanto", "cuanta", "tienen", "tenes", "hay", "quiero", "necesito",
  "busco", "info", "informacion", "precio", "precios", "hola", "buenas", "dia",
  "tardes", "favor", "the", "and", "una", "este", "esta", "esos", "esas",
]);

function normalizeForMatch(input: string | null | undefined): string {
  return (input ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function queryTokens(query: string | null | undefined): string[] {
  if (!query) return [];
  return Array.from(
    new Set(
      normalizeForMatch(query)
        .replace(/[^a-z0-9áéíóúñ\s]/gi, " ")
        .split(/\s+/)
        .filter((tok) => tok.length >= 3 && !RELEVANCE_STOPWORDS.has(tok))
    )
  ).slice(0, 24);
}

function scoreItem(item: CatalogItem, tokens: string[]): number {
  if (tokens.length === 0) return 0;
  const name = normalizeForMatch(item.name);
  const category = normalizeForMatch(item.category);
  const description = normalizeForMatch(item.description);
  let score = 0;
  for (const tok of tokens) {
    if (name.includes(tok)) score += 3;
    if (category.includes(tok)) score += 2;
    if (description.includes(tok)) score += 1;
  }
  return score;
}

/**
 * Selección de catálogo consciente de la consulta. Para catálogos grandes
 * (plan Pro: cientos/miles de ítems) no podemos mandar todo: elegimos los más
 * relevantes al mensaje del cliente. Garantías:
 *  - Destacados y promos activas: SIEMPRE incluidos.
 *  - Si hay consulta: top-K regulares por relevancia (luego orden natural).
 *  - Sin consulta o sin coincidencias: primeros K en el orden natural (igual
 *    que el comportamiento previo, pero con K configurable y mayor).
 */
export function selectRelevantCatalogItems(
  items: CatalogItem[],
  query: string | null | undefined,
  maxRegular = MAX_REGULAR_ITEMS_IN_PROMPT
): CatalogItem[] {
  if (items.length === 0) return [];
  const featured = items.filter((item) => item.is_featured);
  const promos = items.filter((item) => !item.is_featured && isPromotionActive(item));
  const regular = items.filter((item) => !item.is_featured && !isPromotionActive(item));

  const tokens = queryTokens(query);
  let chosenRegular: CatalogItem[];
  if (tokens.length > 0) {
    const scored = regular
      .map((item, idx) => ({ item, idx, score: scoreItem(item, tokens) }))
      .sort((a, b) => (b.score - a.score) || (a.idx - b.idx));
    const withScore = scored.filter((s) => s.score > 0).map((s) => s.item);
    // Si hay coincidencias, priorizalas; completá hasta maxRegular con el orden natural.
    if (withScore.length >= maxRegular) {
      chosenRegular = withScore.slice(0, maxRegular);
    } else {
      const chosenIds = new Set(withScore.map((i) => i.id));
      const filler = regular.filter((i) => !chosenIds.has(i.id)).slice(0, maxRegular - withScore.length);
      chosenRegular = [...withScore, ...filler];
    }
  } else {
    chosenRegular = regular.slice(0, maxRegular);
  }

  // Únicos preservando: destacados → promos → regulares elegidos.
  const seen = new Set<string>();
  const result: CatalogItem[] = [];
  for (const item of [...featured, ...promos, ...chosenRegular]) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(item);
  }
  return result;
}

function appendCatalog(lines: string[], items: CatalogItem[], maxRegular = MAX_REGULAR_ITEMS_IN_PROMPT): void {
  if (items.length === 0) {
    lines.push("No hay productos o servicios estructurados cargados.");
    return;
  }

  const featured = items.filter((item) => item.is_featured);
  const promos = items.filter((item) => isPromotionActive(item));
  const regular = items.filter((item) => !item.is_featured);

  if (featured.length > 0) {
    lines.push("Destacados (sugerilos o usalos para complementar una compra; podes decir que son de los mas pedidos):");
    for (const item of featured.slice(0, 12)) lines.push(formatItem(item, "*"));
  }

  if (promos.length > 0) {
    lines.push("", "Promociones activas (usalas para incentivar la compra cuando el cliente muestre interes; menciona la fecha de fin si esta. No inventes ninguna):");
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

  lines.push("", "Catalogo (seleccion relevante a la consulta):");
  for (const item of regular.slice(0, maxRegular)) lines.push(formatItem(item));
}

// Presupuesto del texto libre del negocio (no del catálogo, que es la fuente
// principal y se prioriza). Evita prompts gigantes que diluyen la señal.
const MAX_KNOWLEDGE_CHARS = 2000;
const MAX_BOOKING_CHARS = 1200;
const MAX_DESCRIPTION_CHARS = 700;

// Datos crudos del negocio cacheados: el worker reconstruía el contexto leyendo
// Supabase en CADA mensaje (perfil + catálogo + fuentes). Cacheamos los DATOS
// (no el prompt final) por business_id con TTL corto: menos lecturas/egress y
// menos latencia. El prompt se arma por mensaje porque ahora la selección de
// catálogo depende de la consulta del cliente (retrieval por relevancia).
// Tras editar datos, los cambios se ven dentro del TTL (≈60s).
type RawBusinessData = {
  profile: Awaited<ReturnType<typeof getBusinessProfile>>;
  items: CatalogItem[];
  externalSources: Awaited<ReturnType<typeof getEnabledSourcesContent>>;
};
interface ContextCacheEntry {
  value: RawBusinessData | null;
  expiresAt: number;
}
const contextCache = new Map<string, ContextCacheEntry>();
const CONTEXT_CACHE_TTL_MS = 60_000;

/** Fuerza el recálculo del contexto de un negocio (p. ej. tras guardar cambios). */
export function invalidateBusinessAIContext(businessId: string): void {
  contextCache.delete(businessId);
}

async function getRawBusinessData(businessId: string): Promise<RawBusinessData | null> {
  const cached = contextCache.get(businessId);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const [profile, items, externalSources] = await Promise.all([
    getBusinessProfile(businessId).catch(() => null),
    listActiveItemsForPrompt(businessId).catch(() => []),
    getEnabledSourcesContent(businessId).catch(() => []),
  ]);
  const value: RawBusinessData | null = profile ? { profile, items, externalSources } : null;
  contextCache.set(businessId, { value, expiresAt: Date.now() + CONTEXT_CACHE_TTL_MS });
  return value;
}

/**
 * Arma el contexto del negocio para el prompt. `query` (mensaje del cliente) es
 * opcional: cuando se pasa, el catálogo se selecciona por relevancia a esa
 * consulta (clave para catálogos grandes). Sin query, usa el orden natural.
 */
export async function buildBusinessAIContext(
  businessId: string,
  query?: string | null
): Promise<BusinessAIContext | null> {
  const raw = await getRawBusinessData(businessId);
  if (!raw || !raw.profile) return null;
  const { profile, items: allItems, externalSources } = raw;

  // Selección de catálogo consciente de la consulta.
  const items = selectRelevantCatalogItems(allItems, query);

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
  lines.push(
    "",
    "REGLAS, CONDICIONES Y PREGUNTAS FRECUENTES DEL NEGOCIO (informacion oficial — respetala al pie de la letra, NO la contradigas):"
  );
  if (knowledge) {
    lines.push(sanitizeForPrompt(knowledge, MAX_KNOWLEDGE_CHARS));
  } else {
    lines.push("No hay reglas ni condiciones adicionales cargadas.");
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
      // Total real del catálogo (no sólo lo enviado), para que hasCatalog y los
      // logs reflejen el universo completo aunque sólo mandemos una selección.
      catalogItems: allItems.length,
      featuredItems: allItems.filter((item) => item.is_featured).length,
      activePromotions: allItems.filter((item) => isPromotionActive(item)).length,
      hasKnowledgeBase: Boolean(knowledge.trim()),
      externalSources: externalSources.length,
      promptChars: prompt.length,
    },
  };
}
