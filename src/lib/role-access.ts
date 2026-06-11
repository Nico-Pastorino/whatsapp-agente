// Acceso por rol — FUENTE ÚNICA para la sidebar, la tab bar mobile, la
// pantalla "Más" y el gate del layout de /app.
//
// Regla de producto:
//   - owner (Dueño): acceso total, incluida facturación y conexión de WhatsApp.
//   - admin: gestiona la operación (negocio, catálogo, agenda, equipo, métricas)
//     pero NO ve "Mi plan" ni "Conectar" (el backend ya lo bloquea: solo owner).
//   - agent (Operador): atiende. Solo Inicio, Conversaciones, Reservas/Turnos,
//     Más y Ayuda. El backend ya le bloquea el resto; acá lo sacamos de la UI.

export type DashboardRole = "owner" | "admin" | "agent";

export type DashboardView =
  | "conversations"
  | "business"
  | "catalog"
  | "agenda"
  | "home"
  | "more"
  | "plan"
  | "team"
  | "connect"
  | "stats"
  | "support";

const ALL_VIEWS: DashboardView[] = [
  "home",
  "conversations",
  "business",
  "catalog",
  "agenda",
  "plan",
  "team",
  "stats",
  "connect",
  "more",
  "support",
];

const VIEWS_BY_ROLE: Record<DashboardRole, ReadonlySet<DashboardView>> = {
  owner: new Set(ALL_VIEWS),
  admin: new Set(ALL_VIEWS.filter((v) => v !== "plan" && v !== "connect")),
  agent: new Set<DashboardView>(["home", "conversations", "agenda", "more", "support"]),
};

export function canAccessView(role: DashboardRole, view: DashboardView): boolean {
  return VIEWS_BY_ROLE[role]?.has(view) ?? false;
}

/** A dónde mandamos a cada rol cuando intenta entrar a una vista que no le corresponde. */
export const ROLE_HOME_PATH: Record<DashboardRole, string> = {
  owner: "/app/home",
  admin: "/app/home",
  agent: "/app/conversations",
};

const PATH_TO_VIEW: Array<[prefix: string, view: DashboardView]> = [
  ["/app/home", "home"],
  ["/app/conversations", "conversations"],
  ["/app/business", "business"],
  ["/app/catalog", "catalog"],
  ["/app/agenda", "agenda"],
  ["/app/plan", "plan"],
  ["/app/team", "team"],
  ["/app/stats", "stats"],
  ["/app/connect", "connect"],
  ["/app/more", "more"],
  ["/app/support", "support"],
];

export function viewForPathname(pathname: string | null): DashboardView | null {
  if (!pathname) return null;
  for (const [prefix, view] of PATH_TO_VIEW) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return view;
  }
  return null;
}

export const ROLE_LABELS: Record<DashboardRole, string> = {
  owner: "Dueño",
  admin: "Admin",
  agent: "Operador",
};

/** Descripción corta de qué puede hacer cada rol — visible al invitar/cambiar rol. */
export const ROLE_DESCRIPTIONS: Record<DashboardRole, string> = {
  owner:
    "Acceso total: negocio, catálogo, equipo, métricas, plan, pagos y conexión de WhatsApp.",
  admin:
    "Gestiona el negocio: configuración, catálogo, reservas, conversaciones, métricas y equipo. No ve el plan ni la conexión de WhatsApp.",
  agent:
    "Atiende conversaciones y gestiona reservas/turnos. No accede a configuración, catálogo, métricas, equipo ni pagos.",
};
