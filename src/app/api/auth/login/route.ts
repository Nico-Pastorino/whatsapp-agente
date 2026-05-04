import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  isAuthEnabled,
  COOKIE_NAME,
} from "@/lib/auth";
import { getDashboardCredentials } from "@/lib/env";

// Rate limiting en memoria: máx 5 intentos por IP por minuto
const attempts = new Map<string, { count: number; resetAt: number }>();

export async function POST(req: NextRequest) {
  // Diagnóstico de variables de entorno (sin imprimir valores)
  const credentials = getDashboardCredentials();
  console.log("[auth/login] DASHBOARD_USER definido:", !!credentials.user);
  console.log("[auth/login] DASHBOARD_PASSWORD definido:", !!credentials.password);
  console.log("[auth/login] auth habilitada:", isAuthEnabled());

  if (!isAuthEnabled()) {
    console.error(
      "[auth/login] Auth deshabilitada — definí DASHBOARD_USER y DASHBOARD_PASSWORD en .env.local"
    );
    return NextResponse.json(
      { error: "DASHBOARD_USER o DASHBOARD_PASSWORD no configurados en el servidor" },
      { status: 500 }
    );
  }

  // Rate limiting por IP
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
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
  const inputPassword: string =
    typeof body.password === "string" ? body.password : "";

  console.log("[auth/login] password recibida:", inputPassword ? "(no vacía)" : "(vacía)");

  if (!inputPassword || inputPassword !== credentials.password) {
    const current = attempts.get(ip) ?? { count: 0, resetAt: now + 60_000 };
    attempts.set(ip, {
      count: current.count + 1,
      resetAt: current.resetAt,
    });
    await new Promise((r) => setTimeout(r, 1000));
    return NextResponse.json({ error: "Contraseña incorrecta" }, { status: 401 });
  }

  attempts.delete(ip);

  const token = createSessionToken(credentials.password);
  const isProd = process.env.NODE_ENV === "production";

  console.log("[auth/login] login exitoso");

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });
  return res;
}
