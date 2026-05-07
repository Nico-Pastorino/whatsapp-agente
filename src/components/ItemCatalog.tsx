"use client";

import Link from "next/link";
import React, { useCallback, useEffect, useState } from "react";
import type { CatalogItem, CatalogItemType, StockStatus } from "@/lib/db";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CatalogState {
  items: CatalogItem[];
  count: number;
  limit: number;
  canAdd: boolean;
}

type FilterType = "all" | "product" | "service";
type FilterStatus = "all" | "active" | "inactive";

// ── Form state ────────────────────────────────────────────────────────────────

interface FormState {
  item_type: CatalogItemType;
  name: string;
  category: string;
  description: string;
  price: string;
  promo_price: string;
  stock_status: StockStatus;
  duration: string;
  requires_booking: boolean;
  payment_options: string;
  financing_options: string;
  internal_notes: string;
  is_active: boolean;
}

const EMPTY_FORM: FormState = {
  item_type: "product",
  name: "",
  category: "",
  description: "",
  price: "",
  promo_price: "",
  stock_status: "available",
  duration: "",
  requires_booking: false,
  payment_options: "",
  financing_options: "",
  internal_notes: "",
  is_active: true,
};

function formToBody(form: FormState): Record<string, unknown> {
  return {
    item_type: form.item_type,
    name: form.name,
    category: form.category || null,
    description: form.description || null,
    price: form.price || null,
    promo_price: form.promo_price || null,
    stock_status: form.stock_status,
    duration: form.duration || null,
    requires_booking: form.requires_booking,
    payment_options: form.payment_options || null,
    financing_options: form.financing_options || null,
    internal_notes: form.internal_notes || null,
    is_active: form.is_active,
  };
}

