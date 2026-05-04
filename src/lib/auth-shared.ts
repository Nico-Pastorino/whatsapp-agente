export const TOKEN_NONCE = "whatsapp-agent-session-v1";
export const COOKIE_NAME = "wa_session";

export function redactToken(token: string): string {
  if (!token) return "(empty)";
  if (token.length <= 8) return `${token.slice(0, 2)}...`;
  return `${token.slice(0, 6)}...${token.slice(-4)}`;
}
