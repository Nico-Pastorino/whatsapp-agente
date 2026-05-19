import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { checkAccountAccess } from "@/lib/db";
import { requireDashboardBusinessContext, DashboardAuthError } from "@/lib/dashboard-auth";

// Rutas operativas que se bloquean cuando el trial venció / la cuenta está sin pagar.
// /app/plan se deja libre para que el usuario pueda pagar y reactivar.
const OPERATIONAL_PREFIXES = [
  "/app/home",
  "/app/conversations",
  "/app/connect",
  "/app/business",
  "/app/catalog",
  "/app/team",
  "/app/more",
];

const PLAN_PATH = "/app/plan";

function isOperationalPath(pathname: string | null): boolean {
  if (!pathname) return false;
  // /app (sin slash) y /app/ → redirigimos al gate también
  if (pathname === "/app" || pathname === "/app/") return true;
  return OPERATIONAL_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const hdrs = await headers();
  const pathname = hdrs.get("x-pathname");

  // Si la ruta es /app/plan no aplicamos gate (queremos que el usuario pueda pagar).
  if (!isOperationalPath(pathname)) {
    return children;
  }

  // Resolver businessId desde la sesión activa. Si falla la autenticación,
  // dejamos que la página/route handle el error normalmente (el middleware
  // ya filtró sesiones inválidas en la mayoría de los casos).
  try {
    const ctx = await requireDashboardBusinessContext();
    const access = await checkAccountAccess(ctx.businessId);
    if (!access.canUseApp) {
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
