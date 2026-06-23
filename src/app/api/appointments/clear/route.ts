import { NextResponse } from "next/server";
import { deleteClosedAppointments } from "@/lib/db";
import { toDashboardAuthResponse, withActiveDashboardBusinessContext } from "@/lib/route-auth";

export const dynamic = "force-dynamic";

// POST /api/appointments/clear → borra todas las reservas completadas y canceladas.
export async function POST() {
  try {
    return await withActiveDashboardBusinessContext(async ({ businessId }) => {
      const deleted = await deleteClosedAppointments(businessId);
      return NextResponse.json({ ok: true, deleted });
    });
  } catch (error) {
    return toDashboardAuthResponse(error);
  }
}
