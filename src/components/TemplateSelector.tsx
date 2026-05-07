"use client";

import { useEffect, useState } from "react";
import {
  BUSINESS_TEMPLATES,
  type BusinessTemplate,
} from "@/lib/business-templates";

const TIER_ACCESS: Record<string, string[]> = {
  starter: ["basic"],
  growth: ["basic", "commercial"],
  pro: ["basic", "commercial", "premium"],
  premium: ["basic", "commercial", "premium"],
};

function isTemplateLocked(tier: string, planCode: string): boolean {
  return !(TIER_ACCESS[planCode] ?? ["basic"]).includes(tier);
}

function requiredPlanLabel(tier: string): string {
  if (tier === "premium") return "Pro";
  return "Growth";
}

function requiredPlanCode(tier: string): string {
  if (tier === "premium") return "pro";
  return "growth";
}

interface Props {
  profileIsEmpty: boolean;
  onApplied: () => void;
}

export default function TemplateSelector({ profileIsEmpty, onApplied }: Props) {
  const [planCode, setPlanCode] = useState<string>("starter");
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

  const activeTemplates = BUSINESS_TEMPLATES.filter((t) => !t.comingSoon);
  const soonTemplates = BUSINESS_TEMPLATES.filter((t) => t.comingSoon);

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
        setError(data.error ?? "Error aplicando la plantilla.");
      } else {
        setAppliedId(selected.id);
        setSelected(null);
        onApplied();
      }
    } catch {
      setError("Error de conexión. Intentá de nuevo.");
    }
    setApplying(false);
  }

  return (
    <section className="atd-card" style={{ margin: "12px 20px 0", padding: 20 }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div className="page-sub" style={{ marginBottom: 4 }}>Plantillas por Rubro</div>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", margin: 0 }}>
          Elegí el rubro de tu negocio
        </h3>
        <p style={{ marginTop: 4, fontSize: 13, color: "var(--ink-3)" }}>
          Aplicá una plantilla inicial para que tu asistente empiece con respuestas y tono recomendados. Podés personalizarla después.
        </p>
      </div>

      {/* Success banner */}
      {appliedId && (
        <div style={{ marginBottom: 14, padding: "10px 14px", borderRadius: 12, border: "1px solid var(--green)", background: "var(--green-tint)", fontSize: 13, color: "var(--green)" }}>
          Plantilla aplicada. Ahora podés personalizarla con los datos reales de tu negocio.
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div style={{ marginBottom: 14, padding: "10px 14px", borderRadius: 12, border: "1px solid #f5c2bb", background: "#fff0ee", fontSize: 13, color: "var(--accent)" }}>
          {error}
        </div>
      )}

      {/* Active templates grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        {activeTemplates.map((t) => {
          const locked = isTemplateLocked(t.tier, planCode);
          return (
            <TemplateCard
              key={t.id}
              template={t}
              isApplied={appliedId === t.id}
              isLocked={locked}
              onSelect={() => {
                setError(null);
                if (locked) {
                  setLockedSelected(t);
                } else {
                  setSelected(t);
                }
              }}
            />
          );
        })}
      </div>

      {/* Coming soon grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        {soonTemplates.map((t) => {
          const locked = isTemplateLocked(t.tier, planCode);
          return (
            <div
              key={t.id}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "10px 12px", borderRadius: 12,
                border: "1px dashed var(--hairline)", opacity: 0.55,
                userSelect: "none",
              }}
            >
              <span style={{ fontSize: 16 }}>{t.emoji}</span>
              <div>
                <p style={{ fontSize: 11, fontWeight: 500, color: "var(--ink-2)", margin: 0 }}>{t.name}</p>
                <p style={{ fontSize: 11, color: "var(--muted)", margin: 0 }}>
                  {locked ? `Plan ${requiredPlanLabel(t.tier)}` : "Próximamente"}
                </p>
              </div>
            </div>
          );
        })}
      </div>

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
    </section>
  );
}

function TemplateCard({
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
    <div style={{
      padding: 14, borderRadius: 14,
      border: `1px solid ${isApplied ? "var(--green)" : "var(--hairline)"}`,
      background: isApplied ? "var(--green-tint)" : "var(--surface)",
      display: "flex", flexDirection: "column", gap: 10,
      opacity: isLocked ? 0.78 : 1,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <span style={{ fontSize: 22, lineHeight: 1, marginTop: 1 }}>{template.emoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", margin: 0 }}>{template.name}</p>
            {isLocked && (
              <span className="atd-pill" style={{ background: "#fff3cd", color: "#7a5800", border: "none", fontSize: 10 }}>
                {requiredPlanLabel(template.tier)}
              </span>
            )}
          </div>
          <p style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 2, lineHeight: 1.4 }}>
            {template.description}
          </p>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {template.suggestedCategories.slice(0, 3).map((cat) => (
          <span key={cat} className="atd-pill" style={{ fontSize: 10, background: "var(--surface-2)" }}>
            {cat}
          </span>
        ))}
        {template.suggestedCategories.length > 3 && (
          <span style={{ fontSize: 10, color: "var(--muted)" }}>
            +{template.suggestedCategories.length - 3} más
          </span>
        )}
      </div>

      <button
        onClick={onSelect}
        disabled={isApplied}
        className={`atd-btn ${isApplied ? "secondary" : "primary"} sm`}
        style={{ width: "100%", fontSize: 12 }}
      >
        {isApplied ? "✓ Aplicada" : isLocked ? `Requiere ${requiredPlanLabel(template.tier)}` : "Usar plantilla"}
      </button>
    </div>
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
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50, padding: 16 }}>
      <div className="atd-card" style={{ width: "100%", maxWidth: 400, padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <span style={{ fontSize: 28 }}>{template.emoji}</span>
          <div>
            <h4 style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", margin: 0 }}>{template.name}</h4>
            <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>Plantilla lista para usar</p>
          </div>
        </div>

        {profileIsEmpty ? (
          <>
            <p style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 20 }}>
              Se cargará la configuración inicial de la plantilla. Podés editarla después desde las secciones de abajo.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={onCancel} disabled={applying} className="atd-btn secondary" style={{ flex: 1 }}>Cancelar</button>
              <button onClick={onReplace} disabled={applying} className="atd-btn primary" style={{ flex: 1 }}>
                {applying ? "Aplicando..." : "Aplicar plantilla"}
              </button>
            </div>
          </>
        ) : (
          <>
            <p style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 14 }}>
              Ya tenés información cargada. ¿Cómo querés aplicar la plantilla?
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
              <button
                onClick={onMerge}
                disabled={applying}
                style={{
                  padding: "12px 16px", borderRadius: 12, border: "1px solid var(--green)",
                  background: "var(--green-tint)", textAlign: "left", cursor: "pointer",
                  opacity: applying ? 0.5 : 1,
                }}
              >
                <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--green)" }}>Agregar sin borrar</span>
                <span style={{ fontSize: 11, color: "var(--green)", opacity: 0.8 }}>Suma la plantilla a lo que ya tenés cargado</span>
              </button>
              <button
                onClick={onReplace}
                disabled={applying}
                style={{
                  padding: "12px 16px", borderRadius: 12, border: "1px solid #ffd3c8",
                  background: "#fff4f2", textAlign: "left", cursor: "pointer",
                  opacity: applying ? 0.5 : 1,
                }}
              >
                <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--accent)" }}>Reemplazar todo</span>
                <span style={{ fontSize: 11, color: "var(--accent)", opacity: 0.8 }}>Borra descripción, catálogo e info adicional actuales</span>
              </button>
            </div>
            <button onClick={onCancel} disabled={applying} className="atd-btn secondary" style={{ width: "100%" }}>Cancelar</button>
            {applying && (
              <p style={{ textAlign: "center", fontSize: 12, color: "var(--green)", marginTop: 10 }}>Aplicando plantilla...</p>
            )}
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
  const planLabel = requiredPlanLabel(template.tier);
  const planCode = requiredPlanCode(template.tier);

  async function handleUpgrade() {
    try {
      const res = await fetch("/api/billing/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_code: planCode, checkout_type: "upgrade" }),
      });
      const data = await res.json();
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch {
      // fail silently
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50, padding: 16 }}>
      <div className="atd-card" style={{ width: "100%", maxWidth: 400, padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <span style={{ fontSize: 28 }}>{template.emoji}</span>
          <div>
            <h4 style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", margin: 0 }}>{template.name}</h4>
            <span className="atd-pill" style={{ background: "#fff3cd", color: "#7a5800", border: "none", marginTop: 4, display: "inline-block" }}>
              Plan {planLabel}
            </span>
          </div>
        </div>

        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 4 }}>
          Esta plantilla está disponible en {planLabel}.
        </p>
        <p style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 20 }}>
          {planLabel === "Growth"
            ? "Con Growth podés usar todas las plantillas comerciales, cargar hasta 100 productos y acceder a herramientas para vender más por WhatsApp."
            : "Pro está pensado para negocios con más volumen, equipo e integraciones avanzadas. Incluye plantillas premium y analytics avanzado."}
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
