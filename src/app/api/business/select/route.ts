import { NextRequest, NextResponse } from "next/server";
import { ACTIVE_BUSINESS_COOKIE } from "@/lib/app-session-shared";
import { userBelongsToBusiness } from "@/lib/db";
import { getSessionCookieOptions } from "@/lib/app-session";
import { toDashboardAuthResponse, withDashboardSession } from "@/lib/route-auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    return await withDashboardSession(async (session) => {
      const body = await req.json().catch(() => ({}));
      const businessId =
        typeof body.businessId === "string" ? body.businessId.trim() : "";

      if (!businessId) {
        return NextResponse.json({ error: "Negocio inválido." }, { status: 400 });
      }

      const belongs = await userBelongsToBusiness(session.sub, businessId);
      if (!belongs) {
        return NextResponse.json({ error: "No tenés acceso a ese negocio." }, { status: 403 });
      }

      const response = NextResponse.json({ ok: true });
      response.cookies.set(ACTIVE_BUSINESS_COOKIE, businessId, getSessionCookieOptions());
      return response;
    });
  } catch (error) {
    return toDashboardAuthResponse(error);
  }
}
