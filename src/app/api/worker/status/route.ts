import { NextResponse } from "next/server";
import { getConnectionState } from "@/lib/db";
import { toDashboardAuthResponse, withDashboardBusinessContext } from "@/lib/route-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return await withDashboardBusinessContext(async ({ businessId }) => {
      const state = await getConnectionState(businessId);

      return NextResponse.json({
        online: state.worker_online,
        lastSeenAt: state.last_seen_at,
        instanceName: process.env.WORKER_INSTANCE_NAME ?? "main",
        whatsappStatus: state.status,
      });
    });
  } catch (error) {
    if ((error as { status?: number })?.status) {
      return toDashboardAuthResponse(error);
    }
    return NextResponse.json({
      online: false,
      lastSeenAt: null,
      instanceName: process.env.WORKER_INSTANCE_NAME ?? "main",
      whatsappStatus: "disconnected",
    });
  }
}
