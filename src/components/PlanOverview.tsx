"use client";

import { useEffect, useState } from "react";
import type { UpgradeOption } from "@/lib/db";
import DashboardContentShell from "./DashboardContentShell";

interface PlanSummary {
  plan_code: string;
  plan_name: string;
  status: "trial" | "active" | "past_due" | "canceled" | "pending_payment";
  current_period_start: number | null;
  current_period_end: number | null;
  monthly_message_limit: number | null;
  monthly_ai_reply_limit: number | null;
  inbound_messages_count: number;
  ai_replies_count: number;
  human_messages_count: number;
  conversation_limit: number | null;
  product_limit: number | null;
  users_limit: number | null;
  whatsapp_numbers_limit: number | null;
  price_monthly: number | null;
  currency: string;
  features: Record<string, unknown> | null;
  template_tiers_allowed: string[];
  upgrade_options: UpgradeOption[];
  downgrade_options: UpgradeOption[];
  cancel_at_period_end: boolean;
  cancelled_at: number | null;
}

// ── Formatting ────────────────────────────────────────────────────────────────

function formatDate(value: number | null): string {
  if (!value) return "Sin fecha";
  return new Date(value * 1000).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatMoney(value: number | null | undefined, currency: string): string {
  if (typeof value !== "number") return "—";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

// ── Hardcoded feature lists per plan ─────────────────────────────────────────

const PLAN_INCLUDED: Record<string, string[]> = {
  starter: [
    "IA básica para responder consultas",
    "Modo humano (tomás el control)",
    "1 número de WhatsApp",
    "1 usuario del equipo",
    "Hasta 10 productos/servicios",
    "1 plantilla básica de rubro",
    "Configuración del negocio",
  ],
  growth: [
    "Todo lo de Starter",
    "Plantillas comerciales (5 rubros activos)",
    "Hasta 100 productos/servicios",
    "Hasta 10 usuarios del equipo",
    "Leads automáticos",
    "Métricas comerciales",
    "Entrenamiento simple de IA",
  ],
  pro: [
    "Todo lo de Growth",
    "Plantillas premium (clínicas, inmobiliarias, etc.)",
    "Hasta 500 productos/servicios",
    "Hasta 25 usuarios del equipo",
    "3 números de WhatsApp",
    "Analytics avanzado",
    "Plantillas personalizadas",
    "Soporte prioritario",
  ],
};

const PLAN_LOCKED: Record<string, string[]> = {
  starter: [
    "Plantillas comerciales",
    "Leads automáticos",
    "Métricas comerciales",
    "Entrenamiento IA",
    "Plantillas premium",
    "Analytics avanzado",
  ],
  growth: [
    "Plantillas premium",
    "Múltiples números de WhatsApp",
    "Analytics avanzado",
    "Plantillas personalizadas",
  ],
  pro: [],
};

const PLAN_TAGLINE: Record<string, string> = {
  starter: "Para empezar a responder consultas con IA.",
  growth: "Para negocios que quieren vender más por WhatsApp.",
  pro: "Para negocios con más volumen, equipo e integraciones.",
};

// ── Onboarding Guide ──────────────────────────────────────────────────────────

const ONBOARDING_STEPS = [
  {
    n: "1",
    title: "Completá el pago",
    desc: "Hacé click en 'Pagar ahora' para activar tu plan. El acceso se habilita automáticamente al confirmar el pago.",
    active: true,
  },
  {
    n: "2",
    title: "Conectá tu WhatsApp",
    desc: "Escaneá el código QR desde tu celular para vincular el número del negocio.",
    active: false,
  },
  {
    n: "3",
    title: "Configurá tu asistente",
    desc: "Cargá el nombre del negocio, descripción, catálogo de productos y datos de contacto.",
    active: false,
  },
  {
    n: "4",
    title: "Probá una conversación",
    desc: "Enviá un mensaje desde otro celular a tu número conectado y verificá que la IA responde.",
    active: false,
  },
  {
    n: "5",
    title: "¡Listo para operar!",
    desc: "El asistente responde 24/7. Podés cambiar a Modo Humano cuando quieras tomar el control.",
    active: false,
  },
];

function OnboardingGuide({
  plan,
  onPay,
  checkoutLoading,
  checkoutError,
}: {
  plan: PlanSummary;
  onPay: () => void;
  checkoutLoading: boolean;
  checkoutError: string | null;
}) {
  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-600">
            Primeros pasos
          </p>
          <h2 className="mt-2 text-3xl font-semibold text-gray-900">
            Activá tu cuenta y empezá a vender
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            Plan <strong>{plan.plan_name}</strong> ·{" "}
            {formatMoney(plan.price_monthly, plan.currency)} / mes
          </p>
        </div>

        <ol className="space-y-3">
          {ONBOARDING_STEPS.map((step) => (
            <li
              key={step.n}
              className={`flex gap-4 rounded-2xl border p-5 ${
                step.active
                  ? "border-emerald-300 bg-white shadow-sm"
                  : "border-gray-200 bg-white opacity-50"
              }`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  step.active
                    ? "bg-emerald-500 text-white"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                {step.n}
              </span>
              <div>
                <p className="font-semibold text-gray-900">{step.title}</p>
                <p className="mt-1 text-sm leading-6 text-gray-500">{step.desc}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 space-y-4">
          <p className="text-sm font-medium text-emerald-800">
            Completá el pago para desbloquear el acceso a WhatsApp, inbox y asistente IA.
          </p>
          {checkoutError && (
            <p className="text-sm text-red-600">{checkoutError}</p>
          )}
          <button
            onClick={onPay}
            disabled={checkoutLoading}
            className="w-full rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-50"
          >
            {checkoutLoading
              ? "Redirigiendo a pago..."
              : `Pagar ahora — ${formatMoney(plan.price_monthly, plan.currency)}`}
          </button>
        </div>

        <p className="text-center text-xs text-gray-400">
          ¿Ya pagaste y no se activó?{" "}
          <button
            onClick={() => window.location.reload()}
            className="text-emerald-600 hover:underline"
          >
            Actualizá la página
          </button>
        </p>
      </div>
    </div>
  );
}

// ── Usage bar ─────────────────────────────────────────────────────────────────

function UsageBar({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number | null;
}) {
  const pct = limit ? Math.min(100, (used / limit) * 100) : 0;
  const color =
    pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-400" : "bg-emerald-500";

  return (
    <div>
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>{label}</span>
        <span>
          {used.toLocaleString("es-AR")} /{" "}
          {limit ? limit.toLocaleString("es-AR") : "sin límite"}
        </span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${limit ? pct : 0}%` }}
        />
      </div>
    </div>
  );
}

// ── Upgrade card ──────────────────────────────────────────────────────────────

function UpgradeCard({
  option,
  onUpgrade,
  loading,
}: {
  option: UpgradeOption;
  onUpgrade: (code: string) => void;
  loading: boolean;
}) {
  const included = PLAN_INCLUDED[option.code] ?? [];
  const tagline = PLAN_TAGLINE[option.code] ?? "";

  return (
    <div className="flex flex-col rounded-2xl border border-gray-200 bg-white p-5">
      <div className="mb-3">
        <p className="text-base font-semibold text-gray-900">{option.name}</p>
        <p className="text-xs text-gray-500 mt-0.5">{tagline}</p>
        <p className="mt-2 text-2xl font-semibold text-gray-900">
          {formatMoney(option.price_monthly, option.currency)}
          <span className="text-sm font-normal text-gray-400"> / mes</span>
        </p>
      </div>
      <ul className="space-y-1.5 mb-5 flex-1">
        {included.slice(0, 5).map((f) => (
          <li key={f} className="flex items-start gap-2 text-xs text-gray-600">
            <span className="mt-0.5 text-emerald-500 shrink-0">✓</span>
            {f}
          </li>
        ))}
      </ul>
      <button
        onClick={() => onUpgrade(option.code)}
        disabled={loading}
        className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
      >
        {loading ? "Redirigiendo..." : `Mejorar a ${option.name}`}
      </button>
    </div>
  );
}

function DowngradeCard({
  option,
  onDowngrade,
  loading,
}: {
  option: UpgradeOption;
  onDowngrade: (code: string) => void;
  loading: boolean;
}) {
  const included = PLAN_INCLUDED[option.code] ?? [];
  const tagline = PLAN_TAGLINE[option.code] ?? "";

  return (
    <div className="flex flex-col rounded-2xl border border-gray-200 bg-white p-5">
      <div className="mb-3">
        <p className="text-base font-semibold text-gray-900">{option.name}</p>
        <p className="text-xs text-gray-500 mt-0.5">{tagline}</p>
        <p className="mt-2 text-2xl font-semibold text-gray-900">
          {formatMoney(option.price_monthly, option.currency)}
          <span className="text-sm font-normal text-gray-400"> / mes</span>
        </p>
      </div>
      <ul className="space-y-1.5 mb-5 flex-1">
        {included.slice(0, 5).map((f) => (
          <li key={f} className="flex items-start gap-2 text-xs text-gray-600">
            <span className="mt-0.5 text-emerald-500 shrink-0">✓</span>
            {f}
          </li>
        ))}
      </ul>
      <button
        onClick={() => onDowngrade(option.code)}
        disabled={loading}
        className="w-full py-2.5 rounded-xl border border-gray-300 bg-white hover:border-gray-400 disabled:opacity-50 text-gray-800 text-sm font-semibold transition-colors"
      >
        {loading ? "Actualizando..." : `Bajar a ${option.name}`}
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PlanOverview() {
  const [plan, setPlan] = useState<PlanSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [reactivateLoading, setReactivateLoading] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showDowngradeModal, setShowDowngradeModal] = useState(false);
  const [downgradeTarget, setDowngradeTarget] = useState<UpgradeOption | null>(null);
  const [downgradeLoading, setDowngradeLoading] = useState<string | null>(null);

  async function startCheckout(planCode?: string, checkoutType?: string) {
    setCheckoutLoading(true);
    if (planCode) setUpgradeLoading(planCode);
    setCheckoutError(null);
    try {
      const body = planCode
        ? { plan_code: planCode, checkout_type: checkoutType ?? "upgrade" }
        : {};
      const res = await fetch("/api/billing/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as {
        checkoutUrl?: string;
        error?: string;
      };
      if (!res.ok || !data.checkoutUrl) {
        setCheckoutError(data.error ?? "No se pudo iniciar el pago.");
        return;
      }
      window.location.href = data.checkoutUrl;
    } catch {
      setCheckoutError("Error de conexión. Intentá de nuevo.");
    } finally {
      setCheckoutLoading(false);
      setUpgradeLoading(null);
    }
  }

  async function refreshPlan() {
    const res = await fetch("/api/plan", { cache: "no-store" });
    const payload = (await res.json().catch(() => ({}))) as PlanSummary & { error?: string };
    if (!res.ok) {
      throw new Error(payload.error ?? "No se pudo cargar el plan.");
    }
    setPlan(payload);
  }

  async function handleCancelPlan() {
    setCancelLoading(true);
    setCheckoutError(null);
    try {
      const res = await fetch("/api/plan/cancel", { method: "POST" });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(payload.error ?? "No se pudo programar la cancelación.");
      }
      setShowCancelModal(false);
      await refreshPlan();
    } catch (err) {
      setCheckoutError(
        err instanceof Error ? err.message : "No se pudo programar la cancelación."
      );
    } finally {
      setCancelLoading(false);
    }
  }

  async function handleReactivatePlan() {
    setReactivateLoading(true);
    setCheckoutError(null);
    try {
      const res = await fetch("/api/plan/reactivate", { method: "POST" });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(payload.error ?? "No se pudo reactivar el plan.");
      }
      await refreshPlan();
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : "No se pudo reactivar el plan.");
    } finally {
      setReactivateLoading(false);
    }
  }

  async function handleDowngradePlan() {
    if (!downgradeTarget) return;
    setDowngradeLoading(downgradeTarget.code);
    setCheckoutError(null);
    try {
      const res = await fetch("/api/plan/downgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_code: downgradeTarget.code }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(payload.error ?? "No se pudo bajar de plan.");
      }
      setShowDowngradeModal(false);
      setDowngradeTarget(null);
      await refreshPlan();
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : "No se pudo bajar de plan.");
    } finally {
      setDowngradeLoading(null);
    }
  }

  useEffect(() => {
    fetch("/api/plan")
      .then(async (r) => {
        if (!r.ok) {
          const p = (await r.json().catch(() => null)) as { error?: string } | null;
          throw new Error(p?.error ?? "No se pudo cargar el plan.");
        }
        return r.json();
      })
      .then((data: PlanSummary) => {
        setPlan(data);
        setError(null);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "No se pudo cargar el plan.");
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", background: "var(--bg)" }}>
        <div className="w-8 h-8 border-4 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!plan || error) {
    return (
      <div style={{ height: "100%", background: "var(--bg)", padding: 20 }}>
        <div className="atd-card" style={{ padding: 16, color: "#c0392b", background: "rgba(192,57,43,0.07)", borderColor: "rgba(192,57,43,0.2)" }}>
          {error ?? "No se pudo cargar el estado del plan."}
        </div>
      </div>
    );
  }

  if (plan.status === "pending_payment") {
    return (
      <OnboardingGuide
        plan={plan}
        onPay={() => startCheckout()}
        checkoutLoading={checkoutLoading}
        checkoutError={checkoutError}
      />
    );
  }

  const currentCode = plan.plan_code;
  const includedFeatures = PLAN_INCLUDED[currentCode] ?? PLAN_INCLUDED["starter"];
  const lockedFeatures = PLAN_LOCKED[currentCode] ?? [];

  return (
    <DashboardContentShell maxWidth={1180}>

        <div className="page-header">
          <div>
            <div className="page-sub">04 · uso &amp; upgrade</div>
            <h1 className="page-title">Mi plan</h1>
          </div>
        </div>

        {/* Hero plan card (dark) */}
        <div style={{ margin: "0 20px 14px", padding: 20, borderRadius: 22, background: "var(--ink)", color: "var(--bg)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: "var(--accent)", opacity: 0.2, filter: "blur(20px)", pointerEvents: "none" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span className="atd-pill" style={{ background: "rgba(255,255,255,0.1)", color: "var(--bg)", borderColor: "transparent" }}>Tu plan</span>
            <span className="mono" style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>
              {plan.status === "active" ? "activo" : plan.status} · vence {formatDate(plan.current_period_end)}
            </span>
          </div>
          <div className="serif" style={{ fontSize: 52, lineHeight: 1, marginBottom: 4 }}>{plan.plan_name}</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 16 }}>
            {PLAN_TAGLINE[currentCode] ?? ""}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {plan.upgrade_options.length > 0 && (
              <button
                onClick={() => startCheckout(plan.upgrade_options[0].code, "upgrade")}
                disabled={checkoutLoading}
                className="atd-btn accent sm"
                style={{ flex: 1 }}
              >
                {checkoutLoading ? "..." : `Mejorar a ${plan.upgrade_options[0].name}`}
              </button>
            )}
            {!plan.cancel_at_period_end && (plan.status === "active" || plan.status === "trial") && (
              <button
                onClick={() => setShowCancelModal(true)}
                className="atd-btn ghost sm"
                style={{ color: "var(--bg)", borderColor: "rgba(255,255,255,0.25)" }}
              >
                Cancelar
              </button>
            )}
            {plan.cancel_at_period_end && (
              <button onClick={handleReactivatePlan} disabled={reactivateLoading} className="atd-btn ghost sm" style={{ color: "var(--bg)", borderColor: "rgba(255,255,255,0.25)", flex: 1 }}>
                {reactivateLoading ? "..." : "Reactivar"}
              </button>
            )}
          </div>
          {plan.cancel_at_period_end && (
            <p style={{ fontSize: 12, color: "rgba(255,200,100,0.9)", marginTop: 10 }}>
              Cancelación programada al {formatDate(plan.current_period_end)}.
            </p>
          )}
        </div>

        {checkoutError && (
          <div style={{ margin: "0 20px 12px", padding: 12, borderRadius: 12, background: "rgba(192,57,43,0.1)", color: "#c0392b", fontSize: 13 }}>
            {checkoutError}
          </div>
        )}

        <div className="lg:grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-3">
          {/* Usage */}
          <div className="atd-card" style={{ margin: "0 20px 12px", padding: 16 }}>
            <div className="page-sub" style={{ marginBottom: 10 }}>uso del plan</div>
            {[
              { label: "Usuarios", used: plan.users_limit ? 1 : 0, limit: plan.users_limit },
              { label: "Productos", used: plan.inbound_messages_count, limit: plan.conversation_limit },
              { label: "Mensajes IA", used: plan.ai_replies_count, limit: plan.monthly_ai_reply_limit },
            ].map(({ label, used, limit }, i) => {
              const pct = limit ? Math.min(100, (used / limit) * 100) : 0;
              const barColor = pct >= 90 ? "#c0392b" : pct >= 70 ? "var(--human)" : "var(--green-soft)";
              return (
                <div key={label} style={{ padding: "10px 0", borderTop: i ? "1px dashed var(--hairline-2)" : "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6, color: "var(--ink-2)" }}>
                    <span>{label}</span>
                    <span className="mono">{used.toLocaleString("es-AR")} / {limit ? limit.toLocaleString("es-AR") : "∞"}</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 4, background: "var(--surface-2)", overflow: "hidden" }}>
                    <div style={{ width: `${limit ? pct : 0}%`, height: "100%", background: barColor, borderRadius: 4, transition: "width .4s" }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Features */}
          <div className="atd-card" style={{ margin: "0 20px 12px", padding: 16 }}>
            <div className="page-sub" style={{ marginBottom: 10 }}>incluido en {plan.plan_name}</div>
            <div className="grid gap-x-6 lg:grid-cols-2">
              <div>
                {includedFeatures.map((f) => (
                  <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderTop: includedFeatures.indexOf(f) ? "1px dashed var(--hairline-2)" : "none", fontSize: 13, color: "var(--ink-2)" }}>
                    <span style={{ color: "var(--green-soft)", flexShrink: 0 }}>✓</span> {f}
                  </div>
                ))}
              </div>
              {lockedFeatures.length > 0 && (
                <div>
                  <div className="page-sub" style={{ marginTop: 14, marginBottom: 8 }}>próximos planes</div>
                  {lockedFeatures.map((f) => (
                    <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderTop: lockedFeatures.indexOf(f) ? "1px dashed var(--hairline-2)" : "none", fontSize: 13, color: "var(--muted)" }}>
                      <span style={{ flexShrink: 0 }}>🔒</span> {f}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Upgrade cards */}
        {plan.upgrade_options.length > 0 && plan.upgrade_options.map((opt) => (
          <div key={opt.code} className="atd-card" style={{ margin: "0 20px 10px", padding: 16, background: "var(--accent-soft)", borderColor: "transparent" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
              <span style={{ width: 32, height: 32, borderRadius: 10, background: "var(--accent)", color: "var(--on-accent)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 16 }}>✦</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: "var(--accent-ink)" }}>Probá {opt.name}</div>
                <div style={{ fontSize: 12, color: "var(--accent-ink)", opacity: 0.75, marginTop: 2 }}>{PLAN_TAGLINE[opt.code] ?? "Más funciones y más capacidad."}</div>
              </div>
            </div>
            <button
              onClick={() => startCheckout(opt.code, "upgrade")}
              disabled={checkoutLoading}
              className="atd-btn accent sm"
              style={{ width: "100%" }}
            >
              {(upgradeLoading === opt.code && checkoutLoading) ? "Redirigiendo..." : `Mejorar a ${opt.name} — ${formatMoney(opt.price_monthly, opt.currency)}/mes`}
            </button>
          </div>
        ))}

        {/* Downgrade options */}
        {plan.downgrade_options.length > 0 && (
          <div className="atd-card" style={{ margin: "0 20px 10px", padding: 16 }}>
            <div className="page-sub" style={{ marginBottom: 10 }}>bajar de plan</div>
            {plan.downgrade_options.map((opt) => (
              <button key={opt.code} onClick={() => { setDowngradeTarget(opt); setShowDowngradeModal(true); }}
                className="atd-btn ghost sm" style={{ width: "100%", marginBottom: 6 }}>
                Bajar a {opt.name} — {formatMoney(opt.price_monthly, opt.currency)}/mes
              </button>
            ))}
          </div>
        )}

        {(plan.status === "canceled" || plan.status === "past_due") && (
          <div style={{ margin: "0 20px 10px" }}>
            <button onClick={() => startCheckout()} disabled={checkoutLoading} className="atd-btn green" style={{ width: "100%" }}>
              {checkoutLoading ? "Redirigiendo..." : "Renovar plan"}
            </button>
          </div>
        )}

      

      {/* Cancel modal */}
      {showCancelModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.35)", padding: 16 }}>
          <div className="atd-card" style={{ width: "100%", maxWidth: 400, padding: 24 }}>
            <h3 className="serif" style={{ fontSize: 22, marginBottom: 10 }}>¿Cancelar el plan?</h3>
            <p style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 20 }}>
              Tu asistente seguirá activo hasta el final del período ya pagado. Después el acceso queda pausado.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowCancelModal(false)} className="atd-btn ghost sm" style={{ flex: 1 }}>Mantener</button>
              <button onClick={handleCancelPlan} disabled={cancelLoading} className="atd-btn sm" style={{ flex: 1, background: "#c0392b", color: "#fff", border: "none" }}>
                {cancelLoading ? "..." : "Cancelar al vencer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Downgrade modal */}
      {showDowngradeModal && downgradeTarget && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.35)", padding: 16 }}>
          <div className="atd-card" style={{ width: "100%", maxWidth: 400, padding: 24 }}>
            <h3 className="serif" style={{ fontSize: 22, marginBottom: 10 }}>¿Bajar a {downgradeTarget.name}?</h3>
            <p style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 20 }}>
              El cambio se aplica ahora mismo. Si tu negocio supera los límites del plan, la operación no se permitirá.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { setShowDowngradeModal(false); setDowngradeTarget(null); }} className="atd-btn ghost sm" style={{ flex: 1 }}>Cancelar</button>
              <button onClick={handleDowngradePlan} disabled={downgradeLoading === downgradeTarget.code} className="atd-btn primary sm" style={{ flex: 1 }}>
                {downgradeLoading === downgradeTarget.code ? "..." : `Bajar a ${downgradeTarget.name}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardContentShell>
  );
}
