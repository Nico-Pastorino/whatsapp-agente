import { NextRequest, NextResponse } from "next/server";
import { readSheet } from "read-excel-file/node";
import { createBusinessItem, listBusinessItems, type CatalogItemInput, type CatalogItemType, type StockStatus } from "@/lib/db";
import { toDashboardAuthResponse, withActiveRoleDashboardBusinessContext } from "@/lib/route-auth";

export const dynamic = "force-dynamic";

type ImportField =
  | "ignore"
  | "name"
  | "price"
  | "description"
  | "category"
  | "stock_status"
  | "notes"
  | "item_type";

type ColumnMapping = Record<string, ImportField>;

interface PreviewItem {
  row: number;
  item_type: CatalogItemType;
  name: string;
  price: string;
  description: string;
  category: string;
  stock_status: StockStatus;
  notes: string;
  status: "ready" | "needs_review" | "duplicate" | "empty";
  warnings: string[];
}

const FIELD_ALIASES: Record<Exclude<ImportField, "ignore">, string[]> = {
  name: ["nombre", "producto", "servicio", "item", "articulo", "artículo", "titulo", "título", "name"],
  price: ["precio", "price", "importe", "valor", "monto", "$", "ars", "usd"],
  description: ["descripcion", "descripción", "detalle", "detalles", "descripcion corta", "description"],
  category: ["categoria", "categoría", "rubro", "familia", "linea", "línea", "category"],
  stock_status: ["stock", "disponibilidad", "estado", "available", "availability"],
  notes: ["nota", "notas", "observaciones", "comentarios", "info", "aclaracion", "aclaración"],
  item_type: ["tipo", "type", "producto o servicio"],
};

function clean(value: unknown, max = 500): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function normalizeKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9$]+/g, " ")
    .trim();
}

function normalizeName(value: string): string {
  return normalizeKey(value).replace(/\s+/g, " ");
}

function detectField(header: string): ImportField {
  const normalized = normalizeKey(header);
  for (const [field, aliases] of Object.entries(FIELD_ALIASES) as Array<[Exclude<ImportField, "ignore">, string[]]>) {
    if (aliases.some((alias) => normalized === normalizeKey(alias) || normalized.includes(normalizeKey(alias)))) {
      return field;
    }
  }
  return "ignore";
}

function parseStock(value: string): StockStatus {
  const v = normalizeKey(value);
  if (!v) return "available";
  if (/(sin stock|agotado|no disponible|unavailable|out of stock)/.test(v)) return "unavailable";
  if (/(pedido|consultar|encargo|on demand)/.test(v)) return "on_demand";
  return "available";
}

function parseItemType(value: string, fallback: CatalogItemType): CatalogItemType {
  const v = normalizeKey(value);
  if (/(servicio|service|turno|consulta|clase|tratamiento)/.test(v)) return "service";
  if (/(producto|product|articulo|articulo)/.test(v)) return "product";
  return fallback;
}

function parseDelimited(text: string, delimiter: "," | "\t"): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      row.push(cur);
      cur = "";
    } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cur);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      cur = "";
    } else {
      cur += ch;
    }
  }
  row.push(cur);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

function rowsToObjects(matrix: unknown[][]): { headers: string[]; rows: Record<string, unknown>[] } {
  const headerRow = matrix[0] ?? [];
  const headers = headerRow.map((cell, index) => clean(cell, 100) || `Columna ${index + 1}`);
  const rows = matrix.slice(1, 251).map((cells) => {
    const row: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? "";
    });
    return row;
  });
  return { headers, rows };
}

async function readWorkbookRows(file: File, buffer: ArrayBuffer): Promise<{ headers: string[]; rows: Record<string, unknown>[] }> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || name.endsWith(".tsv")) {
    const text = new TextDecoder("utf-8").decode(buffer);
    return rowsToObjects(parseDelimited(text, name.endsWith(".tsv") ? "\t" : ","));
  }
  const rows = await readSheet(Buffer.from(buffer));
  return rowsToObjects(rows);
}

