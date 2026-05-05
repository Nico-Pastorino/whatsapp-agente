"use client";

import { useEffect, useState } from "react";

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
}

function formatDate(value: number | null): string {
  if (!value) return "Sin fecha";
  return new Date(value * 1000).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatMoney(value: number | null, currency: string): string {
  if (typeof value !== "number") return "A medida";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export default function PlanOverview() {
  const [plan, setPlan] = useState<PlanSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  async function handlePay() {
    setCheckoutLoading(true);
    setCheckoutError(null);
    try {
      const res = await fetch("/api/billing/create-checkout", { method: "POST" });
      const data = await res.json().catch(() => ({})) as { checkoutUrl?: string; error?: string };
      if (!res.ok || !data.checkoutUrl) {
        setCheckoutError(data.error ?? "No se pudo iniciar el pago.");
        return;
      }
      window.location.href = data.checkoutUrl;
    } catch {
      setCheckoutError("Error de conexión. Intentá de nuevo.");
    } finally {
      setCheckoutLoading(false);
    }
  }

  useEffect(() => {
    fetch("/api/plan")
      .then(async (response) => {
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? "No se pudo cargar el plan.");
        }
        return response.json();
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

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {plan.status === "pending_payment" && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
            <strong>Tu suscripción está pendiente de pago.</strong> Accedé al inbox y conectá WhatsApp después de completar el pago.
          </div>
        )}
        {(plan.status === "canceled" || plan.status === "past_due") && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
            <strong>Tu suscripción está inactiva.</strong> Renová tu plan para volver a operar.
          </div>
        )}
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-600">
              Mi plan
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-gray-900">
              {plan.plan_name}
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Estado: <span className="font-medium text-gray-700">{plan.status}</span>
              {" · "}
              Período actual: {formatDate(plan.current_period_start)} al{" "}
              {formatDate(plan.current_period_end)}
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.24em] text-gray-400">Valor mensual</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900">
              {formatMoney(plan.price_monthly, plan.currency)}
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <article className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Conversaciones mensuales</p>
            <p className="mt-3 text-3xl font-semibold text-gray-900">
              {plan.inbound_messages_count}
            </p>
            <p className="mt-1 text-sm text-gray-400">
              Límite: {plan.monthly_message_limit ?? "Ilimitado"}
            </p>
          </article>
          <article className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Respuestas IA</p>
            <p className="mt-3 text-3xl font-semibold text-gray-900">
              {plan.ai_replies_count}
            </p>
            <p className="mt-1 text-sm text-gray-400">
              Límite: {plan.monthly_ai_reply_limit ?? "Ilimitado"}
            </p>
          </article>
          <article className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Mensajes humanos</p>
            <p className="mt-3 text-3xl font-semibold text-gray-900">
              {plan.human_messages_count}
            </p>
            <p className="mt-1 text-sm text-gray-400">Uso acumulado del período actual</p>
          </article>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.3fr_0.9fr]">
          <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900">Capacidades incluidas</h3>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-gray-50 p-4">
                <p className="text-sm text-gray-500">Límite de contactos activos</p>
                <p className="mt-2 text-xl font-semibold text-gray-900">
                  {plan.conversation_limit ?? "Flexible"}
                </p>
              </div>
              <div className="rounded-2xl bg-gray-50 p-4">
                <p className="text-sm text-gray-500">Productos / servicios</p>
                <p className="mt-2 text-xl font-semibold text-gray-900">
                  {plan.product_limit ?? "Flexible"}
                </p>
              </div>
              <div className="rounded-2xl bg-gray-50 p-4">
                <p className="text-sm text-gray-500">Usuarios del equipo</p>
                <p className="mt-2 text-xl font-semibold text-gray-900">
                  {plan.users_limit ?? 1}
                </p>
              </div>
              <div className="rounded-2xl bg-gray-50 p-4">
                <p className="text-sm text-gray-500">Números de WhatsApp</p>
                <p className="mt-2 text-xl font-semibold text-gray-900">
                  {plan.whatsapp_numbers_limit ?? 1}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900">Acciones</h3>

            {plan.status === "pending_payment" && (
              <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-medium text-amber-800">
                  Tu plan está pendiente de pago.
                </p>
                <p className="mt-1 text-sm text-amber-700">
                  Activá tu suscripción para acceder al inbox y conectar WhatsApp.
                </p>
              </div>
            )}

            {checkoutError && (
              <p className="mt-3 text-sm text-red-600">{checkoutError}</p>
            )}

            <div className="mt-4 space-y-3">
              {(plan.status === "pending_payment" || plan.status === "canceled" || plan.status === "past_due") && (
                <button
                  onClick={handlePay}
                  disabled={checkoutLoading}
                  className="w-full rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-50"
                >
                  {checkoutLoading ? "Redirigiendo a pago..." : plan.status === "pending_payment" ? "Pagar ahora" : "Renovar plan"}
                </button>
              )}
              {(plan.status === "active" || plan.status === "trial") && (
                <button
                  onClick={handlePay}
                  disabled={checkoutLoading}
                  className="w-full rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                >
                  {checkoutLoading ? "Redirigiendo..." : "Renovar / Mejorar plan"}
                </button>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
