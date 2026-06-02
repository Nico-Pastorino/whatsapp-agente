// Señales comerciales derivadas de una conversación, para el inbox.
// Importante: esto es una lectura LIVIANA del último mensaje del cliente —
// NO toca el worker ni la base de datos. Da una pista visual rápida al equipo.
// La versión "persistida" (usando el análisis de intención de la IA) queda
// recomendada para una próxima iteración.

export type LeadSignalKey =
  | "attention"
  | "booking"
  | "price"
  | "interested"
  | null;

export interface LeadSignal {
  key: Exclude<LeadSignalKey, null>;
  label: string;
  /** Estilo: color de fondo y de texto via CSS vars. */
  bg: string;
  fg: string;
}

interface ConversationLike {
  mode: "AI" | "HUMAN";
  needs_attention: boolean;
  last_message_preview?: string | null;
}

const BOOKING_RE = /\b(reserv|turno|cita|agend|reservar|sacar (un )?turno|disponibilidad)\b/i;
const PRICE_RE = /\b(precio|cu[áa]nto (sale|cuesta|vale)|vale|cuotas|financ|presupuesto|descuento|oferta)\b/i;
const INTENT_RE = /\b(me interesa|quiero (comprar|llevar|el|la|uno|una)|lo llevo|comprar|cómo (compro|pago)|como (compro|pago)|se[ñn]a)\b/i;

/**
 * Devuelve la señal comercial más relevante de una conversación, o null.
 * Prioridad: necesita atención > quiere reservar > pregunta precio > interesado.
 */
export function deriveLeadSignal(conv: ConversationLike): LeadSignal | null {
  if (conv.needs_attention && conv.mode !== "AI") {
    return {
      key: "attention",
      label: "Necesita atención",
      bg: "var(--human-tint)",
      fg: "var(--human)",
    };
  }

  const text = (conv.last_message_preview ?? "").toLowerCase();
  if (!text) return null;

  if (BOOKING_RE.test(text)) {
    return { key: "booking", label: "Quiere reservar", bg: "var(--green-tint)", fg: "var(--green-ink)" };
  }
  if (PRICE_RE.test(text)) {
    return { key: "price", label: "Pregunta precio", bg: "var(--accent-soft)", fg: "var(--accent-ink)" };
  }
  if (INTENT_RE.test(text)) {
    return { key: "interested", label: "Interesado", bg: "var(--accent-soft)", fg: "var(--accent-ink)" };
  }
  return null;
}