function buildPreview(input: {
  rows: Record<string, unknown>[];
  headers: string[];
  mapping?: ColumnMapping;
  existingNames: Set<string>;
  defaultType: CatalogItemType;
}): { mapping: ColumnMapping; items: PreviewItem[] } {
  const mapping: ColumnMapping = {};
  for (const header of input.headers) {
    mapping[header] = input.mapping?.[header] ?? detectField(header);
  }

  const seen = new Set<string>();
  const items = input.rows.map((row, index) => {
    const byField: Partial<Record<ImportField, string>> = {};
    for (const header of input.headers) {
      const field = mapping[header];
      if (!field || field === "ignore") continue;
      const value = clean(row[header], field === "description" || field === "notes" ? 900 : 180);
      if (!value) continue;
      byField[field] = byField[field] ? `${byField[field]} ${value}` : value;
    }

    const name = clean(byField.name, 140);
    const price = clean(byField.price, 120);
    const description = clean(byField.description, 900);
    const category = clean(byField.category, 100);
    const notes = clean(byField.notes, 500);
    const item_type = parseItemType(byField.item_type ?? "", input.defaultType);
    const stock_status = parseStock(byField.stock_status ?? "");
    const key = normalizeName(name);
    const warnings: string[] = [];

    if (!name && !price && !description && !category) warnings.push("Fila vacia.");
    if (!name) warnings.push("Falta nombre.");
    if (!price) warnings.push("Falta precio.");
    if (!description) warnings.push("Falta descripcion.");
    if (key && input.existingNames.has(key)) warnings.push("Ya existe en el catalogo. Se conserva el producto cargado manualmente.");
    if (key && seen.has(key)) warnings.push("Duplicado dentro del archivo.");
    if (key) seen.add(key);

    let status: PreviewItem["status"] = "ready";
    if (!name && !price && !description && !category) status = "empty";
    else if (key && input.existingNames.has(key)) status = "duplicate";
    else if (!name || !price || !description) status = "needs_review";

    return {
      row: index + 2,
      item_type,
      name,
      price,
      description,
      category,
      stock_status,
      notes,
      status,
      warnings,
    };
  });

  return { mapping, items };
}

function previewItemToCatalogInput(item: PreviewItem): CatalogItemInput {
  return {
    item_type: item.item_type,
    name: item.name,
    category: item.category || null,
    description: item.description || null,
    price: item.price || null,
    promo_price: null,
    stock_status: item.stock_status,
    duration: null,
    requires_booking: item.item_type === "service" ? false : false,
    payment_options: null,
    financing_options: null,
    internal_notes: [
      item.notes,
      item.status === "needs_review" ? `Importacion: requiere revision (${item.warnings.join(" ")})` : null,
    ].filter(Boolean).join("\n") || null,
    is_active: item.status === "ready",
    is_featured: false,
    promotion_label: null,
    promotion_ends_at: null,
  };
}

export async function POST(req: NextRequest) {
  try {
    return await withActiveRoleDashboardBusinessContext(["owner", "admin"], async ({ businessId }) => {
      const contentType = req.headers.get("content-type") ?? "";
      const existing = await listBusinessItems(businessId);
      const existingNames = new Set(existing.map((item) => normalizeName(item.name)));

      if (contentType.includes("multipart/form-data")) {
        const form = await req.formData();
        const file = form.get("file");
        if (!(file instanceof File)) {
          return NextResponse.json({ error: "Subi un archivo Excel, CSV o TSV." }, { status: 400 });
        }
        if (file.size > 2 * 1024 * 1024) {
          return NextResponse.json({ error: "El archivo es demasiado grande. Maximo 2 MB." }, { status: 400 });
        }

        const mappingRaw = form.get("mapping");
        const mapping = typeof mappingRaw === "string" && mappingRaw ? JSON.parse(mappingRaw) as ColumnMapping : undefined;
        const defaultType = form.get("defaultType") === "service" ? "service" : "product";
        const buffer = await file.arrayBuffer();
        const { headers, rows } = await readWorkbookRows(file, buffer);
        if (headers.length === 0 || rows.length === 0) {
          return NextResponse.json({ error: "No encontramos filas para importar." }, { status: 400 });
        }
        const preview = buildPreview({ headers, rows, mapping, existingNames, defaultType });
        return NextResponse.json({
          headers,
          mapping: preview.mapping,
          items: preview.items,
          summary: {
            total: preview.items.length,
            ready: preview.items.filter((item) => item.status === "ready").length,
            needs_review: preview.items.filter((item) => item.status === "needs_review").length,
            duplicate: preview.items.filter((item) => item.status === "duplicate").length,
            empty: preview.items.filter((item) => item.status === "empty").length,
          },
        });
      }

      const body = await req.json();
      const items = Array.isArray(body.items) ? body.items as PreviewItem[] : [];
      const approved = items.filter((item) => item.name && item.status !== "duplicate" && item.status !== "empty").slice(0, 200);
      let created = 0;
      const skipped: Array<{ row: number; name: string; reason: string }> = [];
      const seen = new Set<string>();

      for (const item of approved) {
        const key = normalizeName(item.name);
        if (!key || existingNames.has(key) || seen.has(key)) {
          skipped.push({ row: item.row, name: item.name, reason: "Duplicado. Se conservo el catalogo existente." });
          continue;
        }
        seen.add(key);
        try {
          await createBusinessItem(businessId, previewItemToCatalogInput(item));
          created++;
        } catch (err) {
          skipped.push({
            row: item.row,
            name: item.name,
            reason: err instanceof Error ? err.message : "No se pudo importar.",
          });
        }
      }

      return NextResponse.json({ ok: true, created, skipped });
    });
  } catch (error) {
    return toDashboardAuthResponse(error);
  }
}
