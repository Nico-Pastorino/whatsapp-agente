import { NextRequest, NextResponse } from "next/server";
import { getDashboardCredentials } from "@/lib/env";

const TOKEN_NONCE = "whatsapp-agent-session-v1";
const COOKIE_NAME = "wa_session";

// Rutas que no requieren autenticación
const PUBLIC_PREFIXES = ["/_next", "/favicon.ico", "/login", "/api/auth/login"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const credentials = getDashboardCredentials();
  const password = credentials.password;
  const user = credentials.user;

  // Si no hay credenciales configuradas, se permite el acceso (modo dev sin auth)
  if (!password || !user) {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_NAME)?.value ?? "";
  const valid = token ? await verifyTokenEdge(token, password) : false;

  if (!valid) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "No autorizado. Iniciá sesión en el dashboard." },
        { status: 401 }
      );
    }
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

// Implementación Edge de HMAC-SHA256 (Web Crypto API)
// Debe producir el mismo resultado que createHmac("sha256", password).update(nonce).digest("hex")
async function verifyTokenEdge(token: string, password: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sigBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(TOKEN_NONCE)
    );
    const expected = Array.from(new Uint8Array(sigBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return token === expected;
  } catch {
    return false;
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};
