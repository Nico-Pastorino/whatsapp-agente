import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { checkAccountAccess } from "@/lib/db";
import { requireDashboardBusinessContext, DashboardAuthError } from "@/lib/dashboard-auth";
import { canAccessView, viewForPathname, ROLE_HOME_PATH } from "@/lib/role-access";

// Rutas operativas que se bloquean cuando el trial venció / la cuenta está sin pagar.
// /app/plan se deja libre para que el usuario pueda pagar y reactivar.
const OPERATIONAL_PREFIXES = [
  "/app/home",
  "/app/conversations",
  "/app/connect",
  "/app/business",
  "/app/catalog",
  "/app/agenda",
  "/app/team",
  "/app/stats",
  "/app/more",
];

const PLAN_PATH = "/app/plan";

function isOperationalPath(pathname: string | null): boolean {
  if (!pathname) return false;
  // /app (sin slash) y /app/ → redirigimos al gate también
  if (pathname === "/app" || pathname === "/app/") return true;
  return OPERATIONAL_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isPlanPath(pathname: string | null): boolean {
  return pathname === PLAN_PATH || (pathname?.startsWith(`${PLAN_PATH}/`) ?? false);
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const hdrs = await headers();
  const pathname = hdrs.get("x-pathname");

  // Rutas sin gate (soporte, verificación de email): el middleware ya exige sesión.
  // /app/plan SÍ pasa por acá ahora — el gate por rol decide si el usuario puede verla.
  if (!isOperationalPath(pathname) && !isPlanPath(pathname)) {
    return children;
  }

  // Resolver businessId desde la sesión activa. Si falla la autenticación,
  // dejamos que la página/route handle el error normalmente (el middleware
  // ya filtró sesiones inválidas en la mayoría de los casos).
  try {
    const ctx = await requireDashboardBusinessContext();
    const access = await checkAccountAccess(ctx.businessId);

    // ── Gate por ROL ───────────────────────────────────────────────────────
    // El backend ya bloquea las APIs; esto evita que un Operador/Admin navegue
    // a secciones que no le corresponden (antes veía todo y le fallaban las acciones).
    const view = viewForPathname(pathname);
    if (view && !canAccessView(ctx.role, view)) {
      // Excepción: si la cuenta está inactiva, dejamos ver /app/plan a cualquier
      // rol (muestra el estado "activá tu plan" sin acciones de pago para no-dueños).
      // Sin esta excepción habría un loop: gate de cuenta → /app/plan → gate de rol → vuelta.
      const allowInactivePlanView = view === "plan" && !access.canUseApp;
      if (!allowInactivePlanView) {
        console.log(
          `[gate] role redirect business_id=${ctx.businessId} role=${ctx.role} view=${view}`
        );
        redirect(ROLE_HOME_PATH[ctx.role]);
      }
    }

    // ── Gate por CUENTA (trial vencido / sin pagar) ────────────────────────
    if (isOperationalPath(pathname) && !access.canUseApp) {
      console.log(
        `[gate] redirect to ${PLAN_PATH} business_id=${ctx.businessId} reason=${access.reason}`
      );
      redirect(PLAN_PATH);
    }
  } catch (err) {
    // Importante: NEXT_REDIRECT viaja como excepción; dejarla propagar.
    if (err && typeof err === "object" && (err as { digest?: string }).digest?.toString().startsWith("NEXT_REDIRECT")) {
      throw err;
    }
    if (err instanceof DashboardAuthError) {
      // Sin sesión / sin negocio → /login
      redirect("/login");
    }
    // Error inesperado: no bloqueamos, dejamos pasar para no romper UX si la DB hace ruido.
    console.error("[gate] unexpected error, allowing navigation:", err);
  }

  return children;
}
