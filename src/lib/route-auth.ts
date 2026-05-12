import { NextResponse } from "next/server";
import {
  DashboardAuthError,
  requireDashboardBusinessContext,
  requireDashboardSession,
  type DashboardBusinessContext,
} from "./dashboard-auth";
import { checkAccountAccess } from "./db";

export async function withDashboardSession<T>(
  handler: (session: Awaited<ReturnType<typeof requireDashboardSession>>) => Promise<T>
): Promise<T> {
  return handler(await requireDashboardSession());
}

export async function withDashboardBusinessContext<T>(
  handler: (context: DashboardBusinessContext) => Promise<T>
): Promise<T> {
  return handler(await requireDashboardBusinessContext());
}

export async function withActiveDashboardBusinessContext<T>(
  handler: (context: DashboardBusinessContext) => Promise<T>
): Promise<T> {
  const context = await requireDashboardBusinessContext();
  const access = await checkAccountAccess(context.businessId);
  if (!access.canUseApp) {
    throw new DashboardAuthError(
      access.reason === "trial_expired"
        ? "Tu prueba gratuita finalizó. Para continuar usando el bot de WhatsApp, activá tu plan."
        : "Tu cuenta no está activa. Activá tu plan para continuar.",
      403
    );
  }
  return handler(context);
}

export function toDashboardAuthResponse(error: unknown): NextResponse {
  if (error instanceof DashboardAuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  if (
    error instanceof Error &&
    "status" in error &&
    typeof (error as { status?: unknown }).status === "number"
  ) {
    return NextResponse.json(
      { error: error.message },
      { status: (error as { status: number }).status }
    );
  }

  console.error("[dashboard-auth] unexpected error:", error);
  return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
}
