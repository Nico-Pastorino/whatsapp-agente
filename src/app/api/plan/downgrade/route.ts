import { NextRequest, NextResponse } from "next/server";
import { downgradePlan } from "@/lib/db";
import { toDashboardAuthResponse, withRoleDashboardBusinessContext } from "@/lib/route-auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    return await withRoleDashboardBusinessContext(["owner"], async ({ businessId }) => {
      const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
      const planCode =
        typeof body.plan_code === "string" ? body.plan_code.trim() : "";

      if (!planCode) {
        return NextResponse.json({ error: "Plan inválido." }, { status: 400 });
      }

      await downgradePlan(businessId, planCode);
      return NextResponse.json({
        ok: true,
        message: "El plan se actualizó correctamente.",
      });
    });
  } catch (error) {
    return toDashboardAuthResponse(error);
  }
}
