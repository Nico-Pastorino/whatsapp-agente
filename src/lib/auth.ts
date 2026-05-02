import { createHmac, timingSafeEqual } from "node:crypto";
import { getDashboardCredentials } from "./env";

// Nonce fijo — cambiarlo invalida todas las sesiones activas
const TOKEN_NONCE = "whatsapp-agent-session-v1";
export const COOKIE_NAME = "wa_session";

export function getAuthCredentials(): { user: string; password: string } | null {
  const credentials = getDashboardCredentials();
  if (!credentials.user || !credentials.password) return null;
  return {
    user: credentials.user,
    password: credentials.password,
  };
}

export function isAuthEnabled(): boolean {
  return !!getAuthCredentials();
}

/**
 * Genera el token de sesión: HMAC-SHA256(nonce, password) en hex.
 * El mismo password siempre produce el mismo token. Si el password
 * cambia, todos los tokens anteriores quedan inválidos automáticamente.
 */
export function createSessionToken(password: string): string {
  return createHmac("sha256", password).update(TOKEN_NONCE).digest("hex");
}

/** Verifica el token usando timingSafeEqual para evitar timing attacks. */
export function verifyToken(token: string, password: string): boolean {
  if (!password || !token) return false;
  try {
    const expected = createSessionToken(password);
    const a = Buffer.from(token.padEnd(64, "0").slice(0, 64), "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b) && token === expected;
  } catch {
    return false;
  }
}
