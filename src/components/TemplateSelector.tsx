"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BUSINESS_TEMPLATES,
  type BusinessTemplate,
} from "@/lib/business-templates";

// ── Categorías de plantillas ────────────────────────────────────────────────
const TEMPLATE_CATEGORIES: { id: string; label: string; emoji: string }[] = [
  { id: "all", label: "Todos", emoji: "✨" },
  { id: "venta", label: "Venta", emoji: "🛍️" },
  { id: "servicios", label: "Servicios", emoji: "🔧" },
  { id: "gastronomia", label: "Gastronomía", emoji: "🍽️" },
  { id: "salud", label: "Salud", emoji: "🩺" },
  { id: "educacion", label: "Educación", emoji: "📚" },
  { id: "eventos", label: "Eventos", emoji: "🎉" },
  { id: "otro", label: "General", emoji: "🚀" },
];

const TEMPLATE_CATEGORY_MAP: Record<string, string> = {
  tech_store: "venta",
  clothing: "venta",
  real_estate: "venta",
  dealership: "venta",
  hair_salon: "servicios",
  gym: "servicios",
  tech_support: "servicios",
  restaurant: "gastronomia",
  clinic: "salud",
  education: "educacion",
  events: "eventos",
  general: "otro",
};

const TIER_ACCESS: Record<string, string[]> = {
  starter: ["basic"],
  pro: ["basic", "commercial", "premium"],
  premium: ["basic", "commercial", "premium"],
  growth: ["basic", "commercial", "premium"],
};

function isTemplateLocked(tier: string, planCode: string): boolean {
  return !(TIER_ACCESS[planCode] ?? ["basic"]).includes(tier);
}

function requiredPlanLabel(): string {
  return "Pro";
}

function requiredPlanCode(): string {
  return "pro";
}

interface Props {
  profileIsEmpty: boolean;
  onApplied: () => void;
}

