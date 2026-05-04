import { NextResponse } from "next/server";
import { listConversations } from "@/lib/db";
import { toDashboardAuthResponse, withDashboardBusinessContext } from "@/lib/route-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return await withDashboardBusinessContext(async ({ businessId }) => {
      const conversations = await listConversations(businessId);
      return NextResponse.json(conversations);
    });
  } catch (error) {
    return toDashboardAuthResponse(error);
  }
}
