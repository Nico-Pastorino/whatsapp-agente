import { NextResponse } from "next/server";
import { requestWhatsappDisconnect } from "@/lib/db";
import { toDashboardAuthResponse, withActiveDashboardBusinessContext } from "@/lib/route-auth";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    return await withActiveDashboardBusinessContext(async ({ businessId }) => {
      await requestWhatsappDisconnect(businessId);
      return NextResponse.json({ ok: true });
    });
  } catch (error) {
    return toDashboardAuthResponse(error);
  }
}
