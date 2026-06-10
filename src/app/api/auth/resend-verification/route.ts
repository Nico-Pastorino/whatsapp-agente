import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAuthClient } from "@/lib/supabase";
import { isEmailVerified } from "@/lib/email-verification";
import { toDashboardAuthResponse, withDashboardSession } from "@/lib/route-auth";
import { rateLimit, clientIpFromRequest } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Reenvía el correo de verificación al email de la sesión actual.
 * Rate-limited para evitar spam (también limita el mailer de Supabase).
 */
export async function POST(req: NextRequest) {
  try {
    return await withDashboardSession(async (session) => {
      const rl = rateLimit(
        `resend-verification:${session.sub}:${clientIpFromRequest(req)}`,
        3,
        10 * 60_000
      );
      if (!rl.ok) {
        return NextResponse.json(
          { error: "Ya te reenviamos el correo. Esperá unos minutos antes de pedir otro." },
          { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
        );
      }

      if (await isEmailVerified(session.sub)) {
        return NextResponse.json({ ok: true, alreadyVerified: true });
      }

      const authClient = getSupabaseAuthClient();
      const { error } = await authClient.auth.resend({
        type: "signup",
        email: session.email,
      });
      if (error) {
        console.error("[resend-verification] error:", error.code ?? error.message);
        return NextResponse.json(
          { error: "No pudimos reenviar el correo. Intentá de nuevo en unos minutos." },
          { status: 500 }
        );
      }
      return NextResponse.json({ ok: true });
    });
  } catch (error) {
    return toDashboardAuthResponse(error);
  }
}
