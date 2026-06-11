/**
 * Fuentes externas de conocimiento: el negocio pega un link (página web,
 * Google Sheets publicado o CSV) y el asistente responde con esa info.
 *
 * Modelo SNAPSHOT: el contenido se extrae al crear/refrescar y se guarda en
 * la tabla knowledge_sources. La IA lee el snapshot — nunca fetchea en vivo
 * durante una conversación (latencia y costo impredecibles).
 *
 * Lo usa tanto la app (APIs) como el worker (auto-refresh), por eso no tiene
 * "server-only".
 */

import { getSupabaseAdminClient } from "./supabase";

export interface KnowledgeSource {
  id: string;
  business_id: string;
  url: string;
  label: string | null;
  source_type: "web" | "sheet";
  content: string | null;
  status: "pending" | "ok" | "error";
  error_message: string | null;
  enabled: boolean;
  last_fetched_at: string | null;
  created_at: string;
}

/** Máximo de fuentes por negocio (control de costo y de tamaño de prompt). */
export const MAX_SOURCES_PER_BUSINESS = 3;
/** Máximo de caracteres guardados por fuente. */
export const MAX_CONTENT_CHARS = 6000;
/** Tamaño máximo de descarga (bytes) antes de cortar. */
const MAX_DOWNLOAD_BYTES = 2 * 1024 * 1024; // 2 MB
const FETCH_TIMEOUT_MS = 15_000;

// ── Seguridad: anti-SSRF ─────────────────────────────────────────────────────
// El servidor fetchea URLs provistas por el usuario. Bloqueamos destinos
// internos para que nadie use la app como proxy hacia la red privada.
function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return true;
  // IPv4 literales privadas / loopback / link-local / metadata
  const ipv4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 169 && b === 254) return true; // link-local / cloud metadata
  }
  // IPv6 loopback / unique-local
  if (h === "::1" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80")) return true;
  return false;
}

export function validateSourceUrl(raw: string): { ok: true; url: URL } | { ok: false; error: string } {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, error: "El link no es válido. Copialo completo, con https://." };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, error: "Solo aceptamos links http o https." };
  }
  if (isPrivateHost(url.hostname)) {
    return { ok: false, error: "Ese link no es accesible públicamente." };
  }
  return { ok: true, url };
}

// ── Extracción ───────────────────────────────────────────────────────────────

/** Google Sheets compartido → URL de export CSV (lee la primera hoja). */
function googleSheetToCsvUrl(url: URL): string | null {
  if (!url.hostname.includes("docs.google.com") || !url.pathname.includes("/spreadsheets/")) {
    return null;
  }
  const m = url.pathname.match(/\/spreadsheets\/d\/(e\/)?([^/]+)/);
  if (!m) return null;
  if (m[1]) {
    // Link "publicado en la web" (/d/e/<id>/pubhtml) → pub?output=csv
    return `https://docs.google.com/spreadsheets/d/e/${m[2]}/pub?output=csv`;
  }
  const gid = url.searchParams.get("gid") ?? url.hash.match(/gid=(\d+)/)?.[1] ?? "0";
  return `https://docs.google.com/spreadsheets/d/${m[2]}/export?format=csv&gid=${gid}`;
}

function detectSourceType(url: URL): "web" | "sheet" {
  if (googleSheetToCsvUrl(url)) return "sheet";
  if (/\.csv(\?|$)/i.test(url.pathname)) return "sheet";
  return "web";
}

/** CSV → líneas legibles para el prompt ("col1 | col2 | col3"). */
function csvToText(csv: string): string {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim());
  return lines
    .map((line) => {
      // Parser CSV simple con soporte de comillas
      const cells: string[] = [];
      let cur = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
          else inQuotes = !inQuotes;
        } else if (ch === "," && !inQuotes) {
          cells.push(cur.trim()); cur = "";
        } else cur += ch;
      }
      cells.push(cur.trim());
      return cells.filter(Boolean).join(" | ");
    })
    .filter(Boolean)
    .join("\n");
}

/**
 * Productos desde JSON-LD (schema.org). La mayoría de los ecommerce
 * (Tiendanube, Shopify, WooCommerce) embeben su catálogo como datos
 * estructurados aunque la página se renderice con JavaScript.
 */