function itemToForm(item: CatalogItem): FormState {
  return {
    item_type: item.item_type,
    name: item.name,
    category: item.category ?? "",
    description: item.description ?? "",
    price: item.price ?? "",
    promo_price: item.promo_price ?? "",
    stock_status: item.stock_status ?? "available",
    duration: item.duration ?? "",
    requires_booking: item.requires_booking,
    payment_options: item.payment_options ?? "",
    financing_options: item.financing_options ?? "",
    internal_notes: item.internal_notes ?? "",
    is_active: item.is_active,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const inputClass = "atd-input";

const STOCK_LABELS: Record<StockStatus, string> = {
  available: "Disponible",
  unavailable: "Sin stock",
  on_demand: "Bajo pedido",
};

const STOCK_STYLES: Record<StockStatus, React.CSSProperties> = {
  available: { background: "var(--green-tint)", color: "var(--green)" },
  unavailable: { background: "#ffeaea", color: "#c0392b" },
  on_demand: { background: "#fff3cd", color: "#7a5800" },
};

// ── Item Card ─────────────────────────────────────────────────────────────────

function ItemCard({
  item,
  onEdit,
  onDelete,
  onToggle,
  toggling,
}: {
  item: CatalogItem;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  toggling: boolean;
}) {
  return (
    <div className="atd-card" style={{ padding: 14, opacity: item.is_active ? 1 : 0.6 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", margin: 0 }}>{item.name}</p>
            <span className="atd-pill" style={{
              fontSize: 10,
              background: item.item_type === "service" ? "#f0e8ff" : "#e8f0ff",
              color: item.item_type === "service" ? "#7c3aed" : "#1d4ed8",
              border: "none",
            }}>
              {item.item_type === "service" ? "Servicio" : "Producto"}
            </span>
            {!item.is_active && (
              <span className="atd-pill" style={{ fontSize: 10, background: "var(--surface-2)", color: "var(--muted)", border: "none" }}>
                Inactivo
              </span>
            )}
          </div>
          {item.category && (
            <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{item.category}</p>
          )}
        </div>

        {item.stock_status && item.stock_status !== "available" && (
          <span className="atd-pill" style={{ fontSize: 10, flexShrink: 0, border: "none", ...STOCK_STYLES[item.stock_status] }}>
            {STOCK_LABELS[item.stock_status]}
          </span>
        )}
      </div>

      {/* Price */}
      {(item.price || item.promo_price) && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          {item.price && (
            <p style={{ fontSize: 13, fontWeight: 600, color: item.promo_price ? "var(--muted)" : "var(--ink)", textDecoration: item.promo_price ? "line-through" : "none", margin: 0 }}>
              {item.price}
            </p>
          )}
          {item.promo_price && (
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--green)", margin: 0 }}>{item.promo_price}</p>
          )}
        </div>
      )}

      {/* Description */}
      {item.description && (
        <p style={{ fontSize: 11.5, color: "var(--ink-3)", marginBottom: 8, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>{item.description}</p>
      )}

      {/* Service specifics */}
      {item.item_type === "service" && (item.duration || item.requires_booking) && (
        <div style={{ display: "flex", gap: 12, fontSize: 11.5, color: "var(--muted)", marginBottom: 8 }}>
          {item.duration && <span>⏱ {item.duration}</span>}
          {item.requires_booking && <span>📅 Requiere turno</span>}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 6, paddingTop: 8, borderTop: "1px solid var(--hairline)" }}>
        <button onClick={onEdit} style={{ flex: 1, padding: "6px 0", fontSize: 12, fontWeight: 500, color: "var(--ink-2)", background: "none", border: "none", cursor: "pointer", borderRadius: 8 }}>
          Editar
        </button>
        <button onClick={onToggle} disabled={toggling} style={{ flex: 1, padding: "6px 0", fontSize: 12, fontWeight: 500, color: "var(--muted)", background: "none", border: "none", cursor: "pointer", borderRadius: 8, opacity: toggling ? 0.5 : 1 }}>
          {toggling ? "..." : item.is_active ? "Desactivar" : "Activar"}
        </button>
        <button onClick={onDelete} style={{ flex: 1, padding: "6px 0", fontSize: 12, fontWeight: 500, color: "#c0392b", background: "none", border: "none", cursor: "pointer", borderRadius: 8 }}>
          Eliminar
        </button>
      </div>
    </div>
  );
}

// ── Item Form (overlay) ───────────────────────────────────────────────────────

function ItemForm({
  initial,
  saving,
  error,
  onSave,
  onClose,
}: {
  initial: FormState;
  saving: boolean;
  error: string | null;
  onSave: (form: FormState) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<FormState>(initial);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const isService = form.item_type === "service";

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 16 }}>
      <div className="atd-card" style={{ width: "100%", maxWidth: 520, display: "flex", flexDirection: "column", maxHeight: "92vh", padding: 0, overflow: "hidden" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--hairline)", flexShrink: 0 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", margin: 0 }}>
            {initial.name ? "Editar" : "Nuevo"}{" "}
            {form.item_type === "service" ? "servicio" : "producto"}
          </h3>
          <button onClick={onClose} style={{ fontSize: 20, lineHeight: 1, color: "var(--muted)", background: "none", border: "none", cursor: "pointer" }}>×</button>
        </div>

        {/* Body */}
        <div style={{ overflowY: "auto", flex: 1, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Type tabs */}
          <div className="atd-seg">
            {(["product", "service"] as CatalogItemType[]).map((t) => (
              <button
                key={t}
                onClick={() => set("item_type", t)}
                className={form.item_type === t ? "active" : ""}
              >
                {t === "product" ? "Producto" : "Servicio"}
              </button>
            ))}
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder={isService ? "Ej: Corte de pelo" : "Ej: iPhone 13"}
              className={inputClass}
              autoFocus
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Categoría</label>
            <input
              type="text"
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
              placeholder={isService ? "Ej: Corte, Color, Tratamiento" : "Ej: iPhone, Samsung, Accesorios"}
              className={inputClass}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Descripción</label>
            <textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={2}
              placeholder="Descripción breve para que la IA la use al responder"
              className={`${inputClass} resize-none`}
            />
          </div>

          {/* Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Precio</label>
              <input
                type="text"
                value={form.price}
                onChange={(e) => set("price", e.target.value)}
                placeholder="Ej: $5000 / 50 USD"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Precio promo</label>
              <input
                type="text"
                value={form.promo_price}
                onChange={(e) => set("promo_price", e.target.value)}
                placeholder="Ej: $4000"
                className={inputClass}
              />
            </div>
          </div>

          {/* Product-specific: stock */}
          {!isService && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Stock / Disponibilidad</label>
              <select
                value={form.stock_status}
                onChange={(e) => set("stock_status", e.target.value as StockStatus)}
                className={inputClass}
              >
                <option value="available">Disponible</option>
                <option value="unavailable">Sin stock</option>
                <option value="on_demand">Bajo pedido</option>
              </select>
            </div>
          )}

          {/* Product-specific: payment & financing */}
          {!isService && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Métodos de pago</label>
                <input
                  type="text"
                  value={form.payment_options}
                  onChange={(e) => set("payment_options", e.target.value)}
                  placeholder="Ej: Efectivo, transferencia, tarjeta"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Financiación / cuotas</label>
                <input
                  type="text"
                  value={form.financing_options}
                  onChange={(e) => set("financing_options", e.target.value)}
                  placeholder="Ej: 3 cuotas sin interés, 12 cuotas"
                  className={inputClass}
                />
              </div>
            </>
          )}

          {/* Service-specific: duration & booking */}
          {isService && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Duración</label>
                <input
                  type="text"
                  value={form.duration}
                  onChange={(e) => set("duration", e.target.value)}
                  placeholder="Ej: 30 min, 1 hora"
                  className={inputClass}
                />
              </div>
              <div className="flex items-center gap-3">
                <input
                  id="requires_booking"
                  type="checkbox"
                  checked={form.requires_booking}
                  onChange={(e) => set("requires_booking", e.target.checked)}
                  className="rounded border-gray-300 text-emerald-500 focus:ring-emerald-400"
                />
                <label htmlFor="requires_booking" className="text-sm text-gray-700">
                  Requiere turno / reserva previa
                </label>
              </div>
            </>
          )}

          {/* Status */}
          <div className="flex items-center gap-3">
            <input
              id="is_active"
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => set("is_active", e.target.checked)}
              className="rounded border-gray-300 text-emerald-500 focus:ring-emerald-400"
            />
            <label htmlFor="is_active" className="text-sm text-gray-700">
              Activo (visible para la IA y disponible para clientes)
            </label>
          </div>

          {/* Internal notes */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Nota interna
              <span className="ml-1 font-normal text-gray-400">(no se muestra al cliente ni a la IA)</span>
            </label>
            <textarea
              value={form.internal_notes}
              onChange={(e) => set("internal_notes", e.target.value)}
              rows={2}
              placeholder="Uso interno: proveedores, códigos, recordatorios..."
              className={`${inputClass} resize-none`}
            />
          </div>

          {error && (
            <p style={{ fontSize: 13, color: "var(--accent)", padding: "10px 14px", background: "#fff0ee", borderRadius: 12 }}>{error}</p>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", gap: 10, padding: "14px 20px", borderTop: "1px solid var(--hairline)", flexShrink: 0 }}>
          <button onClick={onClose} disabled={saving} className="atd-btn secondary" style={{ flex: 1 }}>Cancelar</button>
          <button
            onClick={() => onSave(form)}
            disabled={saving || !form.name.trim()}
            className="atd-btn primary"
            style={{ flex: 1 }}
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ItemCatalog() {
  const [state, setState] = useState<CatalogState>({
    items: [],
    count: 0,
    limit: 10,
    canAdd: true,
  });
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<CatalogItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    try {
      const res = await fetch("/api/business/items", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setState({ items: data.items ?? [], count: data.count ?? 0, limit: data.limit ?? 10, canAdd: data.canAdd ?? true });
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  function showSuccess(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  }

  async function handleSave(form: FormState) {
    setSaving(true);
    setFormError(null);
    try {
      const isEdit = !!editItem;
      const url = isEdit ? `/api/business/items/${editItem!.id}` : "/api/business/items";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formToBody(form)),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error ?? "Error guardando.");
        return;
      }
      setShowForm(false);
      setEditItem(null);
      await loadItems();
      showSuccess(isEdit ? "Cambios guardados." : "Producto/servicio creado.");
    } catch {
      setFormError("Error de conexión.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(itemId: string) {
    const res = await fetch(`/api/business/items/${itemId}`, { method: "DELETE" });
    if (res.ok) {
      setDeleteConfirmId(null);
      await loadItems();
      showSuccess("Eliminado correctamente.");
    }
  }

  async function handleToggle(item: CatalogItem) {
    setTogglingId(item.id);
    const res = await fetch(`/api/business/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !item.is_active }),
    });
    if (res.ok) {
      await loadItems();
      showSuccess(item.is_active ? "Desactivado." : "Activado.");
    }
    setTogglingId(null);
  }

  const filteredItems = state.items.filter((item) => {
    if (filterType !== "all" && item.item_type !== filterType) return false;
    if (filterStatus === "active" && !item.is_active) return false;
    if (filterStatus === "inactive" && item.is_active) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        (item.category ?? "").toLowerCase().includes(q) ||
        (item.description ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const pct = state.limit > 0 ? Math.min(100, (state.count / state.limit) * 100) : 0;
  const nearLimit = pct >= 80 && pct < 100;
  const atLimit = !state.canAdd;

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", background: "var(--bg)" }}>
        <div className="w-8 h-8 border-4 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div style={{ height: "100%", overflowY: "auto", background: "var(--bg)" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 0 100px" }}>

        {/* Header */}
        <div className="page-header">
          <div>
            <div className="page-sub">02 · catálogo</div>
            <h1 className="page-title">Productos y Servicios</h1>
          </div>
          <button
            onClick={() => { setEditItem(null); setFormError(null); setShowForm(true); }}
            disabled={atLimit}
            className="atd-btn primary sm"
          >
            + Agregar
          </button>
        </div>

        <div style={{ padding: "0 20px 6px", fontSize: 13, color: "var(--ink-3)" }}>
          Lo que cargues acá lo usa la IA para responder consultas de clientes.
        </div>

        {/* Success banner */}
        {successMsg && (
          <div style={{ margin: "10px 20px 0", padding: "10px 14px", borderRadius: 12, border: "1px solid var(--green)", background: "var(--green-tint)", fontSize: 13, color: "var(--green)" }}>
            {successMsg}
          </div>
        )}

        {/* Usage bar */}
        <div className="atd-card" style={{ margin: "12px 20px 0", padding: "14px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--ink-3)", marginBottom: 8 }}>
            <span>
              Items: <strong style={{ color: "var(--ink)" }}>{state.count} / {state.limit}</strong>
            </span>
            {nearLimit && !atLimit && <span style={{ color: "#7a5800", fontWeight: 500 }}>Casi al límite</span>}
            {atLimit && <span style={{ color: "#c0392b", fontWeight: 500 }}>Límite alcanzado</span>}
          </div>
          <div style={{ height: 6, borderRadius: 99, background: "var(--surface-2)", overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 99,
              background: atLimit ? "#c0392b" : nearLimit ? "#d97706" : "var(--green)",
              width: `${pct}%`, transition: "width 0.3s",
            }} />
          </div>
          {atLimit && (
            <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <p style={{ fontSize: 12, color: "#c0392b" }}>Alcanzaste el límite de tu plan. Mejorá para agregar más.</p>
              <Link href="/app/plan" style={{ fontSize: 12, fontWeight: 600, color: "var(--green)", whiteSpace: "nowrap" }}>Mejorar plan →</Link>
            </div>
          )}
        </div>

        {/* Filters */}
        <div style={{ padding: "12px 20px 0", display: "flex", flexDirection: "column", gap: 8 }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, categoría o descripción..."
            className="atd-input"
          />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(["all", "product", "service"] as FilterType[]).map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className="atd-pill"
                style={{
                  background: filterType === t ? "var(--ink)" : "var(--surface)",
                  color: filterType === t ? "#fff" : "var(--ink-2)",
                  border: filterType === t ? "none" : "1px solid var(--hairline)",
                  cursor: "pointer", fontSize: 12,
                }}
              >
                {t === "all" ? "Todos" : t === "product" ? "Productos" : "Servicios"}
              </button>
            ))}
            <div style={{ width: 1, background: "var(--hairline)", alignSelf: "stretch" }} />
            {(["all", "active", "inactive"] as FilterStatus[]).map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className="atd-pill"
                style={{
                  background: filterStatus === s ? "var(--ink)" : "var(--surface)",
                  color: filterStatus === s ? "#fff" : "var(--ink-2)",
                  border: filterStatus === s ? "none" : "1px solid var(--hairline)",
                  cursor: "pointer", fontSize: 12,
                }}
              >
                {s === "all" ? "Cualquier estado" : s === "active" ? "Activos" : "Inactivos"}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div style={{ padding: "12px 20px 0" }}>
          {filteredItems.length === 0 ? (
            <div style={{ padding: "48px 20px", textAlign: "center", border: "2px dashed var(--hairline)", borderRadius: 18, background: "var(--surface)" }}>
              {state.items.length === 0 ? (
                <>
                  <p style={{ fontSize: 28, marginBottom: 10 }}>📦</p>
                  <p style={{ fontSize: 14, fontWeight: 500, color: "var(--ink-2)" }}>
                    Todavía no cargaste productos o servicios.
                  </p>
                  <p style={{ marginTop: 4, fontSize: 13, color: "var(--ink-3)" }}>
                    Agregá lo que vendés para que tu asistente pueda responder mejor.
                  </p>
                  <button
                    onClick={() => { setEditItem(null); setFormError(null); setShowForm(true); }}
                    disabled={atLimit}
                    className="atd-btn primary sm"
                    style={{ marginTop: 16 }}
                  >
                    Agregar el primero
                  </button>
                </>
              ) : (
                <>
                  <p style={{ fontSize: 13, color: "var(--ink-3)" }}>No hay resultados para los filtros seleccionados.</p>
                  <button
                    onClick={() => { setSearch(""); setFilterType("all"); setFilterStatus("all"); }}
                    style={{ marginTop: 8, fontSize: 13, color: "var(--green)", background: "none", border: "none", cursor: "pointer" }}
                  >
                    Limpiar filtros
                  </button>
                </>
              )}
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
              {filteredItems.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onEdit={() => {
                    setEditItem(item);
                    setFormError(null);
                    setShowForm(true);
                  }}
                  onDelete={() => setDeleteConfirmId(item.id)}
                  onToggle={() => handleToggle(item)}
                  toggling={togglingId === item.id}
                />
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Item form overlay */}
      {showForm && (
        <ItemForm
          initial={editItem ? itemToForm(editItem) : EMPTY_FORM}
          saving={saving}
          error={formError}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditItem(null); }}
        />
      )}

      {/* Delete confirmation */}
      {deleteConfirmId && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div className="atd-card" style={{ width: "100%", maxWidth: 360, padding: 24 }}>
            <h4 style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>
              ¿Eliminar este producto/servicio?
            </h4>
            <p style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 20 }}>
              La acción no se puede deshacer. Los datos serán eliminados permanentemente.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setDeleteConfirmId(null)} className="atd-btn secondary" style={{ flex: 1 }}>Cancelar</button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                style={{ flex: 1, padding: "10px 16px", borderRadius: 12, background: "#c0392b", color: "#fff", fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer" }}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