export default function TemplateSelector({ profileIsEmpty, onApplied }: Props) {
  const [planCode, setPlanCode] = useState<string>("starter");
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<BusinessTemplate | null>(null);
  const [lockedSelected, setLockedSelected] = useState<BusinessTemplate | null>(null);
  const [applying, setApplying] = useState(false);
  const [appliedId, setAppliedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/plan")
      .then((r) => r.json())
      .then((data: { plan_code?: string }) => {
        if (data.plan_code) setPlanCode(data.plan_code);
      })
      .catch(() => undefined);
  }, []);

  const templates = BUSINESS_TEMPLATES.filter((t) => !t.comingSoon);
  const availableTemplates = templates.filter((t) => !isTemplateLocked(t.tier, planCode)).length;
  const filteredTemplates = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return templates;
    return templates.filter((t) =>
      [t.name, t.description, ...t.suggestedCategories, ...t.faqs]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [query, templates]);

  async function applyTemplate(mode: "merge" | "replace") {
    if (!selected) return;
    setApplying(true);
    setError(null);
    try {
      const res = await fetch("/api/business/apply-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: selected.id, mode }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "No pudimos aplicar la plantilla.");
      } else {
        setAppliedId(selected.id);
        setSelected(null);
        setIsOpen(false);
        onApplied();
      }
    } catch {
      setError("Error de conexión. Intentá de nuevo.");
    } finally {
      setApplying(false);
    }
  }

  return (
    <>
      <section className="atd-card template-selector-card" style={{ margin: "12px 20px 0", padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
          <div style={{ minWidth: 220, flex: 1 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", margin: 0 }}>
              Usar plantilla por rubro
            </h3>
            <p style={{ marginTop: 3, fontSize: 12.5, color: "var(--ink-3)", maxWidth: 560 }}>
              Cargá una base inicial y editá solo lo necesario.
            </p>
          </div>
          <button onClick={() => setIsOpen(true)} className="atd-btn ghost sm template-selector-trigger">
            Ver plantillas
          </button>
        </div>

        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>{availableTemplates} disponibles · plan {planCode.toUpperCase()}</span>
          {appliedId && (
            <span style={{ fontSize: 13, color: "var(--green)", fontWeight: 600 }}>
              Plantilla aplicada.
            </span>
          )}
          {error && (
            <span style={{ fontSize: 13, color: "#c0392b", fontWeight: 600 }}>
              {error}
            </span>
          )}
        </div>

        <div className="template-preview-list">
          {templates.slice(0, 4).map((template) => {
            const locked = isTemplateLocked(template.tier, planCode);
            return (
              <button
                key={template.id}
                type="button"
                onClick={() => {
                  setError(null);
                  if (locked) {
                    setLockedSelected(template);
                  } else {
                    setSelected(template);
                  }
                }}
                className="template-preview-item"
              >
                <span className="template-preview-emoji">{template.emoji}</span>
                <span className="template-preview-name">{template.name}</span>
                {locked && <span className="template-preview-lock">Pro</span>}
              </button>
            );
          })}
        </div>
      </section>

      {isOpen && (
        <TemplateSheet
          planCode={planCode}
          query={query}
          setQuery={setQuery}
          templates={filteredTemplates}
          appliedId={appliedId}
          onClose={() => setIsOpen(false)}
          onSelect={(template) => {
            setError(null);
            if (isTemplateLocked(template.tier, planCode)) {
              setLockedSelected(template);
            } else {
              setSelected(template);
            }
          }}
        />
      )}

      {selected && (
        <ConfirmModal
          template={selected}
          profileIsEmpty={profileIsEmpty}
          applying={applying}
          onMerge={() => applyTemplate("merge")}
          onReplace={() => applyTemplate("replace")}
          onCancel={() => setSelected(null)}
        />
      )}

      {lockedSelected && (
        <UpgradeModal
          template={lockedSelected}
          onClose={() => setLockedSelected(null)}
        />
      )}
    </>
  );
}

function TemplateSheet({
  planCode,
  query,
  setQuery,
  templates,
  appliedId,
  onClose,
  onSelect,
}: {
  planCode: string;
  query: string;
  setQuery: (value: string) => void;
  templates: BusinessTemplate[];
  appliedId: string | null;
  onClose: () => void;
  onSelect: (template: BusinessTemplate) => void;
}) {
  const [selectedCategory, setSelectedCategory] = useState("all");

  const filtered = useMemo(() => {
    if (selectedCategory === "all") return templates;
    return templates.filter((t) => TEMPLATE_CATEGORY_MAP[t.id] === selectedCategory);
  }, [templates, selectedCategory]);

  // Reset category when search query changes
  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (value.trim()) setSelectedCategory("all");
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.42)", zIndex: 140, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 10 }}>
      <div className="atd-card" style={{ width: "100%", maxWidth: 760, maxHeight: "88svh", padding: 0, overflow: "hidden", borderRadius: "20px 20px 14px 14px" }}>
        {/* Header */}
        <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid var(--hairline)", display: "flex", gap: 12, alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", margin: 0 }}>Elegí una plantilla</h3>
            <p style={{ fontSize: 12.5, color: "var(--ink-3)", margin: "4px 0 0" }}>
              Después podés ajustar textos, tono y preguntas.
            </p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" style={{ width: 36, height: 36, borderRadius: 999, border: "1px solid var(--hairline)", background: "var(--surface)", color: "var(--ink)", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>
            ×
          </button>
        </div>

        {/* Search + Category filters */}
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--hairline)" }}>
          <input
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            className="atd-input"
            placeholder="Buscar rubro..."
            style={{ marginBottom: 10 }}
          />
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
            {TEMPLATE_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => { setSelectedCategory(cat.id); setQuery(""); }}
                style={{
                  padding: "5px 12px",
                  borderRadius: 999,
                  border: `1.5px solid ${selectedCategory === cat.id ? "var(--green)" : "var(--hairline)"}`,
                  background: selectedCategory === cat.id ? "var(--green-tint)" : "var(--surface)",
                  color: selectedCategory === cat.id ? "var(--green)" : "var(--ink-2)",
                  fontSize: 12,
                  fontWeight: selectedCategory === cat.id ? 700 : 400,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  whiteSpace: "nowrap",
                }}
              >
                <span>{cat.emoji}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Templates grid */}
        <div style={{ padding: 12, overflowY: "auto", maxHeight: "calc(88svh - 162px)" }}>
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr" }}>
            {filtered.map((template) => {
              const locked = isTemplateLocked(template.tier, planCode);
              return (
                <TemplateRow
                  key={template.id}
                  template={template}
                  isApplied={appliedId === template.id}
                  isLocked={locked}
                  onSelect={() => onSelect(template)}
                />
              );
            })}
          </div>
          {filtered.length === 0 && (
            <div style={{ padding: 36, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>
              <p style={{ fontSize: 24, margin: "0 0 8px" }}>🔍</p>
              No encontramos plantillas para esa búsqueda.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TemplateRow({
  template,
  isApplied,
  isLocked,
  onSelect,
}: {
  template: BusinessTemplate;
  isApplied: boolean;
  isLocked: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      disabled={isApplied}
      style={{
        padding: 14,
        borderRadius: 14,
        border: `1.5px solid ${isApplied ? "var(--green)" : "var(--hairline)"}`,
        background: isApplied ? "var(--green-tint)" : "var(--surface)",
        textAlign: "left",
        cursor: isApplied ? "default" : "pointer",
        opacity: isLocked ? 0.72 : 1,
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      {/* Header: emoji + nombre + badge */}
      <span style={{ fontSize: 23, lineHeight: 1, flexShrink: 0 }}>{template.emoji}</span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", margin: 0 }}>{template.name}</p>
          {isLocked && (
            <span style={{ background: "#fff3cd", color: "#7a5800", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999 }}>
              {requiredPlanLabel()}
            </span>
          )}
          {isApplied && (
            <span style={{ background: "var(--green)", color: "#fff", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999 }}>
              Aplicada
            </span>
          )}
        </div>
        <p style={{ fontSize: 12, color: "var(--ink-3)", margin: "3px 0 0", lineHeight: 1.35 }}>
          {template.description}
        </p>
      </div>
      <span style={{ fontSize: 18, color: isApplied ? "var(--green)" : isLocked ? "#7a5800" : "var(--muted)", flexShrink: 0 }}>
        {isApplied ? "✓" : isLocked ? "Pro" : "→"}
      </span>
    </button>
  );
}

function ConfirmModal({
  template,
  profileIsEmpty,
  applying,
  onMerge,
  onReplace,
  onCancel,
}: {
  template: BusinessTemplate;
  profileIsEmpty: boolean;
  applying: boolean;
  onMerge: () => void;
  onReplace: () => void;
  onCancel: () => void;
}) {
  // Resumen de lo que carga la plantilla, para decidir con información.
  const willConfigure = [
    `Tono: ${template.tone.toLowerCase().replace(/\.$/, "")}`,
    "Mensaje de bienvenida y respuestas para cuando no sabe",
    `${template.faqs.length} preguntas frecuentes típicas del rubro`,
    `${template.responseRules.length} reglas del rubro`,
    template.bookingConfig ? "Flujo de reservas / turnos" : null,
    `${template.suggestedCategories.length} categorías sugeridas de productos o servicios`,
  ].filter(Boolean) as string[];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 150, padding: 16 }}>
      <div className="atd-card" style={{ width: "100%", maxWidth: 430, padding: 24, maxHeight: "88svh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <span style={{ fontSize: 28 }}>{template.emoji}</span>
          <div>
            <h4 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", margin: 0 }}>
              ¿Cómo querés usar esta plantilla?
            </h4>
            <p style={{ fontSize: 12, color: "var(--muted)", margin: "2px 0 0" }}>{template.name}</p>
          </div>
        </div>

        {/* Qué configura */}
        <div style={{ padding: "12px 14px", borderRadius: 12, background: "var(--surface-2)", marginBottom: 12 }}>
          <p className="page-sub" style={{ margin: "0 0 8px" }}>esta plantilla configura</p>
          {willConfigure.map((item) => (
            <p key={item} style={{ display: "flex", gap: 7, fontSize: 12.5, color: "var(--ink-2)", margin: "0 0 5px", lineHeight: 1.4 }}>
              <span style={{ color: "var(--green)", fontWeight: 700, flexShrink: 0 }}>✓</span> {item}
            </p>
          ))}
        </div>

        {/* Datos que el usuario debe completar después */}
        {template.recommendedFields.length > 0 && (
          <div style={{ padding: "12px 14px", borderRadius: 12, border: "1px dashed var(--hairline-2)", marginBottom: 16 }}>
            <p className="page-sub" style={{ margin: "0 0 8px" }}>para que funcione mejor, completá</p>
            {template.recommendedFields.map((field) => (
              <p key={field} style={{ display: "flex", gap: 7, fontSize: 12.5, color: "var(--ink-3)", margin: "0 0 5px", lineHeight: 1.4 }}>
                <span style={{ flexShrink: 0 }}>○</span> {field}
              </p>
            ))}
            <p style={{ fontSize: 11.5, color: "var(--muted)", margin: "8px 0 0" }}>
              Quedan marcados como pendientes en tu entrenamiento. Tu asistente no usa datos sin completar.
            </p>
          </div>
        )}

        {profileIsEmpty ? (
          <>
            <p style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 18 }}>
              Vamos a cargar una base inicial para tu asistente. Después podés editar todo.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={onCancel} disabled={applying} className="atd-btn secondary" style={{ flex: 1 }}>Cancelar</button>
              <button onClick={onReplace} disabled={applying} className="atd-btn primary" style={{ flex: 1 }}>
                {applying ? "Aplicando..." : "Usar plantilla"}
              </button>
            </div>
          </>
        ) : (
          <>
            <p style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 14 }}>
              Ya tenés información cargada. Elegí si querés conservarla o reemplazarla.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
              <button onClick={onMerge} disabled={applying} style={{ padding: "13px 16px", borderRadius: 12, border: "1px solid var(--green)", background: "var(--green-tint)", textAlign: "left", cursor: "pointer", opacity: applying ? 0.5 : 1 }}>
                <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--green)" }}>Completar datos faltantes</span>
                <span style={{ fontSize: 12, color: "var(--green)", opacity: 0.85 }}>Conserva lo que ya cargaste y suma sugerencias.</span>
              </button>
              <button onClick={onReplace} disabled={applying} style={{ padding: "13px 16px", borderRadius: 12, border: "1px solid #ffd3c8", background: "#fff4f2", textAlign: "left", cursor: "pointer", opacity: applying ? 0.5 : 1 }}>
                <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--accent)" }}>Reemplazar configuración actual</span>
                <span style={{ fontSize: 12, color: "var(--accent)", opacity: 0.85 }}>Cambia descripción, preguntas frecuentes, catálogo inicial y reglas.</span>
              </button>
            </div>
            <button onClick={onCancel} disabled={applying} className="atd-btn secondary" style={{ width: "100%" }}>Cancelar</button>
          </>
        )}
      </div>
    </div>
  );
}

function UpgradeModal({
  template,
  onClose,
}: {
  template: BusinessTemplate;
  onClose: () => void;
}) {
  const planLabel = requiredPlanLabel();
  const planCode = requiredPlanCode();

  async function handleUpgrade() {
    try {
      const res = await fetch("/api/billing/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_code: planCode, checkout_type: "upgrade" }),
      });
      const data = await res.json();
      if (data.checkoutUrl) window.location.href = data.checkoutUrl;
    } catch {
      // checkout errors are shown in the billing flow
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 150, padding: 16 }}>
      <div className="atd-card" style={{ width: "100%", maxWidth: 400, padding: 24 }}>
        <h4 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", margin: 0 }}>
          {template.emoji} {template.name}
        </h4>
        <p style={{ fontSize: 13, color: "var(--ink-3)", margin: "8px 0 18px" }}>
          Esta plantilla está disponible en {planLabel}. En prueba gratis podés usar las funciones de Growth.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button onClick={handleUpgrade} className="atd-btn primary" style={{ width: "100%" }}>
            Mejorar a {planLabel}
          </button>
          <button onClick={onClose} className="atd-btn secondary" style={{ width: "100%" }}>
            Ahora no
          </button>
        </div>
      </div>
    </div>
  );
}
