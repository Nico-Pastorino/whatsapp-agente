import { NextRequest, NextResponse } from "next/server";
import {
  createAppSessionToken,
  getSessionCookieOptions,
} from "@/lib/app-session";
import { APP_SESSION_COOKIE } from "@/lib/app-session-shared";
import { getSupabaseAuthClient } from "@/lib/supabase";

const attempts = new Map<string, { count: number; resetAt: number }>();

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  const now = Date.now();
  const record = attempts.get(ip);

  if (record) {
    if (now < record.resetAt && record.count >= 5) {
      return NextResponse.json(
        { error: "Demasiados intentos fallidos. Esperá 1 minuto." },
        { status: 429 }
      );
    }
    if (now >= record.resetAt) attempts.delete(ip);
  }

  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json(
      { error: "Ingresá tu email y contraseña." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAuthClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    const current = attempts.get(ip) ?? { count: 0, resetAt: now + 60_000 };
    attempts.set(ip, { count: current.count + 1, resetAt: current.resetAt });
    console.warn("[auth/login] credenciales inválidas para:", email);
    await new Promise((resolve) => setTimeout(resolve, 800));
    return NextResponse.json(
      { error: "Email o contraseña incorrectos." },
      { status: 401 }
    );
  }

  attempts.delete(ip);

  const token = createAppSessionToken({
    sub: data.user.id,
    email: data.user.email ?? email,
    fullName:
      typeof data.user.user_metadata?.full_name === "string"
        ? data.user.user_metadata.full_name
        : null,
  });

  const response = NextResponse.json({
    ok: true,
    user: {
      id: data.user.id,
      email: data.user.email ?? email,
    },
  });

  response.cookies.set(APP_SESSION_COOKIE, token, getSessionCookieOptions());
  return response;
}
