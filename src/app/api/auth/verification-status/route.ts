import { NextResponse } from "next/server";
import { isEmailVerified } from "@/lib/email-verification";
import { toDashboardAuthResponse, withDashboardSession } from "@/lib/route-auth";

export const dynamic = "force-dynamic";

/** Devuelve si el usuario de la sesión confirmó su email. */
export async function GET() {
  try {
    return await withDashboardSession(async (session) => {
      const verified = await isEmailVerified(session.sub);
      return NextResponse.json({ verified, email: session.email });
    });
  } catch (error) {
    return toDashboardAuthResponse(error);
  }
}
