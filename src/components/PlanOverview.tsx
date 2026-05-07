"use client";

import { useEffect, useState } from "react";
import type { UpgradeOption } from "@/lib/db";

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
    "Hasta 3 usuarios del equipo",
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

// ── Main component ────────────────────────────────────────────────────────────

export default function PlanOverview() {
  const [plan, setPlan] = useState<PlanSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

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
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!plan || error) {
    return (
      <div className="h-full bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">
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
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">

        {/* Inactive banner */}
        {(plan.status === "canceled" || plan.status === "past_due") && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
            <strong>Tu suscripción está inactiva.</strong> Renová tu plan para volver a operar.
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-600">
              Mi plan
            </p>
            <h2 className="mt-1 text-3xl font-semibold text-gray-900">
              {plan.plan_name}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {PLAN_TAGLINE[currentCode] ?? ""}
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-3 shadow-sm text-right shrink-0">
            <p className="text-xs uppercase tracking-[0.24em] text-gray-400">Valor mensual</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">
              {formatMoney(plan.price_monthly, plan.currency)}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              Vence: {formatDate(plan.current_period_end)}
            </p>
          </div>
        </div>

        {/* Usage */}
        <section className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Uso este período</h3>
          <UsageBar
            label="Mensajes entrantes"
            used={plan.inbound_messages_count}
            limit={plan.monthly_message_limit ?? plan.conversation_limit}
          />
          <UsageBar
            label="Respuestas IA"
            used={plan.ai_replies_count}
            limit={
              plan.monthly_ai_reply_limit ??
              (typeof plan.features?.ai_reply_limit === "number"
                ? (plan.features.ai_reply_limit as number)
                : null)
            }
          />
        </section>

        {/* Features included / locked */}
        <div className="grid gap-4 sm:grid-cols-2">
          <section className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Incluido en tu plan</h3>
            <ul className="space-y-2">
              {includedFeatures.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="mt-0.5 shrink-0">✅</span>
                  {f}
                </li>
              ))}
            </ul>
          </section>

          {lockedFeatures.length > 0 ? (
            <section className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Disponible en planes superiores
              </h3>
              <ul className="space-y-2">
                {lockedFeatures.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-400">
                    <span className="mt-0.5 shrink-0">🔒</span>
                    {f}
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <section className="bg-emerald-50 rounded-2xl border border-emerald-200 p-5 flex items-center justify-center">
              <div className="text-center">
                <p className="text-3xl">🏆</p>
                <p className="mt-2 text-sm font-semibold text-emerald-800">
                  Estás en el plan más completo.
                </p>
                <p className="mt-1 text-xs text-emerald-600">
                  Tenés acceso a todas las funciones disponibles.
                </p>
              </div>
            </section>
          )}
        </div>

        {/* Capacity */}
        <section className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Capacidades del plan</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Contactos", value: plan.conversation_limit },
              { label: "Productos", value: plan.product_limit },
              { label: "Usuarios", value: plan.users_limit },
              { label: "Números WA", value: plan.whatsapp_numbers_limit },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl bg-gray-50 p-3 text-center">
                <p className="text-xs text-gray-500">{label}</p>
                <p className="mt-1 text-lg font-semibold text-gray-900">
                  {value ?? "∞"}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Upgrade / Renew */}
        {(plan.upgrade_options.length > 0 ||
          plan.status === "canceled" ||
          plan.status === "past_due") && (
          <section className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              {plan.upgrade_options.length > 0 ? "Mejorar tu plan" : "Renovar suscripción"}
            </h3>

            {checkoutError && (
              <p className="mb-3 text-sm text-red-600">{checkoutError}</p>
            )}

            {(plan.status === "canceled" || plan.status === "past_due") && (
              <button
                onClick={() => startCheckout()}
                disabled={checkoutLoading}
                className="w-full mb-4 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-50"
              >
                {checkoutLoading ? "Redirigiendo..." : "Renovar plan"}
              </button>
            )}

            {plan.upgrade_options.length > 0 && (
              <div className={`grid gap-4 ${plan.upgrade_options.length > 1 ? "sm:grid-cols-2" : ""}`}>
                {plan.upgrade_options.map((opt) => (
                  <UpgradeCard
                    key={opt.code}
                    option={opt}
                    onUpgrade={(code) => startCheckout(code, "upgrade")}
                    loading={upgradeLoading === opt.code && checkoutLoading}
                  />
                ))}
              </div>
            )}
          </section>
        )}

      </div>
    </div>
  );
}
