export type PublicPlanCode = "starter" | "pro";

export interface PublicPlanDefinition {
  code: PublicPlanCode;
  name: string;
  priceMonthly: number;
  priceLabel: string;
  description: string;
  badge?: string;
  cta: string;
  features: string[];
}

export const PUBLIC_PLANS: Record<PublicPlanCode, PublicPlanDefinition> = {
  starter: {
    code: "starter",
    name: "Starter",
    priceMonthly: 39000,
    priceLabel: "$39.000 / mes",
    description: "Para empezar a responder consultas con IA.",
    cta: "Empezar con Starter",
    features: [
      "1 número de WhatsApp",
      "Conversaciones ilimitadas",
      "Hasta 15 productos en catálogo",
      "Hasta 3 usuarios del equipo",
      "Plantilla básica de rubro",
      "Modo humano (tomás el control)",
    ],
  },
  pro: {
    code: "pro",
    name: "Pro",
    priceMonthly: 89000,
    priceLabel: "$89.000 / mes",
    description: "Para negocios que quieren vender más por WhatsApp.",
    badge: "Más popular",
    cta: "Empezar con Pro",
    features: [
      "Todo lo del Starter",
      "Plantillas comerciales (5 rubros activos)",
      "Hasta 500 productos en catálogo",
      "Hasta 15 usuarios del equipo",
      "Métricas de conversaciones",
      "Soporte prioritario",
    ],
  },
};

export const PUBLIC_PLAN_LIST = [
  PUBLIC_PLANS.starter,
  PUBLIC_PLANS.pro,
] as const;

export function getPublicPlan(code: string | null | undefined): PublicPlanDefinition {
  if (!code) return PUBLIC_PLANS.pro;
  return PUBLIC_PLANS[code as PublicPlanCode] ?? PUBLIC_PLANS.pro;
}
