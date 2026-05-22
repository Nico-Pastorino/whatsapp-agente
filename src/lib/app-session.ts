import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getRequiredEnv } from "./env";
import { APP_SESSION_COOKIE } from "./app-session-shared";
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

export interface AppSessionPayload {
  sub: string;
  email: string;
  fullName?: string | null;
  exp: number;
}

function getSessionSecret(): string {
  const dedicatedSecret = process.env.APP_SESSION_SECRET?.trim();
  if (dedicatedSecret) return dedicatedSecret;
  return getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayloadSegment(payloadSegment: string): string {
  return createHmac("sha256", getSessionSecret()).update(payloadSegment).digest("base64url");
}

export function createAppSessionToken(payload: Omit<AppSessionPayload, "exp">): string {
  const encodedPayload = base64UrlEncode(
    JSON.stringify({
      ...payload,
      exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
    } satisfies AppSessionPayload)
  );
  const signature = signPayloadSegment(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifyAppSessionToken(token: string): AppSessionPayload | null {
  if (!token) return null;

  const [payloadSegment, signatureSegment] = token.split(".");
  if (!payloadSegment || !signatureSegment) return null;

  try {
    const expectedSignature = signPayloadSegment(payloadSegment);
    const a = Buffer.from(signatureSegment);
    const b = Buffer.from(expectedSignature);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    const payload = JSON.parse(base64UrlDecode(payloadSegment)) as AppSessionPayload;
    if (!payload.sub || !payload.email || typeof payload.exp !== "number") return null;
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function getAppSessionFromCookies(): Promise<AppSessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(APP_SESSION_COOKIE)?.value ?? "";
  return verifyAppSessionToken(token);
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}
