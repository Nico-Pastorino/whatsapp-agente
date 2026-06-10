import { NextResponse } from "next/server";
import { reactivatePlan } from "@/lib/db";
import { toDashboardAuthResponse, withRoleDashboardBusinessContext } from "@/lib/route-auth";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    return await withRoleDashboardBusinessContext(["owner"], async ({ businessId }) => {
      await reactivatePlan(businessId);
      return NextResponse.json({
        ok: true,
        message: "La cancelación programada fue removida.",
      });
    });
  } catch (error) {
    return toDashboardAuthResponse(error);
  }
}
