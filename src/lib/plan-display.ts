export type PublicPlanCode = "starter" | "growth" | "pro";

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
    priceMonthly: 49000,
    priceLabel: "$49.000 / mes",
    description: "Para empezar a responder con IA.",
    cta: "Empezar con Starter",
    features: [
      "1 número de WhatsApp",
      "500 conversaciones/mes",
      "500 respuestas IA",
      "10 productos en catálogo",
      "1 usuario del equipo",
      "Plantillas básicas",
    ],
  },
  growth: {
    code: "growth",
    name: "Growth",
    priceMonthly: 89000,
    priceLabel: "$89.000 / mes",
    description: "Para vender más por WhatsApp.",
    badge: "Más vendido",
    cta: "Empezar con Growth",
    features: [
      "1 número de WhatsApp",
      "2.000 conversaciones/mes",
      "2.000 respuestas IA",
      "100 productos en catálogo",
      "5 plantillas comerciales",
      "Equipo hasta 10 personas",
    ],
  },
  pro: {
    code: "pro",
    name: "Pro",
    priceMonthly: 149000,
    priceLabel: "$149.000 / mes",
    description: "Para negocios con más volumen y equipo.",
    cta: "Empezar con Pro",
    features: [
      "Hasta 3 números de WhatsApp",
      "10.000 conversaciones/mes",
      "10.000 respuestas IA",
      "500 productos en catálogo",
      "Plantillas premium",
      "Equipo hasta 25 personas",
    ],
  },
};

export const PUBLIC_PLAN_LIST = [
  PUBLIC_PLANS.starter,
  PUBLIC_PLANS.growth,
  PUBLIC_PLANS.pro,
] as const;

export function getPublicPlan(code: string | null | undefined): PublicPlanDefinition {
  if (!code) return PUBLIC_PLANS.starter;
  return PUBLIC_PLANS[code as PublicPlanCode] ?? PUBLIC_PLANS.starter;
}
