import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getRequiredEnv } from "./env";

/**
 * Normaliza la URL de Supabase: el cliente solo necesita el dominio base.
 * Ejemplo de error común: "https://xxx.supabase.co/rest/v1/" → se corrige solo.
 */
function normalizeSupabaseUrl(raw: string): string {
  try {
    const url = new URL(raw);
    // Solo dominio + protocolo, sin path
    return `${url.protocol}//${url.host}`;
  } catch {
    return raw;
  }
}

/**
 * Valida que la service role key sea un JWT válido (3 partes separadas por punto).
 * No imprime el valor completo — solo el tipo de problema si hay uno.
 */
function validateServiceRoleKey(key: string): void {
  const parts = key.split(".");
  if (parts.length !== 3) {
    throw new Error(
      `SUPABASE_SERVICE_ROLE_KEY tiene formato inválido. ` +
      `Un JWT tiene 3 partes separadas por "." — este tiene ${parts.length}. ` +
      `Verificá que no tenga texto extra al final (ej: "SERVICE_ROLE_KEY" pegado).`
    );
  }
}

let adminClient: SupabaseClient | null = null;
let authClient: SupabaseClient | null = null;

export function getSupabaseAdminClient(): SupabaseClient {
  if (adminClient) return adminClient;

  const rawUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  const url = normalizeSupabaseUrl(rawUrl);

  if (rawUrl !== url) {
    console.warn(
      `[supabase] NEXT_PUBLIC_SUPABASE_URL tenía un path extra ("${rawUrl}") — ` +
      `usando solo el dominio base: "${url}"`
    );
  }

  validateServiceRoleKey(serviceRoleKey);

  adminClient = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return adminClient;
}

export function getSupabasePublicConfig(): { url: string; anonKey: string } {
  return {
    url: normalizeSupabaseUrl(getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL")),
    anonKey: getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  };
}

export function getSupabaseAuthClient(): SupabaseClient {
  if (authClient) return authClient;

  const { url, anonKey } = getSupabasePublicConfig();
  authClient = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return authClient;
}