function extractJsonLdProducts(html: string): string {
  const lines: string[] = [];

  function walk(node: unknown): void {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    const obj = node as Record<string, unknown>;
    const type = obj["@type"];
    const isProduct = type === "Product" || (Array.isArray(type) && type.includes("Product"));
    if (isProduct && typeof obj.name === "string") {
      let line = `• ${obj.name}`;
      const offersRaw = obj.offers;
      const offers = Array.isArray(offersRaw) ? offersRaw : offersRaw ? [offersRaw] : [];
      const first = offers[0] as Record<string, unknown> | undefined;
      const price = first?.price ?? first?.lowPrice;
      const currency = typeof first?.priceCurrency === "string" ? first.priceCurrency : "";
      if (price !== undefined && price !== null && `${price}`.trim()) line += ` — ${currency} ${price}`.replace("  ", " ");
      if (typeof first?.availability === "string" && first.availability.includes("OutOfStock")) line += " [Sin stock]";
      if (typeof obj.description === "string" && obj.description.trim()) {
        line += ` | ${obj.description.trim().slice(0, 120)}`;
      }
      lines.push(line);
    }
    // Listas de productos y grafos anidados
    if (Array.isArray(obj.itemListElement)) {
      for (const it of obj.itemListElement) walk((it as Record<string, unknown>)?.item ?? it);
    }
    if (Array.isArray(obj["@graph"])) walk(obj["@graph"]);
  }

  for (const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      walk(JSON.parse(m[1]));
    } catch {
      // JSON-LD malformado: lo ignoramos.
    }
  }
  return lines.slice(0, 150).join("\n");
}

/** ¿La página es un cascarón client-rendered? ("Cargando productos...") */
const JS_PLACEHOLDER_RX = /cargando[^.\n]{0,40}\.{3}|loading[^.\n]{0,40}\.{3}/i;

/** HTML → texto plano (sin scripts/styles/tags, espacios colapsados). */
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(br|\/p|\/div|\/li|\/tr|\/h[1-6])[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

/** Descarga y extrae el texto de una fuente. Lanza Error con mensaje claro. */
export async function fetchAndExtract(rawUrl: string): Promise<{ content: string; sourceType: "web" | "sheet" }> {
  const validated = validateSourceUrl(rawUrl);
  if (!validated.ok) throw new Error(validated.error);
  const url = validated.url;
  const sourceType = detectSourceType(url);
  const fetchUrl = googleSheetToCsvUrl(url) ?? url.toString();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(fetchUrl, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "AtendeBot/1.0 (+https://atende.app)", Accept: "text/html,text/csv,text/plain,*/*" },
    });
  } catch (err) {
    throw new Error(
      err instanceof Error && err.name === "AbortError"
        ? "La página tardó demasiado en responder. Probá de nuevo."
        : "No pudimos acceder al link. Verificá que sea público."
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error("El link es privado. Compartilo como público (en Google Sheets: Archivo → Compartir → Cualquiera con el enlace).");
    }
    throw new Error(`No pudimos leer el link (error ${res.status}).`);
  }

  // Cortar descargas gigantes
  const reader = res.body?.getReader();
  let raw = "";
  if (reader) {
    const decoder = new TextDecoder();
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      raw += decoder.decode(value, { stream: true });
      if (received > MAX_DOWNLOAD_BYTES) { reader.cancel().catch(() => undefined); break; }
    }
  } else {
    raw = await res.text();
  }

  const contentType = res.headers.get("content-type") ?? "";
  const isCsv = sourceType === "sheet" || contentType.includes("csv") || contentType.includes("text/plain");
  let text = isCsv && !raw.trimStart().startsWith("<") ? csvToText(raw) : htmlToText(raw);

  // Páginas web: intentar rescatar el catálogo desde JSON-LD (funciona aunque
  // la página pinte los productos con JavaScript).
  if (!isCsv) {
    const ldProducts = extractJsonLdProducts(raw);
    if (ldProducts) {
      text = `PRODUCTOS (datos estructurados de la página):\n${ldProducts}\n\n${text}`;
    } else if (JS_PLACEHOLDER_RX.test(text) && text.length < 2500) {
      // Cascarón client-rendered sin datos estructurados: avisar YA, en vez de
      // guardar un snapshot vacío que después deja al asistente sin respuestas.
      throw new Error(
        "Esta página carga sus productos con JavaScript y no se pueden leer directamente. " +
          "Lo más confiable: pasá tus precios a una planilla de Google Sheets y conectá ese link " +
          "(compartido como “Cualquiera con el enlace”)."
      );
    }
  }

  if (!text.trim()) {
    throw new Error("El link no tiene texto legible. Si es un Excel, compartilo como Google Sheets o CSV.");
  }
  if (text.length > MAX_CONTENT_CHARS) {
    text = text.slice(0, MAX_CONTENT_CHARS) + "\n[contenido recortado]";
  }
  return { content: text, sourceType };
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

