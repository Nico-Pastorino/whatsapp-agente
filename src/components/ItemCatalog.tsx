"use client";

import Link from "next/link";
import React, { useCallback, useEffect, useState } from "react";
import type { CatalogItem, CatalogItemType, StockStatus } from "@/lib/db";
import DashboardContentShell from "./DashboardContentShell";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CatalogState {
  items: CatalogItem[];
  count: number;
  limit: number;
  canAdd: boolean;
}

type TabFilter = "all" | "product" | "service" | "promotion" | "featured";
type ImportField = "ignore" | "name" | "price" | "description" | "category" | "stock_status" | "notes" | "item_type";

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
  is_featured: boolean;
  promotion_label: string;
  promotion_ends_at: string;
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
  is_featured: false,
  promotion_label: "",
  promotion_ends_at: "",
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
    is_featured: form.is_featured,
    promotion_label: form.promotion_label || null,
    promotion_ends_at: form.promotion_ends_at || null,
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
    is_featured: item.is_featured,
    promotion_label: item.promotion_label ?? "",
    promotion_ends_at: item.promotion_ends_at
      ? new Date(item.promotion_ends_at).toISOString().slice(0, 16)
      : "",
  };
}

function isPromoActive(item: CatalogItem): boolean {
  if (!item.promotion_label) return false;
  if (!item.promotion_ends_at) return true;
  return new Date(item.promotion_ends_at).getTime() > Date.now();
}

// ── Input class ───────────────────────────────────────────────────────────────

const inputClass = "atd-input";

const STOCK_LABELS: Record<StockStatus, string> = {
  available: "Disponible",
  unavailable: "Sin stock",
  on_demand: "Bajo pedido",
};

const IMPORT_FIELD_LABELS: Record<ImportField, string> = {
  ignore: "Ignorar",
  name: "Nombre",
  price: "Precio",
  description: "Descripción",
  category: "Categoría",
  stock_status: "Stock",
  notes: "Notas",
  item_type: "Tipo",
};

interface ImportPreviewItem {
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

interface ImportPreview {
  headers: string[];
  mapping: Record<string, ImportField>;
  items: ImportPreviewItem[];
  summary: {
    total: number;
    ready: number;
    needs_review: number;
    duplicate: number;
    empty: number;
  };
}

// ── Summary Cards ─────────────────────────────────────────────────────────────

// ── Item Card ─────────────────────────────────────────────────────────────────

function ItemCard({
  item,
  onEdit,
  onDelete,
  onToggleActive,
  onToggleFeatured,
  onDuplicate,
  toggling,
  featuringId,
}: {
  item: CatalogItem;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
  onToggleFeatured: () => void;
  onDuplicate: () => void;
  toggling: boolean;
  featuringId: string | null;
}) {
  const promoActive = isPromoActive(item);
  const featuring = featuringId === item.id;

  return (
    <div
      className="atd-card"
      style={{
        padding: 0,
        overflow: "hidden",
        opacity: item.is_active ? 1 : 0.65,
        border: item.is_featured ? "1px solid #f59e0b" : "1px solid var(--hairline)",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Featured banner */}
      {item.is_featured && (
        <div
          style={{
            background: "linear-gradient(90deg, #f59e0b, #fbbf24)",
            padding: "4px 12px",
            fontSize: 10,
            fontWeight: 700,
            color: "#fff",
            letterSpacing: "0.5px",
            textTransform: "uppercase",
          }}
        >
          Destacado · el asistente lo prioriza
        </div>
      )}

      {/* Promo banner */}
      {promoActive && (
        <div
          style={{
            background: "linear-gradient(90deg, #10b981, #34d399)",
            padding: "4px 12px",
            fontSize: 10,
            fontWeight: 700,
            color: "#fff",
          }}
        >
          🏷️ {item.promotion_label}
          {item.promotion_ends_at &&
            ` · hasta ${new Date(item.promotion_ends_at).toLocaleDateString("es-AR")}`}
        </div>
      )}

      {/* Body */}
      <div style={{ padding: 18, flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <p style={{ fontSize: 15, fontWeight: 750, color: "var(--ink)", margin: 0, lineHeight: 1.25 }}>
                {item.name}
              </p>
              <span
                className="atd-pill"
                style={{
                  fontSize: 10,
                  background: item.item_type === "service" ? "#f0e8ff" : "#e8f0ff",
                  color: item.item_type === "service" ? "#7c3aed" : "#1d4ed8",
                  border: "none",
                }}
              >
                {item.item_type === "service" ? "Servicio" : "Producto"}
              </span>
              {!item.is_active && (
                <span
                  className="atd-pill"
                  style={{ fontSize: 10, background: "var(--surface-2)", color: "var(--muted)", border: "none" }}
                >
                  Pausado
                </span>
              )}
            </div>
            {item.category && (
              <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 4 }}>{item.category}</p>
            )}
          </div>

          {/* Featured star toggle */}
          <button
            onClick={onToggleFeatured}
            disabled={featuring}
            title={item.is_featured ? "Quitar destacado" : "Destacar"}
            style={{
              flexShrink: 0,
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 18,
              opacity: featuring ? 0.5 : 1,
              lineHeight: 1,
              padding: 2,
              color: item.is_featured ? "#f59e0b" : "var(--hairline)",
              filter: item.is_featured ? "none" : "grayscale(1)",
              transition: "color 0.2s, filter 0.2s",
            }}
          >
            ⭐
          </button>
        </div>

        {/* Precio */}
        {(item.price || item.promo_price) && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {item.price && (
              <p
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: item.promo_price ? "var(--muted)" : "var(--ink)",
                  textDecoration: item.promo_price ? "line-through" : "none",
                  margin: 0,
                }}
              >
                {item.price}
              </p>
            )}
            {item.promo_price && (
              <p style={{ fontSize: 15, fontWeight: 700, color: "var(--green)", margin: 0 }}>
                {item.promo_price}
              </p>
            )}
          </div>
        )}

