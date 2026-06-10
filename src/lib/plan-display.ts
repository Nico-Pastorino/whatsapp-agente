export type PublicPlanCode = "starter" | "growth" | "pro";
export type BillingCycle = "monthly" | "annual";

/** Descuento aplicado al pagar 12 meses por adelantado. FUENTE ÚNICA — importar desde acá. */
export const ANNUAL_DISCOUNT = 0.2; // 20% off

/** Duración del trial en días. Siempre 14, en plan Growth. */
export const TRIAL_DAYS = 14;
export const TRIAL_PLAN_CODE: PublicPlanCode = "growth";

export interface PublicPlanDefinition {
  code: PublicPlanCode;
  name: string;
  /** Precio mensual de lista (ARS). */
  priceMonthly: number;
  /** Precio mensual equivalente cuando se paga anual (ARS, ya con descuento). */
  priceMonthlyAnnual: number;
  /** Total que se cobra una vez al año (ARS). */
  priceYearly: number;
  description: string;
  badge?: string;
  cta: string;
  features: string[];
}

function annualMonthly(monthly: number): number {
  return Math.round((monthly * (1 - ANNUAL_DISCOUNT)) / 100) * 100;
}

function buildPlan(
  base: Omit<PublicPlanDefinition, "priceMonthlyAnnual" | "priceYearly">
): PublicPlanDefinition {
  const priceMonthlyAnnual = annualMonthly(base.priceMonthly);
  return {
    ...base,
    priceMonthlyAnnual,
    priceYearly: priceMonthlyAnnual * 12,
  };
}

export const PUBLIC_PLANS: Record<PublicPlanCode, PublicPlanDefinition> = {
  starter: buildPlan({
    code: "starter",
    name: "Starter",
    priceMonthly: 49000,
    description: "Para empezar a responder consultas con IA.",
    // Todos los planes llevan al mismo trial Growth de 14 días.
    // El CTA del Starter explica el acceso inmediato.
    cta: "Empezar con Starter",
    features: [
      "1 número de WhatsApp",
      "Conversaciones ilimitadas",
      "Hasta 20 productos en catálogo",
      "Hasta 3 usuarios del equipo",
      "Plantilla básica de rubro",
      "Modo humano (tomás el control)",
    ],
  }),
  growth: buildPlan({
    code: "growth",
    name: "Growth",
    priceMonthly: 89000,
    description: "Para negocios que ya venden y quieren escalar.",
    badge: "Más popular",
    // CTA diferenciado: Growth es el plan del trial, así el usuario sabe qué prueba.
    cta: "Probar gratis 14 días",
    features: [
      "Todo lo del Starter",
      "Plantillas comerciales por rubro",
      "Hasta 150 productos en catálogo",
      "Hasta 10 usuarios del equipo",
      "Avisos al encargado por WhatsApp",
      "Base de conocimiento para la IA",
      "Agenda de turnos automática 🗓️",
      "Métricas de conversaciones",
    ],
  }),
  pro: buildPlan({
    code: "pro",
    name: "Pro",
    priceMonthly: 149000,
    description: "Para equipos que viven de WhatsApp.",
    cta: "Empezar con Pro",
    features: [
      "Todo lo del Growth",
      "Plantillas premium (todos los rubros)",
      "Hasta 1.000 productos en catálogo",
      "Hasta 25 usuarios del equipo",
      // NOTA TÉCNICA: "Hasta 3 números de WhatsApp" fue eliminado porque
      // el worker actualmente soporta 1 sesión por negocio. No prometer
      // lo que no está implementado. Re-agregar cuando multi-sesión esté listo.
      "Soporte prioritario por email",
      "Métricas avanzadas de conversaciones",
    ],
  }),
};

export const PUBLIC_PLAN_LIST = [
  PUBLIC_PLANS.starter,
  PUBLIC_PLANS.growth,
  PUBLIC_PLANS.pro,
] as const;

const ARS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

/** "$29.000" */
export function formatARS(value: number): string {
  return ARS.format(value).replace(/\s/g, "");
}

/** Precio mensual a mostrar según ciclo de facturación. */
export function priceForCycle(plan: PublicPlanDefinition, cycle: BillingCycle): number {
  return cycle === "annual" ? plan.priceMonthlyAnnual : plan.priceMonthly;
}

export function getPublicPlan(code: string | null | undefined): PublicPlanDefinition {
  if (!code) return PUBLIC_PLANS.growth;
  return PUBLIC_PLANS[code as PublicPlanCode] ?? PUBLIC_PLANS.growth;
}
