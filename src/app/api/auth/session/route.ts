import { NextResponse } from "next/server";
import { toDashboardAuthResponse, withDashboardSession } from "@/lib/route-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return await withDashboardSession(async (session) =>
      NextResponse.json({
        user: {
          id: session.sub,
          email: session.email,
          fullName: session.fullName ?? null,
        },
      })
    );
  } catch (error) {
    return toDashboardAuthResponse(error);
  }
}
