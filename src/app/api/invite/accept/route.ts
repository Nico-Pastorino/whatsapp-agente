import { NextRequest, NextResponse } from "next/server";
import { ACTIVE_BUSINESS_COOKIE } from "@/lib/app-session-shared";
import { acceptBusinessInvitation } from "@/lib/db";
import { getSessionCookieOptions } from "@/lib/app-session";
import { toDashboardAuthResponse, withDashboardSession } from "@/lib/route-auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    return await withDashboardSession(async (session) => {
      const body = await req.json().catch(() => ({}));
      const token = typeof body.token === "string" ? body.token.trim() : "";
      const result = await acceptBusinessInvitation(token, session.sub, session.email);

      const response = NextResponse.json({
        ok: true,
        businessId: result.businessId,
        alreadyMember: result.alreadyMember,
      });
      response.cookies.set(
        ACTIVE_BUSINESS_COOKIE,
        result.businessId,
        getSessionCookieOptions()
      );
      return response;
    });
  } catch (error) {
    return toDashboardAuthResponse(error);
  }
}
