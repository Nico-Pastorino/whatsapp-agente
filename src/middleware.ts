import { NextRequest, NextResponse } from "next/server";
import { getDashboardCredentials } from "@/lib/env";
import { COOKIE_NAME, redactToken, TOKEN_NONCE } from "@/lib/auth-shared";

const PUBLIC_PATHS = new Set(["/login", "/favicon.ico"]);
const PUBLIC_API_PATHS = new Set(["/api/auth/login"]);

function isPublicAsset(pathname: string): boolean {
  if (pathname.startsWith("/_next/")) return true;
  if (pathname.startsWith("/public/")) return true;
  if (pathname.startsWith("/images/")) return true;
  if (pathname.startsWith("/icons/")) return true;
  if (pathname.startsWith("/assets/")) return true;
  return /\.[a-zA-Z0-9]+$/.test(pathname);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(COOKIE_NAME)?.value ?? "";
  const hasCookie = !!token;
  const credentials = getDashboardCredentials();
  const password = credentials.password;
  const user = credentials.user;

  console.log("[middleware] route:", pathname);
  console.log("[middleware] cookie present:", hasCookie);
  if (hasCookie) {
    console.log("[middleware] cookie preview:", redactToken(token));
  }

  if (isPublicAsset(pathname) || PUBLIC_PATHS.has(pathname) || PUBLIC_API_PATHS.has(pathname)) {
    const valid = password ? await verifyTokenEdge(token, password) : false;
    console.log("[middleware] public route cookie valid:", valid);

    if (pathname === "/login" && valid) {
      console.log("[middleware] redirecting authenticated user away from /login");
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  if (!password || !user) {
    console.error(
      "[middleware] DASHBOARD_USER or DASHBOARD_PASSWORD missing; denying protected route"
    );

    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Auth del dashboard no configurada en el servidor." },
        { status: 500 }
      );
    }

    return NextResponse.redirect(new URL("/login", req.url));
  }

  const valid = token ? await verifyTokenEdge(token, password) : false;
  console.log("[middleware] cookie valid:", valid);

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
