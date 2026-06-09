import { NextRequest, NextResponse } from "next/server";
import { APP_SESSION_COOKIE } from "@/lib/app-session-shared";

const PUBLIC_PATHS = new Set(["/", "/login", "/signup", "/favicon.ico", "/invite/accept"]);
const PUBLIC_API_PATHS = new Set([
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/signup",
  "/api/auth/signup-invite",
  "/api/invite/resolve",
  "/api/invite/accept",
  "/api/webhooks/mercadopago",
]);

function isPublicAsset(pathname: string): boolean {
  if (pathname.startsWith("/_next/")) return true;
  if (pathname.startsWith("/images/")) return true;
  if (pathname.startsWith("/icons/")) return true;
  if (pathname.startsWith("/assets/")) return true;
  if (pathname.startsWith("/payment/")) return true;
  return /\.[a-zA-Z0-9]+$/.test(pathname);
}

async function verifySessionCookie(token: string): Promise<boolean> {
  if (!token) return false;
  const [payloadSegment, signatureSegment] = token.split(".");
  if (!payloadSegment || !signatureSegment) return false;

  try {
    // Mismo orden de resolución que lib/app-session.ts: si está definido
    // APP_SESSION_SECRET se usa ese; si no, cae al service role key.
    // (Antes el middleware solo leía el service role: si alguien definía
    //  APP_SESSION_SECRET, el dashboard firmaba con uno y el middleware
    //  verificaba con otro → rechazaba TODAS las sesiones.)
    const secret =
      process.env.APP_SESSION_SECRET?.trim() ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      "";
    if (!secret) return false;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(payloadSegment)
    );
    const expectedSignature = arrayBufferToBase64Url(signatureBuffer);
    if (expectedSignature !== signatureSegment) return false;

    const payload = JSON.parse(base64UrlDecode(payloadSegment)) as {
      sub?: string;
      email?: string;
      exp?: number;
    };

    return Boolean(
      payload.sub &&
      payload.email &&
      typeof payload.exp === "number" &&
      payload.exp > Math.floor(Date.now() / 1000)
    );
  } catch {
    return false;
  }
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = Array.from(new Uint8Array(buffer))
    .map((byte) => String.fromCharCode(byte))
    .join("");
  return btoa(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return decodeURIComponent(
    Array.from(atob(padded))
      .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`)
      .join("")
  );
}

// Helper: propaga el pathname al render server-side para que el layout
// pueda decidir si bloquear por trial expirado sin tener que adivinar la URL.
function withPathnameHeader(req: NextRequest, response: NextResponse): NextResponse {
  response.headers.set("x-pathname", req.nextUrl.pathname);
  return response;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(APP_SESSION_COOKIE)?.value ?? "";

  if (isPublicAsset(pathname) || PUBLIC_PATHS.has(pathname) || PUBLIC_API_PATHS.has(pathname)) {
    // /login con sesión válida → mandar al dashboard.
    if (pathname === "/login") {
      const valid = await verifySessionCookie(token);
      if (valid) return NextResponse.redirect(new URL("/app", req.url));
    }
    return withPathnameHeader(req, NextResponse.next());
  }

  const requiresAppSession = pathname.startsWith("/app") || pathname.startsWith("/api/");
  if (!requiresAppSession) {
    return withPathnameHeader(req, NextResponse.next());
  }

  const valid = await verifySessionCookie(token);

  if (!valid) {
    // Solo loggeamos cuando bloqueamos — útil para detectar intentos de acceso
    // sin sesión sin spammar los logs en cada request normal.
    console.log(`[middleware] unauth ${pathname}`);
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "No autorizado. Iniciá sesión para continuar." },
        { status: 401 }
      );
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Importante: NO verificamos el estado de la suscripción acá (requeriría
  // golpear Supabase desde Edge runtime con todos los timeouts/edge-cases).
  // El gate por trial-expirado se aplica server-side en src/app/app/layout.tsx,
  // que tiene acceso completo a Node runtime y a la base.
  return withPathnameHeader(req, NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};
