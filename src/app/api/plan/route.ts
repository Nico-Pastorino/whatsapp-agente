import { NextResponse } from "next/server";
import { getPlanSummary } from "@/lib/data-access";
import { toDashboardAuthResponse, withDashboardBusinessContext } from "@/lib/route-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return await withDashboardBusinessContext(async ({ businessId }) => {
      const plan = await getPlanSummary(businessId);
      return NextResponse.json(plan);
    });
  } catch (error) {
    return toDashboardAuthResponse(error);
  }
}
