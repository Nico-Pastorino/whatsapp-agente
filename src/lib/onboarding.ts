// Fuente única de verdad para el onboarding / entrenamiento del asistente.
// Módulo plano (sin "server-only"): lo usan tanto componentes de cliente
// (BusinessConfig, HomeScreen) como el armado del prompt en el servidor.

export interface TonePreset {
  code: string;
  label: string;
  emoji: string;
  /** Descripción que se inserta en el prompt de la IA. */
  hint: string;
}

/** Tonos de respuesta disponibles para el asistente. */
export const TONE_PRESETS: TonePreset[] = [
  {
    code: "cercano",
    label: "Cercano y amable",
    emoji: "😊",
    hint: "cálido y cercano, como un buen vendedor que trata bien a la gente",
  },
  {
    code: "profesional",
    label: "Profesional y claro",
    emoji: "💼",
    hint: "profesional, claro y respetuoso, sin sonar frío ni distante",
  },
  {
    code: "divertido",
    label: "Relajado y con onda",
    emoji: "✨",
    hint: "relajado y con buena onda, con un toque de humor sutil cuando encaje",
  },
  {
    code: "directo",
    label: "Directo y al grano",
    emoji: "⚡",
    hint: "directo y concreto, sin vueltas, con respuestas breves",
  },
];

/** Devuelve la descripción de prompt para un código de tono, o null si no aplica. */
export function toneHint(code: string | null | undefined): string | null {
  if (!code) return null;
  return TONE_PRESETS.find((t) => t.code === code)?.hint ?? null;
}

/** Etiqueta legible de un código de tono. */
export function toneLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  return TONE_PRESETS.find((t) => t.code === code)?.label ?? null;
}

// ── Checklist de entrenamiento del asistente ────────────────────────────────

export interface AssistantProfileLike {
  name?: string | null;
  description?: string | null;
  extra?: string | null;
  knowledge_base?: string | null;
  response_tone?: string | null;
  notify_enabled?: boolean | null;
  notify_phone?: string | null;
}

export interface ChecklistItem {
  key: string;
  label: string;
  done: boolean;
  /** Ancla (#...) o ruta (/app/...) a la que lleva el ítem. */
  href: string;
}

/**
 * Construye el checklist de entrenamiento del asistente a partir del perfil
 * del negocio y la cantidad de ítems del catálogo. Es la ÚNICA definición:
 * la usan "Mi negocio" y el Centro de control para no desincronizarse.
 */
export function buildAssistantChecklist(
  profile: AssistantProfileLike,
  catalogCount: number
): ChecklistItem[] {
  const name = (profile.name ?? "").trim();
  const description = (profile.description ?? "").trim();
  const extra = (profile.extra ?? "").trim();
  const kb = (profile.knowledge_base ?? "").trim();
  const tone = (profile.response_tone ?? "").trim();

  return [
    {
      key: "business",
      label: "Datos del negocio",
      done: Boolean(name && description),
      href: "#datos-negocio",
    },
    {
      key: "catalog",
      label: "Productos o servicios",
      done: catalogCount > 0,
      href: "/app/catalog",
    },
    {
      key: "faq",
      label: "Preguntas frecuentes",
      done: Boolean(kb),
      href: "#preguntas-frecuentes",
    },
    {
      key: "info",
      label: "Horarios e información clave",
      done: Boolean(extra),
      href: "#info-clave",
    },
    {
      key: "tone",
      label: "Tono de respuesta",
      done: Boolean(tone),
      href: "#tono-respuesta",
    },
    {
      key: "notify",
      label: "Avisos al encargado",
      done: Boolean(profile.notify_enabled && (profile.notify_phone ?? "").trim()),
      href: "#avisos-encargado",
    },
  ];
}

/** Porcentaje 0–100 de completitud del entrenamiento del asistente. */
export function assistantProgress(items: ChecklistItem[]): number {
  if (items.length === 0) return 0;
  const done = items.filter((i) => i.done).length;
  return Math.round((done / items.length) * 100);
}