        {/* Description */}
        {item.description && (
          <p
            style={{
              fontSize: 13,
              color: "var(--ink-3)",
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical" as const,
              margin: 0,
            }}
          >
            {item.description}
          </p>
        )}

        {/* Service details */}
        {item.item_type === "service" && (item.duration || item.requires_booking) && (
          <div style={{ display: "flex", gap: 10, fontSize: 11.5, color: "var(--muted)" }}>
            {item.duration && <span>⏱ {item.duration}</span>}
            {item.requires_booking && <span>📅 Requiere reserva</span>}
          </div>
        )}

        {/* Stock status */}
        {item.stock_status && item.stock_status !== "available" && (
          <span
            className="atd-pill"
            style={{
              fontSize: 10,
              alignSelf: "flex-start",
              border: "none",
              background: item.stock_status === "unavailable" ? "#ffeaea" : "#fff3cd",
              color: item.stock_status === "unavailable" ? "#c0392b" : "#7a5800",
            }}
          >
            {STOCK_LABELS[item.stock_status]}
          </span>
        )}

        {/* Assistant visibility badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
              fontSize: 12,
            color: item.is_active ? "var(--green)" : "var(--muted)",
            background: item.is_active ? "var(--green-tint)" : "var(--surface-2)",
            padding: "4px 8px",
            borderRadius: 8,
            alignSelf: "flex-start",
          }}
        >
          {item.is_active ? "Visible para el asistente" : "Pausado para el asistente"}
        </div>
      </div>

      {/* Action row */}
      <div style={{ display: "flex", borderTop: "1px solid var(--hairline)", flexWrap: "wrap" }}>
        {[
          { label: "Editar", onClick: onEdit, color: "var(--ink-2)" },
          { label: "Duplicar", onClick: onDuplicate, color: "var(--muted)" },
          {
            label: toggling ? "..." : item.is_active ? "Pausar" : "Activar",
            onClick: onToggleActive,
            color: "var(--muted)",
            disabled: toggling,
          },
          { label: "Eliminar", onClick: onDelete, color: "#c0392b" },
        ].map((action, i) => (
          <button
            key={i}
            onClick={action.onClick}
            disabled={"disabled" in action && action.disabled}
            style={{
              flex: 1,
              minWidth: 78,
              padding: "12px 6px",
              fontSize: 12,
              fontWeight: 600,
              color: action.color,
              background: "none",
              border: "none",
              borderRight: i < 3 ? "1px solid var(--hairline)" : "none",
              cursor: "pointer",
              opacity: ("disabled" in action && action.disabled) ? 0.5 : 1,
            }}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Form Step 1: Tipo ─────────────────────────────────────────────────────────

function TypeStep({
  value,
  onChange,
}: {
  value: CatalogItemType;
  onChange: (t: CatalogItemType) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", textAlign: "center", margin: 0 }}>
        ¿Qué querés agregar?
      </p>
      {(["product", "service"] as CatalogItemType[]).map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          style={{
            padding: "18px 20px",
            borderRadius: 14,
            border: value === t ? "2px solid var(--green)" : "1px solid var(--hairline)",
            background: value === t ? "var(--green-tint)" : "var(--surface)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 14,
            textAlign: "left",
            transition: "border-color 0.15s, background 0.15s",
          }}
        >
          <span style={{ fontSize: 28 }}>{t === "product" ? "📦" : "🛠️"}</span>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", margin: 0 }}>
              {t === "product" ? "Producto" : "Servicio"}
            </p>
            <p style={{ fontSize: 12, color: "var(--muted)", margin: 0, marginTop: 2 }}>
              {t === "product"
                ? "Algo físico o digital que vendés"
                : "Una actividad o tarea que ofrecés"}
            </p>
          </div>
          {value === t && (
            <span style={{ marginLeft: "auto", color: "var(--green)", fontSize: 18 }}>✓</span>
          )}
        </button>
      ))}
    </div>
  );
}

// ── Item Form (full overlay) ──────────────────────────────────────────────────

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
  const [step, setStep] = useState<"type" | "fields">(initial.name ? "fields" : "type");

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const isService = form.item_type === "service";
  const isEdit = !!initial.name;

  function handleTypeSelect(t: CatalogItemType) {
    set("item_type", t);
    setStep("fields");
  }

  return (
    <div className="atd-overlay sheet" style={{ zIndex: 140 }}>
      <div
        className="atd-modal"
        style={{
          width: "100%",
          maxWidth: 540,
          display: "flex",
          flexDirection: "column",
          maxHeight: "92svh",
          padding: 0,
        }}
      >
        <div className="atd-sheet-grabber md:hidden" />
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid var(--hairline)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {step === "fields" && !isEdit && (
              <button
                onClick={() => setStep("type")}
                style={{
                  fontSize: 18,
                  color: "var(--muted)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  lineHeight: 1,
                }}
              >
                ←
              </button>
            )}
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", margin: 0 }}>
              {isEdit
                ? `Editar ${isService ? "servicio" : "producto"}`
                : step === "type"
                ? "Agregar al catálogo"
                : `Nuevo ${isService ? "servicio" : "producto"}`}
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{ fontSize: 22, lineHeight: 1, color: "var(--muted)", background: "none", border: "none", cursor: "pointer" }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            overflowY: "auto",
            flex: 1,
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {step === "type" ? (
            <TypeStep value={form.item_type} onChange={handleTypeSelect} />
          ) : (
            <>
              {/* Type switcher when editing */}
              {isEdit && (
                <div className="atd-seg">
                  {(["product", "service"] as CatalogItemType[]).map((t) => (
                    <button key={t} onClick={() => set("item_type", t)} className={form.item_type === t ? "active" : ""}>
                      {t === "product" ? "Producto" : "Servicio"}
                    </button>
                  ))}
                </div>
              )}

              {/* Name */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-2)", marginBottom: 6 }}>
                  Nombre <span style={{ color: "var(--accent)" }}>*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder={isService ? "Ej: Corte de pelo" : "Ej: iPhone 15 Pro"}
                  className={inputClass}
                  autoFocus
                />
              </div>

              {/* Category */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-2)", marginBottom: 6 }}>
                  Categoría
                </label>
                <input
                  type="text"
                  value={form.category}
                  onChange={(e) => set("category", e.target.value)}
                  placeholder={isService ? "Ej: Corte, Color, Tratamiento" : "Ej: Smartphones, Accesorios"}
                  className={inputClass}
                />
              </div>

              {/* Price row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-2)", marginBottom: 6 }}>
                    Precio
                  </label>
                  <input
                    type="text"
                    value={form.price}
                    onChange={(e) => set("price", e.target.value)}
                    placeholder="Ej: $5.000 / 50 USD"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-2)", marginBottom: 6 }}>
                    Precio promo
                  </label>
                  <input
                    type="text"
                    value={form.promo_price}
                    onChange={(e) => set("promo_price", e.target.value)}
                    placeholder="Ej: $4.000"
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-2)", marginBottom: 6 }}>
                  Descripción{" "}
                  <span style={{ fontSize: 11, fontWeight: 400, color: "var(--muted)" }}>
                    (tu asistente usa esto para responder)
                  </span>
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  rows={2}
                  placeholder="Describí brevemente este producto/servicio"
                  className={`${inputClass} resize-none`}
                />
              </div>

              {/* Product-specific */}
              {!isService && (
                <>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-2)", marginBottom: 6 }}>
                      Stock / Disponibilidad
                    </label>
                    <select
                      value={form.stock_status}
                      onChange={(e) => set("stock_status", e.target.value as StockStatus)}
                      className={inputClass}
                    >
                      <option value="available">✓ Disponible</option>
                      <option value="unavailable">✗ Sin stock</option>
                      <option value="on_demand">→ Bajo pedido</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-2)", marginBottom: 6 }}>
                      Métodos de pago
                    </label>
                    <input
                      type="text"
                      value={form.payment_options}
                      onChange={(e) => set("payment_options", e.target.value)}
                      placeholder="Ej: Efectivo, transferencia, tarjeta"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-2)", marginBottom: 6 }}>
                      Financiación / cuotas
                    </label>
                    <input
                      type="text"
                      value={form.financing_options}
                      onChange={(e) => set("financing_options", e.target.value)}
                      placeholder="Ej: 3 cuotas sin interés, 12 cuotas con Visa"
                      className={inputClass}
                    />
                  </div>
                </>
              )}

              {/* Service-specific */}
              {isService && (
                <>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-2)", marginBottom: 6 }}>
                      Duración estimada
                    </label>
                    <input
                      type="text"
                      value={form.duration}
                      onChange={(e) => set("duration", e.target.value)}
                      placeholder="Ej: 30 min, 1 hora"
                      className={inputClass}
                    />
                  </div>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      cursor: "pointer",
                      fontSize: 13,
                      color: "var(--ink)",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={form.requires_booking}
                      onChange={(e) => set("requires_booking", e.target.checked)}
                    />
                    Requiere turno / reserva previa
                  </label>
                </>
              )}

