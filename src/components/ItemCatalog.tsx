"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
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

const inputClass =
  "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-400";

const STOCK_LABELS: Record<StockStatus, string> = {
  available: "Disponible",
  unavailable: "Sin stock",
  on_demand: "Bajo pedido",
};

const STOCK_COLORS: Record<StockStatus, string> = {
  available: "bg-emerald-100 text-emerald-700",
  unavailable: "bg-red-100 text-red-700",
  on_demand: "bg-amber-100 text-amber-700",
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
    <div
      className={`bg-white rounded-2xl border p-4 space-y-3 transition-opacity ${
        item.is_active ? "border-gray-200" : "border-gray-100 opacity-60"
      }`}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-900 truncate">{item.name}</p>
            <span
              className={`shrink-0 text-xs px-1.5 py-0.5 rounded-md font-medium ${
                item.item_type === "service"
                  ? "bg-purple-100 text-purple-700"
                  : "bg-blue-100 text-blue-700"
              }`}
            >
              {item.item_type === "service" ? "Servicio" : "Producto"}
            </span>
            {!item.is_active && (
              <span className="shrink-0 text-xs px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-500 font-medium">
                Inactivo
              </span>
            )}
          </div>
          {item.category && (
            <p className="text-xs text-gray-500 mt-0.5">{item.category}</p>
          )}
        </div>

        {item.stock_status && item.stock_status !== "available" && (
          <span
            className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
              STOCK_COLORS[item.stock_status]
            }`}
          >
            {STOCK_LABELS[item.stock_status]}
          </span>
        )}
      </div>

      {/* Price */}
      {(item.price || item.promo_price) && (
        <div className="flex items-center gap-2">
          {item.price && (
            <p
              className={`text-sm font-semibold ${
                item.promo_price ? "line-through text-gray-400" : "text-gray-900"
              }`}
            >
              {item.price}
            </p>
          )}
          {item.promo_price && (
            <p className="text-sm font-semibold text-emerald-600">{item.promo_price}</p>
          )}
        </div>
      )}

      {/* Description */}
      {item.description && (
        <p className="text-xs text-gray-500 line-clamp-2">{item.description}</p>
      )}

      {/* Service specifics */}
      {item.item_type === "service" && (item.duration || item.requires_booking) && (
        <div className="flex items-center gap-3 text-xs text-gray-500">
          {item.duration && <span>⏱ {item.duration}</span>}
          {item.requires_booking && <span>📅 Requiere turno</span>}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
        <button
          onClick={onEdit}
          className="flex-1 py-1.5 text-xs font-medium text-gray-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
        >
          Editar
        </button>
        <button
          onClick={onToggle}
          disabled={toggling}
          className="flex-1 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50"
        >
          {toggling ? "..." : item.is_active ? "Desactivar" : "Activar"}
        </button>
        <button
          onClick={onDelete}
          className="flex-1 py-1.5 text-xs font-medium text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
        >
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
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <h3 className="text-base font-semibold text-gray-900">
            {initial.name ? "Editar" : "Nuevo"}{" "}
            {form.item_type === "service" ? "servicio" : "producto"}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {/* Type tabs */}
          <div className="flex rounded-xl border border-gray-200 overflow-hidden">
            {(["product", "service"] as CatalogItemType[]).map((t) => (
              <button
                key={t}
                onClick={() => set("item_type", t)}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  form.item_type === t
                    ? "bg-emerald-500 text-white"
                    : "text-gray-500 hover:bg-gray-50"
                }`}
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
            <p className="text-sm text-red-600 p-3 bg-red-50 rounded-xl">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-4 border-t border-gray-100 shrink-0">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={saving || !form.name.trim()}
            className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-medium transition-colors"
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
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* Header */}
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-600">
              Catálogo
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-gray-900">
              Productos y Servicios
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Lo que cargues acá lo usa la IA para responder consultas de clientes.
            </p>
          </div>
          <button
            onClick={() => {
              setEditItem(null);
              setFormError(null);
              setShowForm(true);
            }}
            disabled={atLimit}
            className="shrink-0 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
          >
            + Agregar
          </button>
        </div>

        {/* Success banner */}
        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">
            {successMsg}
          </div>
        )}

        {/* Usage bar */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="flex justify-between text-xs text-gray-500 mb-2">
            <span>
              Productos y servicios:{" "}
              <strong className="text-gray-900">
                {state.count} / {state.limit}
              </strong>
            </span>
            {nearLimit && !atLimit && (
              <span className="text-amber-600 font-medium">Casi al límite</span>
            )}
            {atLimit && (
              <span className="text-red-600 font-medium">Límite alcanzado</span>
            )}
          </div>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                atLimit ? "bg-red-500" : nearLimit ? "bg-amber-400" : "bg-emerald-500"
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {atLimit && (
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-red-700">
                Alcanzaste el límite de tu plan. Mejorá para agregar más.
              </p>
              <Link
                href="/app/plan"
                className="shrink-0 text-xs font-semibold text-emerald-600 hover:underline"
              >
                Mejorar plan →
              </Link>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="space-y-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, categoría o descripción..."
            className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
          <div className="flex gap-2 flex-wrap">
            {/* Type filter */}
            {(["all", "product", "service"] as FilterType[]).map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  filterType === t
                    ? "bg-gray-800 text-white"
                    : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {t === "all" ? "Todos" : t === "product" ? "Productos" : "Servicios"}
              </button>
            ))}
            <div className="w-px bg-gray-200 self-stretch" />
            {/* Status filter */}
            {(["all", "active", "inactive"] as FilterStatus[]).map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  filterStatus === s
                    ? "bg-gray-800 text-white"
                    : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {s === "all" ? "Cualquier estado" : s === "active" ? "Activos" : "Inactivos"}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        {filteredItems.length === 0 ? (
          <div className="py-16 text-center border-2 border-dashed border-gray-200 rounded-2xl bg-white">
            {state.items.length === 0 ? (
              <>
                <p className="text-3xl mb-3">📦</p>
                <p className="text-sm font-medium text-gray-700">
                  Todavía no cargaste productos o servicios.
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  Agregá lo que vendés para que tu asistente pueda responder mejor.
                </p>
                <button
                  onClick={() => { setEditItem(null); setFormError(null); setShowForm(true); }}
                  disabled={atLimit}
                  className="mt-4 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium px-5 py-2 rounded-xl transition-colors disabled:opacity-50"
                >
                  Agregar el primero
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-500">
                  No hay resultados para los filtros seleccionados.
                </p>
                <button
                  onClick={() => { setSearch(""); setFilterType("all"); setFilterStatus("all"); }}
                  className="mt-2 text-sm text-emerald-600 hover:underline"
                >
                  Limpiar filtros
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
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
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h4 className="text-base font-semibold text-gray-900 mb-2">
              ¿Eliminar este producto/servicio?
            </h4>
            <p className="text-sm text-gray-500 mb-5">
              La acción no se puede deshacer. Los datos serán eliminados permanentemente.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-medium"
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
