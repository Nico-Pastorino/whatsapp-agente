import "server-only";

import { cookies } from "next/headers";
import { getAppSessionFromCookies, type AppSessionPayload } from "./app-session";
import { ACTIVE_BUSINESS_COOKIE } from "./app-session-shared";
import { getSupabaseAdminClient } from "./supabase";

export interface DashboardBusinessContext {
  user: AppSessionPayload;
  businessId: string;
  role: "owner" | "admin" | "agent";
}

export class DashboardAuthError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

export async function requireDashboardSession(): Promise<AppSessionPayload> {
  const session = await getAppSessionFromCookies();
  if (!session) {
    throw new DashboardAuthError("No autorizado.", 401);
  }
  return session;
}

export async function requireDashboardBusinessContext(): Promise<DashboardBusinessContext> {
  const session = await requireDashboardSession();
  const supabase = getSupabaseAdminClient();
  const cookieStore = await cookies();
  const activeBusinessId = cookieStore.get(ACTIVE_BUSINESS_COOKIE)?.value ?? "";

  const { data: memberships, error } = await supabase
    .from("business_members")
    .select("business_id, role, created_at")
    .eq("user_id", session.sub)
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) {
    throw new DashboardAuthError("No se pudo resolver el negocio del usuario.", 500);
  }

  const membershipList = memberships ?? [];
  if (membershipList.length === 0) {
    throw new DashboardAuthError("Tu usuario no tiene un negocio asignado.", 403);
  }

  const selectedMembership =
    membershipList.find((entry) => entry.business_id === activeBusinessId) ??
    membershipList[0];

  if (!selectedMembership?.business_id || !selectedMembership.role) {
    throw new DashboardAuthError("Tu usuario no tiene un negocio asignado.", 403);
  }

  return {
    user: session,
    businessId: selectedMembership.business_id,
    role: selectedMembership.role,
  };
}
