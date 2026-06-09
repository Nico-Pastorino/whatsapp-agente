import type { NextRequest } from "next/server";

/**
 * Rate limit best-effort en memoria.
 *
 * Nota de producción: en Vercel (serverless) la memoria es por instancia, así
 * que esto NO es un límite global perfecto — mitiga ráfagas contra una misma
 * instancia. Para un límite robusto y compartido conviene un store externo
 * (Upstash Redis o una tabla en Supabase con ventana de tiempo). Se deja así
 * por ser un cambio acotado y sin dependencias nuevas; mejora la postura sin
 * riesgo de romper flujos legítimos (los límites son holgados).
 */
interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  /** Segundos hasta poder reintentar (0 si ok). */
  retryAfter: number;
}

export function rateLimit(key: string, max: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    // Limpieza oportunista para no crecer sin límite.
    if (buckets.size > 5000) {
      for (const [k, b] of buckets) {
        if (now >= b.resetAt) buckets.delete(k);
      }
    }
    return { ok: true, retryAfter: 0 };
  }

  if (bucket.count >= max) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }

  bucket.count += 1;
  return { ok: true, retryAfter: 0 };
}

/** Extrae una IP aproximada del request para usar como clave. */
export function clientIpFromRequest(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}
