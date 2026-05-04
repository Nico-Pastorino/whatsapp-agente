import "server-only";

import { getAppSessionFromCookies, type AppSessionPayload } from "./app-session";
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

  const { data, error } = await supabase
    .from("business_members")
    .select("business_id, role, created_at")
    .eq("user_id", session.sub)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new DashboardAuthError("No se pudo resolver el negocio del usuario.", 500);
  }

  if (!data?.business_id || !data.role) {
    throw new DashboardAuthError("Tu usuario no tiene un negocio asignado.", 403);
  }

  return {
    user: session,
    businessId: data.business_id,
    role: data.role,
  };
}