              {/* Promotion section */}
              <div
                style={{
                  borderTop: "1px solid var(--hairline)",
                  paddingTop: 14,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <p style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-2)", margin: 0, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  🏷️ Promoción
                </p>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-2)", marginBottom: 6 }}>
                    Etiqueta de promoción
                  </label>
                  <input
                    type="text"
                    value={form.promotion_label}
                    onChange={(e) => set("promotion_label", e.target.value)}
                    placeholder="Ej: Hot Sale, 12 cuotas sin interés"
                    className={inputClass}
                  />
                </div>
                {form.promotion_label && (
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-2)", marginBottom: 6 }}>
                      Válida hasta
                      <span style={{ fontSize: 11, fontWeight: 400, color: "var(--muted)", marginLeft: 6 }}>
                        (dejar vacío = sin vencimiento)
                      </span>
                    </label>
                    <input
                      type="datetime-local"
                      value={form.promotion_ends_at}
                      onChange={(e) => set("promotion_ends_at", e.target.value)}
                      className={inputClass}
                    />
                  </div>
                )}
              </div>

              {/* Options */}
              <div
                style={{
                  borderTop: "1px solid var(--hairline)",
                  paddingTop: 14,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    cursor: "pointer",
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid var(--hairline)",
                    background: form.is_featured ? "#fffbeb" : "var(--surface)",
                    fontSize: 13,
                    color: "var(--ink)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={form.is_featured}
                    onChange={(e) => set("is_featured", e.target.checked)}
                  />
                  <div>
                    <p style={{ margin: 0, fontWeight: 600 }}>⭐ Destacado</p>
                    <p style={{ margin: 0, fontSize: 11, color: "var(--muted)" }}>
                      Tu asistente lo mencionará primero ante consultas relevantes
                    </p>
                  </div>
                </label>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    cursor: "pointer",
                    fontSize: 13,
                    color: "var(--ink)",
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid var(--hairline)",
                    background: form.is_active ? "var(--green-tint)" : "var(--surface)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => set("is_active", e.target.checked)}
                  />
                  <div>
                    <p style={{ margin: 0, fontWeight: 600 }}>
                      {form.is_active ? "✓ Activo" : "○ Inactivo"}
                    </p>
                    <p style={{ margin: 0, fontSize: 11, color: "var(--muted)" }}>
                      Solo los productos y servicios activos son visibles para tu asistente
                    </p>
                  </div>
                </label>
              </div>

              {/* Internal notes */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-2)", marginBottom: 6 }}>
                  Nota interna{" "}
                  <span style={{ fontSize: 11, fontWeight: 400, color: "var(--muted)" }}>
                    (no se muestra al cliente ni al asistente)
                  </span>
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
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: 10,
                    background: "#fff0ee",
                    border: "1px solid #fca5a5",
                    fontSize: 13,
                    color: "#b91c1c",
                  }}
                >
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {step === "fields" && (
          <div
            style={{
              display: "flex",
              gap: 10,
              padding: "14px 20px",
              borderTop: "1px solid var(--hairline)",
              flexShrink: 0,
            }}
          >
            <button onClick={onClose} disabled={saving} className="atd-btn secondary" style={{ flex: 1 }}>
              Cancelar
            </button>
            <button
              onClick={() => onSave(form)}
              disabled={saving || !form.name.trim()}
              className="atd-btn primary"
              style={{ flex: 2 }}
            >
              {saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Agregar al catálogo"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ImportModal({
  busy,
  error,
  preview,
  onPreview,
  onMappingChange,
  onCommit,
  onClose,
}: {
  busy: boolean;
  error: string | null;
  preview: ImportPreview | null;
  onPreview: (file: File, defaultType: CatalogItemType, mapping?: Record<string, ImportField>) => void;
  onMappingChange: (mapping: Record<string, ImportField>) => void;
  onCommit: () => void;
  onClose: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [defaultType, setDefaultType] = useState<CatalogItemType>("product");

  const visibleItems = preview?.items.filter((item) => item.status !== "empty").slice(0, 80) ?? [];
  const saveable = preview?.items.filter((item) => item.status !== "duplicate" && item.status !== "empty" && item.name).length ?? 0;

  return (
    <div className="atd-overlay sheet" style={{ zIndex: 140 }}>
      <div className="atd-modal" style={{ width: "100%", maxWidth: 980, maxHeight: "92svh", padding: 0, display: "flex", flexDirection: "column" }}>
        <div className="atd-sheet-grabber md:hidden" />
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--hairline)", display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--ink)" }}>Importar catálogo</h3>
            <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "4px 0 0" }}>
              Excel, CSV o TSV. Primero revisás la vista previa y después se guarda en productos/servicios.
            </p>
          </div>
          <button onClick={onClose} style={{ fontSize: 22, lineHeight: 1, color: "var(--muted)", background: "none", border: "none", cursor: "pointer" }}>×</button>
        </div>

        <div style={{ overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="atd-card" style={{ padding: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 180px auto", gap: 10, alignItems: "end" }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-2)", marginBottom: 6 }}>Archivo</label>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,.tsv"
                  className="atd-input"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-2)", marginBottom: 6 }}>Tipo por defecto</label>
                <select className="atd-input" value={defaultType} onChange={(event) => setDefaultType(event.target.value as CatalogItemType)}>
                  <option value="product">Producto</option>
                  <option value="service">Servicio</option>
                </select>
              </div>
              <button
                className="atd-btn primary"
                disabled={!file || busy}
                onClick={() => file && onPreview(file, defaultType, preview?.mapping)}
              >
                {busy ? "Leyendo..." : "Vista previa"}
              </button>
            </div>
          </div>

          {error && (
            <div style={{ padding: "10px 14px", borderRadius: 10, background: "#fff0ee", border: "1px solid #fca5a5", fontSize: 13, color: "#b91c1c" }}>
              {error}
            </div>
          )}

          {preview && (
            <>
              <div className="atd-card" style={{ padding: 14 }}>
                <p style={{ fontSize: 13, fontWeight: 700, margin: "0 0 10px", color: "var(--ink)" }}>Columnas detectadas</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                  {preview.headers.map((header) => (
                    <label key={header} style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12, color: "var(--ink-3)" }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{header}</span>
                      <select
                        className="atd-input"
                        value={preview.mapping[header] ?? "ignore"}
                        onChange={(event) => {
                          const next = { ...preview.mapping, [header]: event.target.value as ImportField };
                          onMappingChange(next);
                          if (file) onPreview(file, defaultType, next);
                        }}
                      >
                        {(Object.keys(IMPORT_FIELD_LABELS) as ImportField[]).map((field) => (
                          <option key={field} value={field}>{IMPORT_FIELD_LABELS[field]}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                {[
                  ["Listos", preview.summary.ready],
                  ["Revisar", preview.summary.needs_review],
                  ["Duplicados", preview.summary.duplicate],
                  ["Vacíos", preview.summary.empty],
                ].map(([label, value]) => (
                  <div key={label} className="atd-card" style={{ padding: 12 }}>
                    <p style={{ fontSize: 20, fontWeight: 750, margin: 0, color: "var(--ink)" }}>{value}</p>
                    <p style={{ fontSize: 12, color: "var(--muted)", margin: "2px 0 0" }}>{label}</p>
                  </div>
                ))}
              </div>

              <div className="atd-card" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                    <thead>
                      <tr style={{ background: "var(--surface-2)", color: "var(--ink-2)", textAlign: "left" }}>
                        {["Fila", "Estado", "Nombre", "Precio", "Descripción", "Categoría", "Stock", "Notas"].map((head) => (
                          <th key={head} style={{ padding: "10px 12px", fontWeight: 700, whiteSpace: "nowrap" }}>{head}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visibleItems.map((item) => (
                        <tr key={item.row} style={{ borderTop: "1px solid var(--hairline)" }}>
                          <td style={{ padding: "10px 12px", color: "var(--muted)" }}>{item.row}</td>
                          <td style={{ padding: "10px 12px", minWidth: 120 }}>
                            <span className="atd-pill" style={{
                              border: "none",
                              fontSize: 10,
                              background: item.status === "ready" ? "var(--green-tint)" : item.status === "duplicate" ? "#fff3cd" : "#fff0ee",
                              color: item.status === "ready" ? "var(--green)" : item.status === "duplicate" ? "#7a5800" : "#b91c1c",
                            }}>
                              {item.status === "ready" ? "Listo" : item.status === "duplicate" ? "Duplicado" : "Revisar"}
                            </span>
                            {item.warnings.length > 0 && (
                              <p style={{ margin: "5px 0 0", color: "var(--muted)", fontSize: 11 }}>{item.warnings.join(" ")}</p>
                            )}
                          </td>
                          <td style={{ padding: "10px 12px", minWidth: 150, color: "var(--ink)" }}>{item.name || "—"}</td>
                          <td style={{ padding: "10px 12px", minWidth: 100 }}>{item.price || "—"}</td>
                          <td style={{ padding: "10px 12px", minWidth: 220 }}>{item.description || "—"}</td>
                          <td style={{ padding: "10px 12px", minWidth: 120 }}>{item.category || "—"}</td>
                          <td style={{ padding: "10px 12px", minWidth: 100 }}>{STOCK_LABELS[item.stock_status]}</td>
                          <td style={{ padding: "10px 12px", minWidth: 160 }}>{item.notes || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        <div style={{ padding: "14px 20px", borderTop: "1px solid var(--hairline)", display: "flex", justifyContent: "space-between", gap: 12 }}>
          <button className="atd-btn secondary" onClick={onClose} disabled={busy}>Cancelar</button>
          <button className="atd-btn primary" onClick={onCommit} disabled={!preview || saveable === 0 || busy}>
            {busy ? "Importando..." : `Guardar ${saveable}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ItemCatalog() {
  const [state, setState] = useState<CatalogState>({
    items: [],
    count: 0,
    limit: 10,
    canAdd: true,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<CatalogItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [featuringId, setFeaturingId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);

  const loadItems = useCallback(async () => {
    try {
      setLoadError(false);
      const res = await fetch("/api/business/items", { cache: "no-store" });
      if (!res.ok) {
        setLoadError(true);
        return;
      }
      const data = await res.json();
      setState({
        items: data.items ?? [],
        count: data.count ?? 0,
        limit: data.limit ?? 10,
        canAdd: data.canAdd ?? true,
      });
      setLastUpdated(new Date());
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  function showSuccess(msg: string) {
    setActionError(null);
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3500);
  }

  async function getErrorMessage(res: Response, fallback: string): Promise<string> {
    try {
      const data = await res.json();
      return typeof data.error === "string" ? data.error : fallback;
    } catch {
      return fallback;
    }
  }

  async function handleSave(form: FormState) {
    setSaving(true);
    setFormError(null);
    setActionError(null);
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
        setFormError(data.error ?? "Error guardando. Intentá de nuevo.");
        return;
      }
      setShowForm(false);
      setEditItem(null);
      await loadItems();
      const itemLabel = form.item_type === "service" ? "Servicio" : "Producto";
      showSuccess(isEdit ? "Cambios guardados." : `${itemLabel} guardado.`);
    } catch {
      setFormError("Error de conexión. Revisá tu internet e intentá de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(itemId: string) {
    setActionError(null);
    const res = await fetch(`/api/business/items/${itemId}`, { method: "DELETE" });
    if (res.ok) {
      setDeleteConfirmId(null);
      await loadItems();
      showSuccess("Eliminado correctamente.");
    } else {
      setActionError(await getErrorMessage(res, "No se pudo eliminar. Intentá de nuevo."));
    }
  }

  async function handleToggleActive(item: CatalogItem) {
    setTogglingId(item.id);
    setActionError(null);
    const res = await fetch(`/api/business/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !item.is_active }),
    });
    if (res.ok) {
      await loadItems();
      showSuccess(item.is_active ? "Pausado." : "Activo.");
    } else {
      setActionError(await getErrorMessage(res, "No se pudo guardar el cambio. Intentá de nuevo."));
    }
    setTogglingId(null);
  }

  async function handleToggleFeatured(item: CatalogItem) {
    setFeaturingId(item.id);
    setActionError(null);
    const res = await fetch(`/api/business/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_featured: !item.is_featured }),
    });
    if (res.ok) {
      await loadItems();
      showSuccess(item.is_featured ? "Quitado de destacados." : "Marcado como destacado.");
    } else {
      setActionError(await getErrorMessage(res, "No se pudo guardar el cambio. Intentá de nuevo."));
    }
    setFeaturingId(null);
  }

  async function handleImportPreview(
    file: File,
    defaultType: CatalogItemType,
    mapping?: Record<string, ImportField>
  ) {
    setImportBusy(true);
    setImportError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("defaultType", defaultType);
      if (mapping) form.set("mapping", JSON.stringify(mapping));
      const res = await fetch("/api/business/items/import", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setImportError(data.error ?? "No pudimos leer el archivo.");
        return;
      }
      setImportPreview(data);
    } catch {
      setImportError("Error leyendo el archivo. Probá de nuevo.");
    } finally {
      setImportBusy(false);
    }
  }

  async function handleImportCommit() {
    if (!importPreview) return;
    setImportBusy(true);
    setImportError(null);
    try {
      const res = await fetch("/api/business/items/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: importPreview.items }),
      });
      const data = await res.json();
      if (!res.ok) {
        setImportError(data.error ?? "No pudimos importar el catálogo.");
        return;
      }
      setShowImport(false);
      setImportPreview(null);
      await loadItems();
      const skipped = Array.isArray(data.skipped) ? data.skipped.length : 0;
      showSuccess(`Importación lista: ${data.created ?? 0} guardados${skipped ? `, ${skipped} omitidos` : ""}.`);
    } catch {
      setImportError("Error importando. Probá de nuevo.");
    } finally {
      setImportBusy(false);
    }
  }

  function handleDuplicate(item: CatalogItem) {
    const form = itemToForm(item);
    form.name = `${form.name} (copia)`;
    form.is_featured = false;
    setEditItem(null);
    setFormError(null);
    setShowForm(true);
    // Open form pre-filled with the duplicate data
    // We need to pass initial form state — let's store it
    setPrefillForm(form);
  }

  const [prefillForm, setPrefillForm] = useState<FormState | null>(null);

  // ── Derived stats ──────────────────────────────────────────────────────────
  const activeProducts = state.items.filter((i) => i.is_active && i.item_type === "product").length;
  const activeServices = state.items.filter((i) => i.is_active && i.item_type === "service").length;
  const activePromos = state.items.filter(isPromoActive).length;
  const featuredCount = state.items.filter((i) => i.is_featured && i.is_active).length;

  // ── Filtered items ─────────────────────────────────────────────────────────
  const filteredItems = state.items.filter((item) => {
    if (activeTab === "product" && item.item_type !== "product") return false;
    if (activeTab === "service" && item.item_type !== "service") return false;
    if (activeTab === "promotion" && !isPromoActive(item)) return false;
    if (activeTab === "featured" && !item.is_featured) return false;
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
  const atLimit = !state.canAdd;

  const tabs: { key: TabFilter; label: string; count?: number }[] = [
    { key: "all", label: "Todo", count: state.items.length },
    { key: "product", label: "Productos", count: state.items.filter((i) => i.item_type === "product").length },
    { key: "service", label: "Servicios", count: state.items.filter((i) => i.item_type === "service").length },
    { key: "promotion", label: "Promociones", count: activePromos },
    { key: "featured", label: "Destacados", count: featuredCount },
  ];

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", background: "var(--bg)" }}>
        <div className="atd-spinner" />
      </div>
    );
  }

  return (
    <DashboardContentShell>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <div className="page-sub">catálogo</div>
          <h1 className="page-title">Catálogo</h1>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button
            onClick={() => {
              setImportError(null);
              setImportPreview(null);
              setShowImport(true);
            }}
            className="atd-btn secondary sm"
          >
            Importar Excel
          </button>
          <button
            onClick={() => {
              setEditItem(null);
              setPrefillForm(null);
              setFormError(null);
              setActionError(null);
              setShowForm(true);
            }}
            disabled={atLimit}
            className="atd-btn primary sm"
          >
            Agregar
          </button>
        </div>
      </div>

      {/* ── Error de carga ─────────────────────────────────────────────────── */}
      {loadError && (
        <div
          style={{
            margin: "10px 0 0",
            padding: "12px 16px",
            borderRadius: 12,
            border: "1px solid #fca5a5",
            background: "#fff0ee",
            fontSize: 13,
            color: "#b91c1c",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>
            No pudimos cargar tus productos y servicios. Intentá de nuevo.
          </span>
          <button
            onClick={loadItems}
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#b91c1c",
              background: "none",
              border: "none",
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            Reintentar
          </button>
        </div>
      )}

      {actionError && (
        <div
          style={{
            margin: "10px 0 0",
            padding: "10px 16px",
            borderRadius: 12,
            border: "1px solid #fca5a5",
            background: "#fff0ee",
            fontSize: 13,
            color: "#b91c1c",
            fontWeight: 500,
          }}
        >
          {actionError}
        </div>
      )}

      {/* ── Success message ────────────────────────────────────────────────── */}
      {successMsg && (
        <div
          style={{
            margin: "10px 0 0",
            padding: "10px 16px",
            borderRadius: 12,
            border: "1px solid var(--green)",
            background: "var(--green-tint)",
            fontSize: 13,
            color: "var(--green)",
            fontWeight: 500,
          }}
        >
          {successMsg}
        </div>
      )}

      <div className="atd-card" style={{ margin: "4px 0 0", padding: 18 }}>
        <div className="catalog-stats-grid">
          {[
            ["Productos", activeProducts],
            ["Servicios", activeServices],
            ["Promos", activePromos],
            ["Dest.", featuredCount],
          ].map(([label, value]) => (
            <div key={label}>
              <p style={{ fontSize: 22, fontWeight: 750, margin: 0, color: "var(--ink)", lineHeight: 1 }}>{value}</p>
              <p style={{ fontSize: 12.5, margin: "4px 0 0", color: "var(--muted)" }}>{label}</p>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px dashed var(--hairline-2)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span style={{ fontSize: 12.5, color: loadError ? "#c0392b" : "var(--ink-3)" }}>
            {loadError ? "No sincronizado" : lastUpdated ? `Actualizado ${lastUpdated.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}` : "Listo para el asistente"}
          </span>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>{state.count}/{state.limit === 9999 ? "∞" : state.limit}</span>
        </div>
      </div>

      {/* ── Usage bar ─────────────────────────────────────────────────────── */}
      <div className="atd-card" style={{ margin: "12px 0 0", padding: "14px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--ink-3)", marginBottom: 6 }}>
          <span>
            Capacidad del plan:{" "}
            <strong style={{ color: "var(--ink)" }}>
              {state.count} / {state.limit === 9999 ? "∞" : state.limit}
            </strong>
          </span>
          {atLimit && <span style={{ color: "#c0392b", fontWeight: 600 }}>Límite alcanzado</span>}
          {pct >= 80 && !atLimit && (
            <span style={{ color: "#d97706", fontWeight: 600 }}>Casi al límite ({Math.round(pct)}%)</span>
          )}
        </div>
        {state.limit !== 9999 && (
          <div
            style={{
              height: 5,
              borderRadius: 99,
              background: "var(--surface-2)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                borderRadius: 99,
                background: atLimit ? "#c0392b" : pct >= 80 ? "#d97706" : "var(--green)",
                width: `${pct}%`,
                transition: "width 0.4s",
              }}
            />
          </div>
        )}
        {atLimit && (
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <p style={{ fontSize: 12, color: "#c0392b", margin: 0 }}>
              Llegaste al límite de tu plan. Mejorá para agregar más productos.
            </p>
            <Link href="/app/plan" style={{ fontSize: 12, fontWeight: 700, color: "var(--green)", whiteSpace: "nowrap" }}>
              Mejorar plan →
            </Link>
          </div>
        )}
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <div style={{ padding: "14px 0 0", overflowX: "auto" }}>
        <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--hairline)", paddingBottom: 0 }}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: "10px 14px",
                fontSize: 13,
                fontWeight: activeTab === tab.key ? 600 : 400,
                color: activeTab === tab.key ? "var(--green)" : "var(--ink-3)",
                background: "none",
                border: "none",
                borderBottom: activeTab === tab.key ? "2px solid var(--green)" : "2px solid transparent",
                cursor: "pointer",
                whiteSpace: "nowrap",
                marginBottom: -1,
                transition: "color 0.15s, border-color 0.15s",
              }}
            >
              {tab.label}
              {typeof tab.count === "number" && tab.count > 0 && (
                <span
                  style={{
                    marginLeft: 6,
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "1px 6px",
                    borderRadius: 99,
                    background: activeTab === tab.key ? "var(--green)" : "var(--surface-2)",
                    color: activeTab === tab.key ? "#fff" : "var(--muted)",
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Search ────────────────────────────────────────────────────────── */}
      {state.items.length > 0 && (
        <div className="catalog-toolbar" style={{ padding: "10px 0 0" }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, categoría o descripción..."
            className="atd-input"
          />
          <div style={{ display: "flex", justifyContent: "flex-end", color: "var(--muted)", fontSize: 12.5 }}>
            {filteredItems.length} visibles
          </div>
        </div>
      )}

      {/* ── Items Grid ────────────────────────────────────────────────────── */}
      <div className="catalog-items-wrap">
        {filteredItems.length === 0 ? (
          <div
            style={{
              padding: "48px 20px",
              textAlign: "center",
              border: "2px dashed var(--hairline)",
              borderRadius: 18,
              background: "var(--surface)",
            }}
          >
            {state.items.length === 0 ? (
              <>
                <p style={{ fontSize: 36, marginBottom: 12 }}>📦</p>
                <p style={{ fontSize: 15, fontWeight: 600, color: "var(--ink-2)" }}>
                  Tu catálogo está vacío
                </p>
                <p style={{ marginTop: 6, fontSize: 13, color: "var(--ink-3)", maxWidth: 340, margin: "6px auto 0" }}>
                  Cargá tus productos o servicios para que tu asistente pueda responder precios y detalles sin inventar.
                </p>
                <button
                  onClick={() => {
                    setEditItem(null);
                    setPrefillForm(null);
                    setFormError(null);
                    setActionError(null);
                    setShowForm(true);
                  }}
                  disabled={atLimit}
                  className="atd-btn primary sm"
                  style={{ marginTop: 20 }}
                >
                  Agregar el primero
                </button>
              </>
            ) : activeTab === "promotion" ? (
              <>
                <p style={{ fontSize: 32, marginBottom: 10 }}>🏷️</p>
                <p style={{ fontSize: 14, fontWeight: 500, color: "var(--ink-2)" }}>Sin promociones activas</p>
                <p style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 4 }}>
                  Editá un producto o servicio y agregá una etiqueta de promoción.
                </p>
              </>
            ) : activeTab === "featured" ? (
              <>
                <p style={{ fontSize: 32, marginBottom: 10 }}>⭐</p>
                <p style={{ fontSize: 14, fontWeight: 500, color: "var(--ink-2)" }}>Sin destacados</p>
                <p style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 4 }}>
                  Hacé click en la estrella de cualquier producto o servicio para destacarlo.
                </p>
              </>
            ) : (
              <>
                <p style={{ fontSize: 13, color: "var(--ink-3)" }}>
                  No hay resultados para &ldquo;{search}&rdquo;
                </p>
                <button
                  onClick={() => setSearch("")}
                  style={{
                    marginTop: 8,
                    fontSize: 13,
                    color: "var(--green)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Limpiar búsqueda
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="dashboard-wide-grid" style={{ alignItems: "start" }}>
            {filteredItems.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onEdit={() => {
                  setEditItem(item);
                  setPrefillForm(null);
                  setFormError(null);
                  setShowForm(true);
                }}
                onDelete={() => setDeleteConfirmId(item.id)}
                onToggleActive={() => handleToggleActive(item)}
                onToggleFeatured={() => handleToggleFeatured(item)}
                onDuplicate={() => handleDuplicate(item)}
                toggling={togglingId === item.id}
                featuringId={featuringId}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Item Form ─────────────────────────────────────────────────────── */}
      {showForm && (
        <ItemForm
          initial={prefillForm ?? (editItem ? itemToForm(editItem) : EMPTY_FORM)}
          saving={saving}
          error={formError}
          onSave={handleSave}
          onClose={() => {
            setShowForm(false);
            setEditItem(null);
            setPrefillForm(null);
          }}
        />
      )}

      {showImport && (
        <ImportModal
          busy={importBusy}
          error={importError}
          preview={importPreview}
          onPreview={handleImportPreview}
          onMappingChange={(mapping) => {
            if (importPreview) setImportPreview({ ...importPreview, mapping });
          }}
          onCommit={handleImportCommit}
          onClose={() => {
            setShowImport(false);
            setImportPreview(null);
            setImportError(null);
          }}
        />
      )}

      {/* ── Delete Confirmation ───────────────────────────────────────────── */}
      {deleteConfirmId && (
        <div className="atd-overlay" style={{ zIndex: 140 }}>
          <div className="atd-modal" style={{ width: "100%", maxWidth: 380, padding: 24 }}>
            <p style={{ fontSize: 28, marginBottom: 8 }}>🗑️</p>
            <h4 style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>
              ¿Eliminar este producto/servicio?
            </h4>
            <p style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 20 }}>
              Esta acción no se puede deshacer. Se va a eliminar del catálogo
              y tu asistente dejará de usarlo.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="atd-btn secondary"
                style={{ flex: 1 }}
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  borderRadius: 12,
                  background: "#c0392b",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardContentShell>
  );
}
