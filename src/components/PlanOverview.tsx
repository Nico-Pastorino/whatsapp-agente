"use client";

import { useEffect, useState } from "react";
import type { UpgradeOption } from "@/lib/db";
import { ANNUAL_DISCOUNT, formatARS } from "@/lib/plan-display";
import DashboardContentShell from "./DashboardContentShell";
import SupportCard from "./SupportCard";
import { ROLE_LABELS, type DashboardRole } from "@/lib/role-access";

interface PlanSummary {
  plan_code: string;
  plan_name: string;
  status: "trial" | "active" | "past_due" | "canceled" | "pending_payment";
  access_status: "trial" | "active" | "pending_payment" | "past_due" | "canceled" | "blocked" | "none";
  can_use_app: boolean;
  access_reason: string;
  days_left_trial: number | null;
  trial_started_at: number | null;
  trial_ends_at: number | null;
  paid_at: number | null;
  subscription_started_at: number | null;
  subscription_ends_at: number | null;
  mercado_pago_preapproval_id: string | null;
  mercado_pago_preapproval_status: string | null;
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
  product_count: number;
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

// ── Feature lists por plan ────────────────────────────────────────────────────
// Fuente única: alineadas con plan-display.ts y la DB (supabase/migrations/020).
// NUNCA incluir features no implementadas — rompe confianza con el usuario pagador.

const PLAN_INCLUDED: Record<string, string[]> = {
  starter: [
    "IA para responder consultas",
    "Modo humano (tomás el control)",
    "1 número de WhatsApp",
    "Hasta 3 usuarios del equipo",
    "Hasta 20 productos/servicios en catálogo",
    "Plantilla básica de rubro",
  ],
  growth: [
    "Todo lo del Starter",
    "Plantillas comerciales por rubro",
    "Hasta 150 productos/servicios en catálogo",
    "Hasta 10 usuarios del equipo",
    "Avisos al encargado por WhatsApp",
    "Reservas / Turnos automáticos con IA",
    "Base de conocimiento para la IA",
    "Métricas de conversaciones",
  ],
  pro: [
    "Todo lo del Growth",
    "Plantillas premium (todos los rubros)",
    "Hasta 1.000 productos/servicios en catálogo",
    "Hasta 25 usuarios del equipo",
    // "Hasta 3 números de WhatsApp" ELIMINADO — no implementado en el worker.
    // Reactivar cuando el worker soporte multi-sesión por negocio.
    "Soporte prioritario por email",
    "Métricas avanzadas de conversaciones",
  ],
};

const PLAN_LOCKED: Record<string, string[]> = {
  starter: [
    "Reservas / Turnos automáticos con IA",
    "Avisos al encargado por WhatsApp",
    "Plantillas comerciales y premium",
    "Base de conocimiento para la IA",
    "Métricas de conversaciones",
  ],
  growth: [
    "Más de 10 usuarios del equipo",
    "Hasta 1.000 productos/servicios",
    "Soporte prioritario",
  ],
  pro: [],
};

const PLAN_TAGLINE: Record<string, string> = {
  starter: "Para empezar a responder consultas con IA.",
  growth: "Para negocios que ya venden y quieren escalar.",
  pro: "Para equipos que viven de WhatsApp.",
};

// ── Pantalla de Trial Expirado / Pago Pendiente ──────────────────────────────

// Lista de planes mostrada en la pantalla de trial expirado / pago pendiente.
// Se renderizan en orden Starter → Growth → Pro. Growth se destaca como recomendado.
const PLAN_PICKER_ORDER: { code: "starter" | "growth" | "pro"; recommended?: boolean }[] = [
  { code: "starter" },
  { code: "growth", recommended: true },
  { code: "pro" },
];

interface PlanPickerOption {
  code: string;
  name: string;
  price_monthly: number;
  currency: string;
}

function buildPlanPickerOptions(plan: PlanSummary): PlanPickerOption[] {
  // Unimos plan actual + upgrade_options + downgrade_options para tener Starter/Pro.
  const map = new Map<string, PlanPickerOption>();
  if (plan.price_monthly != null) {
    map.set(plan.plan_code, {
      code: plan.plan_code,
      name: plan.plan_name,
      price_monthly: plan.price_monthly,
      currency: plan.currency,
    });
  }
  for (const opt of [...plan.upgrade_options, ...plan.downgrade_options]) {
    if (!map.has(opt.code) && typeof opt.price_monthly === "number") {
      map.set(opt.code, {
        code: opt.code,
        name: opt.name,
        price_monthly: opt.price_monthly,
        currency: opt.currency,
      });
    }
  }
  return PLAN_PICKER_ORDER
    .map(({ code }) => map.get(code))
    .filter((value): value is PlanPickerOption => Boolean(value));
}

function OnboardingGuide({
  plan,
  onPay,
  checkoutLoading,
  checkoutError,
  upgradeLoading,
}: {
  plan: PlanSummary;
  onPay: (planCode?: string, checkoutType?: string, billingCycle?: "monthly" | "annual") => void;
  checkoutLoading: boolean;
  checkoutError: string | null;
  upgradeLoading: string | null;
}) {
  const [annual, setAnnual] = useState(false);
  // ANNUAL_DISCOUNT viene de plan-display.ts (fuente única: 0.2 = 20% off).
  const trialExpired = plan.access_reason === "trial_expired";
  const pendingPayment = plan.status === "pending_payment";
  const title = trialExpired
    ? "Tu prueba terminó"
    : pendingPayment
      ? "Estamos esperando la confirmación del pago"
      : "Activá tu cuenta y seguí vendiendo";
  const description = trialExpired
    ? "Elegí un plan para seguir usando tu asistente de WhatsApp. Tus conversaciones, contactos y configuración se mantienen intactos."
    : pendingPayment
      ? "Cuando Mercado Pago apruebe la suscripción, tu cuenta se activará automáticamente."
      : "Elegí el plan que mejor se adapte a tu negocio. El acceso se habilita automáticamente al confirmar el pago.";

  const showPlanPicker = trialExpired || pendingPayment === false;
  const planOptions = buildPlanPickerOptions(plan);

  return (
    <div className="h-full overflow-y-auto" style={{ background: "var(--bg)" }}>
      <div className="max-w-3xl mx-auto px-5 py-8 sm:py-10 space-y-7">
        <div>
          <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.24em]" style={{ color: "var(--green-soft)" }}>
            {trialExpired ? "Prueba finalizada" : pendingPayment ? "Pago en proceso" : "Primeros pasos"}
          </p>
          <h2 className="mt-2 text-2xl sm:text-3xl font-semibold" style={{ color: "var(--ink)" }}>
            {title}
          </h2>
          <p className="mt-3 text-sm sm:text-base leading-relaxed" style={{ color: "var(--ink-2)" }}>
            {description}
          </p>
        </div>

        {checkoutError && (
          <div className="rounded-xl px-4 py-3 text-sm" style={{ border: "1px solid rgba(180,35,24,0.3)", background: "rgba(180,35,24,0.08)", color: "#b42318" }}>
            {checkoutError}
          </div>
        )}

        {showPlanPicker && planOptions.length > 0 && (
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-1 rounded-full p-1" style={{ border: "1px solid var(--hairline)", background: "var(--surface)", boxShadow: "var(--shadow-1)" }}>
              <button
                onClick={() => setAnnual(false)}
                className="rounded-full px-4 py-1.5 text-sm font-semibold transition"
                style={!annual ? { background: "var(--ink)", color: "var(--bg)" } : { color: "var(--ink-3)" }}
              >
                Mensual
              </button>
              <button
                onClick={() => setAnnual(true)}
                className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition"
                style={annual ? { background: "var(--ink)", color: "var(--bg)" } : { color: "var(--ink-3)" }}
              >
                Anual
                <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: "var(--green)", color: "var(--on-green)" }}>−20%</span>
              </button>
            </div>
          </div>
        )}

        {showPlanPicker && planOptions.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-3">
            {planOptions.map((opt) => {
              const isRecommended = PLAN_PICKER_ORDER.find((p) => p.code === opt.code)?.recommended;
              const included = PLAN_INCLUDED[opt.code] ?? [];
              const loading = upgradeLoading === opt.code && checkoutLoading;
              const monthlyShown = annual && opt.price_monthly != null
                ? Math.round((opt.price_monthly * (1 - ANNUAL_DISCOUNT)) / 100) * 100
                : opt.price_monthly;
              return (
                <div
                  key={opt.code}
                  className="flex flex-col rounded-2xl p-5"
                  style={{
                    background: "var(--surface)",
                    border: isRecommended ? "1.5px solid var(--green)" : "1px solid var(--hairline)",
                    boxShadow: isRecommended ? "var(--shadow-2)" : "var(--shadow-1)",
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-base font-semibold" style={{ color: "var(--ink)" }}>{opt.name}</p>
                    {isRecommended && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider rounded-full px-2 py-0.5" style={{ color: "var(--green-ink)", background: "var(--green-tint)" }}>
                        Recomendado
                      </span>
                    )}
                  </div>
                  <p className="text-xs min-h-[2.5em] leading-snug" style={{ color: "var(--ink-3)" }}>
                    {PLAN_TAGLINE[opt.code] ?? ""}
                  </p>
                  <p className="mt-3 text-2xl font-semibold" style={{ color: "var(--ink)" }}>
                    {formatMoney(monthlyShown, opt.currency)}
                    <span className="text-sm font-normal" style={{ color: "var(--muted)" }}> / mes</span>
                  </p>
                  {annual && monthlyShown != null && opt.price_monthly != null ? (
                    <div className="min-h-[2.2em]">
                      <p className="text-[11px]" style={{ color: "var(--muted)" }}>
                        {formatMoney(monthlyShown * 12, opt.currency)} · facturado anualmente
                      </p>
                      <p className="text-[11px] font-semibold" style={{ color: "var(--green-soft)" }}>
                        Ahorrás {formatARS((opt.price_monthly - monthlyShown) * 12)} al año
                      </p>
                    </div>
                  ) : (
                    <div className="min-h-[2.2em]" />
                  )}
                  <ul className="space-y-1.5 my-4 flex-1">
                    {included.slice(0, 4).map((f) => (
                      <li key={f} className="flex items-start gap-2 text-xs" style={{ color: "var(--ink-2)" }}>
                        <span className="mt-0.5 shrink-0" style={{ color: "var(--green)" }}>✓</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => onPay(opt.code, opt.code === plan.plan_code ? "initial" : "upgrade", annual ? "annual" : "monthly")}
                    disabled={checkoutLoading}
                    className="w-full rounded-xl py-2.5 text-sm font-semibold transition disabled:opacity-50"
                    style={
                      isRecommended
                        ? { background: "var(--green)", color: "var(--on-green)" }
                        : { background: "var(--ink)", color: "var(--bg)" }
                    }
                  >
                    {loading ? "Redirigiendo..." : `Elegir ${opt.name}`}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {pendingPayment && (
          <div className="rounded-2xl p-5" style={{ border: "1px solid rgba(212,154,58,0.35)", background: "var(--human-tint)" }}>
            <p className="text-sm" style={{ color: "var(--human)" }}>
              Mercado Pago está procesando tu pago. Esta página se actualiza sola; podés cerrarla y volver más tarde.
            </p>
          </div>
        )}

        <p className="text-center text-xs" style={{ color: "var(--muted)" }}>
          ¿Ya pagaste y no se activó?{" "}
          <button
            onClick={() => window.location.reload()}
            className="hover:underline"
            style={{ color: "var(--green-soft)" }}
          >
            Actualizá la página
          </button>
        </p>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PlanOverview({ role = "owner" }: { role?: DashboardRole }) {
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

  async function startCheckout(planCode?: string, checkoutType?: string, billingCycle?: "monthly" | "annual") {
    setCheckoutLoading(true);
    if (planCode) setUpgradeLoading(planCode);
    setCheckoutError(null);
    try {
      const body = planCode
        ? { plan_code: planCode, checkout_type: checkoutType ?? "upgrade", billing_cycle: billingCycle ?? "monthly" }
        : { billing_cycle: billingCycle ?? "monthly" };
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
        <div className="w-8 h-8 rounded-full animate-spin" style={{ border: "4px solid var(--hairline-2)", borderTopColor: "var(--green)" }} />
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

  // Los no-dueños solo llegan acá cuando la cuenta está inactiva (el layout los
  // redirige si está activa). No pueden pagar (la API de checkout es solo owner),
  // así que mostramos el estado sin botones de pago para no frustrarlos con 403s.
  if (role !== "owner") {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", background: "var(--bg)", padding: 24 }}>
        <div className="atd-card" style={{ maxWidth: 460, padding: 28, textAlign: "center" }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)", margin: "0 0 10px" }}>
            {plan.can_use_app ? "Tu plan" : "La cuenta necesita un plan activo"}
          </h2>
          <p style={{ fontSize: 14, color: "var(--ink-3)", margin: "0 0 16px", lineHeight: 1.5 }}>
            {plan.can_use_app
              ? `Este negocio usa el plan ${plan.plan_name}.`
              : "La prueba gratuita o la suscripción de este negocio venció."}{" "}
            La facturación la gestiona el Dueño del negocio. Tu rol actual es {ROLE_LABELS[role]}.
          </p>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
            Pedile al dueño que active o actualice el plan desde su cuenta.
          </p>
        </div>
      </div>
    );
  }

  if (plan.status === "pending_payment" || !plan.can_use_app) {
    return (
      <OnboardingGuide
        plan={plan}
        onPay={(code, type, cycle) => startCheckout(code, type, cycle)}
        checkoutLoading={checkoutLoading}
        checkoutError={checkoutError}
        upgradeLoading={upgradeLoading}
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
            <div className="page-sub">plan</div>
            <h1 className="page-title">Suscripción</h1>
          </div>
        </div>

        {plan.status === "trial" && plan.can_use_app && (
          <div style={{ margin: "0 0 14px", padding: 16, borderRadius: 16, background: "rgba(31,107,74,0.09)", border: "1px solid rgba(31,107,74,0.18)", display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--green-ink)" }}>
                Estás usando tu prueba gratuita de 14 días.
              </div>
              <div style={{ fontSize: 13, color: "var(--green-soft)", marginTop: 2 }}>
                Te quedan {plan.days_left_trial ?? 0} días con el plan {plan.plan_name}. Activá un plan para no perder el acceso.
              </div>
            </div>
            <button
              onClick={() => startCheckout()}
              disabled={checkoutLoading}
              className="atd-btn green sm"
            >
              {checkoutLoading ? "Redirigiendo..." : "Ver planes"}
            </button>
          </div>
        )}

        {plan.status === "trial" && plan.can_use_app && (plan.days_left_trial ?? 0) <= 3 && (
          <div style={{ margin: "0 0 14px", padding: 12, borderRadius: 12, background: "rgba(234,179,8,0.12)", color: "#854d0e", fontSize: 13 }}>
            Tu prueba gratuita termina pronto. Activá tu plan para que el bot siga respondiendo sin interrupciones.
          </div>
        )}

        <div style={{ margin: "0 0 12px", padding: 16, borderRadius: 14, background: "var(--surface)", border: "1px solid var(--hairline)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
            <div>
              <div className="page-sub" style={{ marginBottom: 3 }}>plan actual</div>
              <div style={{ fontSize: 24, fontWeight: 750, lineHeight: 1, color: "var(--ink)" }}>{plan.plan_name}</div>
              <p style={{ fontSize: 12.5, color: "var(--ink-3)", margin: "7px 0 0" }}>{PLAN_TAGLINE[currentCode] ?? ""}</p>
            </div>
            <span className="mono" style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap" }}>
              {plan.status === "active" ? "activo" : plan.status} · vence {formatDate(plan.current_period_end)}
            </span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {plan.upgrade_options.length > 0 && (
              <button
                onClick={() => startCheckout(plan.upgrade_options[0].code, "upgrade")}
                disabled={checkoutLoading}
                className="atd-btn primary sm"
                style={{ flex: 1 }}
              >
                {checkoutLoading ? "..." : `Mejorar a ${plan.upgrade_options[0].name}`}
              </button>
            )}
            {!plan.cancel_at_period_end && (plan.status === "active" || plan.status === "trial") && (
              <button
                onClick={() => setShowCancelModal(true)}
                className="atd-btn ghost sm"
              >
                Cancelar
              </button>
            )}
            {plan.cancel_at_period_end && (
              <button onClick={handleReactivatePlan} disabled={reactivateLoading} className="atd-btn ghost sm" style={{ flex: 1 }}>
                {reactivateLoading ? "..." : "Reactivar"}
              </button>
            )}
          </div>
          {plan.cancel_at_period_end && (
              <p style={{ fontSize: 12, color: "var(--human)", marginTop: 10 }}>
                Cancelación programada al {formatDate(plan.current_period_end)}.
              </p>
            )}
        </div>

        {checkoutError && (
          <div style={{ margin: "0 0 12px", padding: 12, borderRadius: 12, background: "rgba(192,57,43,0.1)", color: "#c0392b", fontSize: 13 }}>
            {checkoutError}
          </div>
        )}

        <div className="lg:grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-3">
          {/* Usage */}
          <div className="atd-card" style={{ margin: "0 0 12px", padding: 16 }}>
            <div className="page-sub" style={{ marginBottom: 10 }}>uso del plan</div>
            {[
              { label: "Usuarios", used: 1, limit: plan.users_limit },
              { label: "Productos", used: plan.product_count, limit: plan.product_limit },
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
          <div className="atd-card" style={{ margin: "0 0 12px", padding: 16 }}>
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
          <div key={opt.code} className="atd-card" style={{ margin: "0 0 10px", padding: 16, background: "var(--accent-soft)", borderColor: "transparent" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
              <span style={{ width: 32, height: 32, borderRadius: 10, background: "var(--accent)", color: "var(--on-accent)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 16 }}>✦</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: "var(--accent-ink)" }}>Mejorar a {opt.name}</div>
                <div style={{ fontSize: 12, color: "var(--accent-ink)", opacity: 0.75, marginTop: 2 }}>
                  {PLAN_TAGLINE[opt.code] ?? "Más funciones y más capacidad."}
                </div>
                <div style={{ fontSize: 11, color: "var(--accent-ink)", opacity: 0.6, marginTop: 3 }}>
                  {formatMoney(opt.price_monthly, opt.currency)}/mes ·{" "}
                  o {formatMoney(Math.round((opt.price_monthly * (1 - ANNUAL_DISCOUNT)) / 100) * 100, opt.currency)}/mes con pago anual
                </div>
              </div>
            </div>
            <button
              onClick={() => startCheckout(opt.code, "upgrade")}
              disabled={checkoutLoading}
              className="atd-btn accent sm"
              style={{ width: "100%" }}
            >
              {(upgradeLoading === opt.code && checkoutLoading) ? "Redirigiendo..." : `Mejorar a ${opt.name}`}
            </button>
          </div>
        ))}

        {/* Downgrade options */}
        {plan.downgrade_options.length > 0 && (
          <div className="atd-card" style={{ margin: "0 0 10px", padding: 16 }}>
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
          <div style={{ margin: "0 0 10px" }}>
            <button onClick={() => startCheckout()} disabled={checkoutLoading} className="atd-btn green" style={{ width: "100%" }}>
              {checkoutLoading ? "Redirigiendo..." : "Renovar plan"}
            </button>
          </div>
        )}

        {/* Soporte */}
        <SupportCard />

      {/* Cancel modal */}
      {showCancelModal && (
        <div className="atd-overlay" style={{ zIndex: 140 }}>
          <div className="atd-modal" style={{ width: "100%", maxWidth: 400, padding: 24 }}>
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
        <div className="atd-overlay" style={{ zIndex: 140 }}>
          <div className="atd-modal" style={{ width: "100%", maxWidth: 400, padding: 24 }}>
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
