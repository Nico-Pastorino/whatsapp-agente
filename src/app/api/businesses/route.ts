import { NextResponse } from "next/server";
import { listAvailableBusinessesForUser } from "@/lib/db";
import { ACTIVE_BUSINESS_COOKIE } from "@/lib/app-session-shared";
import { toDashboardAuthResponse, withDashboardSession } from "@/lib/route-auth";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return await withDashboardSession(async (session) => {
      const cookieStore = await cookies();
      const activeBusinessId = cookieStore.get(ACTIVE_BUSINESS_COOKIE)?.value ?? null;
      const businesses = await listAvailableBusinessesForUser(session.sub);
      return NextResponse.json({
        active_business_id:
          businesses.some((business) => business.business_id === activeBusinessId)
            ? activeBusinessId
            : businesses[0]?.business_id ?? null,
        businesses,
      });
    });
  } catch (error) {
    return toDashboardAuthResponse(error);
  }
}