export async function listKnowledgeSources(businessId: string): Promise<KnowledgeSource[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("knowledge_sources")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as KnowledgeSource[];
}

export async function createKnowledgeSource(
  businessId: string,
  rawUrl: string,
  label: string | null
): Promise<KnowledgeSource> {
  const validated = validateSourceUrl(rawUrl);
  if (!validated.ok) throw new Error(validated.error);

  const existing = await listKnowledgeSources(businessId);
  if (existing.length >= MAX_SOURCES_PER_BUSINESS) {
    throw new Error(`Podés tener hasta ${MAX_SOURCES_PER_BUSINESS} fuentes. Eliminá una para agregar otra.`);
  }

  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();

  // Extraer ANTES de insertar: si el link no sirve, el usuario lo sabe ya.
  const { content, sourceType } = await fetchAndExtract(rawUrl);

  const { data, error } = await supabase
    .from("knowledge_sources")
    .insert({
      business_id: businessId,
      url: validated.url.toString(),
      label: label?.trim().slice(0, 80) || null,
      source_type: sourceType,
      content,
      status: "ok",
      error_message: null,
      enabled: true,
      last_fetched_at: now,
      updated_at: now,
    })
    .select("*")
    .single();
  if (error || !data) throw error ?? new Error("No se pudo guardar la fuente.");
  return data as KnowledgeSource;
}

export async function refreshKnowledgeSource(id: string, businessId: string): Promise<KnowledgeSource> {
  const supabase = getSupabaseAdminClient();
  const { data: source, error } = await supabase
    .from("knowledge_sources")
    .select("*")
    .eq("business_id", businessId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!source) throw new Error("Fuente no encontrada.");

  const now = new Date().toISOString();
  try {
    const { content, sourceType } = await fetchAndExtract(source.url);
    const { data: updated, error: upErr } = await supabase
      .from("knowledge_sources")
      .update({ content, source_type: sourceType, status: "ok", error_message: null, last_fetched_at: now, updated_at: now })
      .eq("business_id", businessId)
      .eq("id", id)
      .select("*")
      .single();
    if (upErr || !updated) throw upErr ?? new Error("No se pudo actualizar.");
    return updated as KnowledgeSource;
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo leer el link.";
    // Conservamos el contenido anterior: mejor info vieja que ninguna.
    await supabase
      .from("knowledge_sources")
      .update({ status: "error", error_message: message, last_fetched_at: now, updated_at: now })
      .eq("business_id", businessId)
      .eq("id", id);
    throw new Error(message);
  }
}

export async function deleteKnowledgeSource(id: string, businessId: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("knowledge_sources")
    .delete()
    .eq("business_id", businessId)
    .eq("id", id);
  if (error) throw error;
}

/** Fuentes habilitadas con contenido, para el prompt de la IA. */
export async function getEnabledSourcesContent(
  businessId: string
): Promise<Array<{ label: string; content: string; lastFetchedAt: string | null }>> {
  const sources = await listKnowledgeSources(businessId).catch(() => []);
  return sources
    .filter((s) => s.enabled && s.content)
    .map((s) => ({
      label: s.label || s.url.replace(/^https?:\/\//, "").slice(0, 60),
      content: s.content!,
      lastFetchedAt: s.last_fetched_at,
    }));
}

/**
 * Refresco automático (lo llama el worker): fuentes habilitadas con snapshot
 * de más de `staleHours` horas. Errores no cortan el loop.
 */
export async function refreshStaleSources(staleHours = 6): Promise<number> {
  const supabase = getSupabaseAdminClient();
  const threshold = new Date(Date.now() - staleHours * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("knowledge_sources")
    .select("id, business_id")
    .eq("enabled", true)
    .or(`last_fetched_at.is.null,last_fetched_at.lt.${threshold}`)
    .limit(20);
  if (error || !data) return 0;
  let refreshed = 0;
  for (const row of data) {
    try {
      await refreshKnowledgeSource(row.id, row.business_id);
      refreshed++;
    } catch {
      // status=error ya quedó registrado; seguimos con la próxima.
    }
  }
  return refreshed;
}
