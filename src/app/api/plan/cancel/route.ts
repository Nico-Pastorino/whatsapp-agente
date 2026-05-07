import { NextResponse } from "next/server";
import { cancelPlanAtPeriodEnd } from "@/lib/db";
import { toDashboardAuthResponse, withDashboardBusinessContext } from "@/lib/route-auth";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    return await withDashboardBusinessContext(async ({ businessId }) => {
      await cancelPlanAtPeriodEnd(businessId);
      return NextResponse.json({
        ok: true,
        message: "La cancelación quedó programada al final del período actual.",
      });
    });
  } catch (error) {
    return toDashboardAuthResponse(error);
  }
}
