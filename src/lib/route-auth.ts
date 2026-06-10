import { NextResponse } from "next/server";
import {
  DashboardAuthError,
  requireDashboardBusinessContext,
  requireDashboardSession,
  type DashboardBusinessContext,
} from "./dashboard-auth";
import { requireVerifiedEmail } from "./email-verification";
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

export function assertDashboardRole(
  role: DashboardBusinessContext["role"],
  allowed: Array<DashboardBusinessContext["role"]>,
  message = "No tenés permisos para realizar esta acción."
): void {
  if (!allowed.includes(role)) {
    throw new DashboardAuthError(message, 403);
  }
}

export async function withRoleDashboardBusinessContext<T>(
  allowed: Array<DashboardBusinessContext["role"]>,
  handler: (context: DashboardBusinessContext) => Promise<T>,
  message?: string
): Promise<T> {
  const context = await requireDashboardBusinessContext();
  assertDashboardRole(context.role, allowed, message);
  return handler(context);
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

export async function withActiveRoleDashboardBusinessContext<T>(
  allowed: Array<DashboardBusinessContext["role"]>,
  handler: (context: DashboardBusinessContext) => Promise<T>,
  message?: string
): Promise<T> {
  return withActiveDashboardBusinessContext(async (context) => {
    assertDashboardRole(context.role, allowed, message);
    return handler(context);
  });
}

/**
 * Contexto activo + email verificado. Para acciones OPERATIVAS que un email
 * inventado no debe poder ejecutar: obtener el QR de WhatsApp, enviar
 * mensajes, probar el asistente, invitar equipo. El bloqueo es de backend.
 */
export async function withVerifiedActiveDashboardBusinessContext<T>(
  handler: (context: DashboardBusinessContext) => Promise<T>
): Promise<T> {
  return withActiveDashboardBusinessContext(async (context) => {
    await requireVerifiedEmail(context.user.sub);
    return handler(context);
  });
}

export async function withVerifiedActiveRoleDashboardBusinessContext<T>(
  allowed: Array<DashboardBusinessContext["role"]>,
  handler: (context: DashboardBusinessContext) => Promise<T>,
  message?: string
): Promise<T> {
  return withVerifiedActiveDashboardBusinessContext(async (context) => {
    assertDashboardRole(context.role, allowed, message);
    return handler(context);
  });
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
