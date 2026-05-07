import { NextResponse } from "next/server";
import {
  DashboardAuthError,
  requireDashboardBusinessContext,
  requireDashboardSession,
  type DashboardBusinessContext,
} from "./dashboard-auth";

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
