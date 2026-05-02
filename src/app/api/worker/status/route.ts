import { NextResponse } from "next/server";
import { getConnectionState } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const state = await getConnectionState();

    return NextResponse.json({
      online: state.worker_online,
      lastSeenAt: state.last_seen_at,
      instanceName: process.env.WORKER_INSTANCE_NAME ?? "main",
      whatsappStatus: state.status,
    });
  } catch {
    return NextResponse.json({
      online: false,
      lastSeenAt: null,
      instanceName: process.env.WORKER_INSTANCE_NAME ?? "main",
      whatsappStatus: "disconnected",
    });
  }
}
