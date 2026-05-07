"use client";

import { useEffect, useState } from "react";
import {
  BUSINESS_TEMPLATES,
  type BusinessTemplate,
} from "@/lib/business-templates";

// ── Plan access helpers ──────────────────────────────────────────────────────

const TIER_ACCESS: Record<string, string[]> = {
  starter: ["basic"],
  growth: ["basic", "commercial"],
  pro: ["basic", "commercial", "premium"],
  premium: ["basic", "commercial", "premium"], // legacy
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

// ── Component ────────────────────────────────────────────────────────────────

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

  // Fetch current plan to know which templates are accessible
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
    <section className="bg-white rounded-2xl border border-gray-200 p-6">
      {/* Header */}
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-600">
          Plantillas por Rubro
        </p>
        <h3 className="mt-1 text-base font-semibold text-gray-900">
          Elegí el rubro de tu negocio
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Aplicá una plantilla inicial para que tu asistente empiece con
          respuestas, tono y preguntas frecuentes recomendadas. Podés
          personalizarla después.
        </p>
      </div>

      {/* Success banner */}
      {appliedId && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">
          Plantilla aplicada correctamente. Ahora podés personalizarla con los
          datos reales de tu negocio usando las secciones de abajo.
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Active templates grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
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
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {soonTemplates.map((t) => {
          const locked = isTemplateLocked(t.tier, planCode);
          return (
            <div
              key={t.id}
              className="flex items-center gap-2 p-3 rounded-xl border border-dashed border-gray-200 opacity-50 select-none"
            >
              <span className="text-lg">{t.emoji}</span>
              <div>
                <p className="text-xs font-medium text-gray-500">{t.name}</p>
                <p className="text-xs text-gray-400">
                  {locked
                    ? `Plan ${requiredPlanLabel(t.tier)}`
                    : "Próximamente"}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirm modal (unlocked templates) */}
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

      {/* Upgrade modal (locked templates) */}
      {lockedSelected && (
        <UpgradeModal
          template={lockedSelected}
          onClose={() => setLockedSelected(null)}
        />
      )}
    </section>
  );
}

// ── TemplateCard ─────────────────────────────────────────────────────────────

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
    <div
      className={`flex flex-col gap-3 p-4 rounded-xl border transition-colors ${
        isApplied
          ? "border-emerald-300 bg-emerald-50"
          : isLocked
          ? "border-gray-200 bg-gray-50"
          : "border-gray-200 bg-gray-50 hover:border-emerald-300 hover:bg-white"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none mt-0.5">{template.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-900">{template.name}</p>
            {isLocked && (
              <span className="text-xs px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 font-medium">
                Plan {requiredPlanLabel(template.tier)}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
            {template.description}
          </p>
        </div>
      </div>

      {/* Category pills preview */}
      <div className="flex flex-wrap gap-1">
        {template.suggestedCategories.slice(0, 3).map((cat) => (
          <span
            key={cat}
            className="text-xs px-2 py-0.5 bg-white border border-gray-200 rounded-full text-gray-600"
          >
            {cat}
          </span>
        ))}
        {template.suggestedCategories.length > 3 && (
          <span className="text-xs px-2 py-0.5 text-gray-400">
            +{template.suggestedCategories.length - 3} más
          </span>
        )}
      </div>

      <button
        onClick={onSelect}
        disabled={isApplied}
        className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors ${
          isApplied
            ? "bg-emerald-100 text-emerald-700 cursor-default"
            : isLocked
            ? "bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200"
            : "bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white"
        }`}
      >
        {isApplied ? "✓ Aplicada" : isLocked ? `Disponible en ${requiredPlanLabel(template.tier)}` : "Usar plantilla"}
      </button>
    </div>
  );
}

// ── ConfirmModal (available templates) ───────────────────────────────────────

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
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl leading-none">{template.emoji}</span>
          <div>
            <h4 className="text-base font-semibold text-gray-900">
              {template.name}
            </h4>
            <p className="text-xs text-gray-500">Plantilla lista para usar</p>
          </div>
        </div>

        {profileIsEmpty ? (
          <>
            <p className="text-sm text-gray-600 mb-5">
              Se cargará la configuración inicial de la plantilla. Podés
              editarla después desde las secciones de abajo.
            </p>
            <div className="flex gap-2">
              <button
                onClick={onCancel}
                disabled={applying}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={onReplace}
                disabled={applying}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-medium transition-colors"
              >
                {applying ? "Aplicando..." : "Aplicar plantilla"}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-600 mb-4">
              Ya tenés información cargada. ¿Cómo querés aplicar la plantilla?
            </p>
            <div className="space-y-2 mb-4">
              <button
                onClick={onMerge}
                disabled={applying}
                className="w-full py-2.5 px-4 rounded-xl border border-emerald-200 bg-emerald-50 text-sm text-emerald-700 font-medium hover:bg-emerald-100 disabled:opacity-50 transition-colors text-left"
              >
                <span className="font-semibold block">Agregar sin borrar</span>
                <span className="text-xs font-normal text-emerald-600">
                  Suma la plantilla a lo que ya tenés cargado
                </span>
              </button>
              <button
                onClick={onReplace}
                disabled={applying}
                className="w-full py-2.5 px-4 rounded-xl border border-orange-200 bg-orange-50 text-sm text-orange-700 font-medium hover:bg-orange-100 disabled:opacity-50 transition-colors text-left"
              >
                <span className="font-semibold block">Reemplazar todo</span>
                <span className="text-xs font-normal text-orange-600">
                  Borra descripción, catálogo e info adicional actuales
                </span>
              </button>
            </div>
            <button
              onClick={onCancel}
              disabled={applying}
              className="w-full py-2 rounded-xl text-sm text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            {applying && (
              <p className="text-center text-xs text-emerald-600 mt-3">
                Aplicando plantilla...
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── UpgradeModal (locked templates) ──────────────────────────────────────────

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
      // fail silently — user can go to Mi Plan
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl leading-none">{template.emoji}</span>
          <div>
            <h4 className="text-base font-semibold text-gray-900">
              {template.name}
            </h4>
            <span className="text-xs px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 font-medium">
              Plan {planLabel}
            </span>
          </div>
        </div>

        <p className="text-sm text-gray-700 mb-1 font-medium">
          Esta plantilla está disponible en {planLabel}.
        </p>
        <p className="text-sm text-gray-500 mb-5">
          {planLabel === "Growth"
            ? "Con Growth podés usar todas las plantillas comerciales, cargar hasta 100 productos y acceder a herramientas para vender más por WhatsApp."
            : "Pro está pensado para negocios con más volumen, equipo e integraciones avanzadas. Incluye plantillas premium y analytics avanzado."}
        </p>

        <div className="space-y-2">
          <button
            onClick={handleUpgrade}
            className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors"
          >
            Mejorar a {planLabel}
          </button>
          <button
            onClick={onClose}
            className="w-full py-2 rounded-xl text-sm text-gray-500 hover:bg-gray-50 transition-colors"
          >
            Ahora no
          </button>
        </div>
      </div>
    </div>
  );
}
