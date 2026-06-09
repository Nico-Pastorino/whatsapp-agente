import type { NextConfig } from "next";

// Headers de seguridad aplicados a todas las respuestas.
// Conservadores a propósito: no se agrega Content-Security-Policy estricto
// para no romper estilos/scripts inline existentes (queda como mejora futura).
const securityHeaders = [
  // Evita que el navegador "adivine" tipos MIME (mitiga ataques por sniffing).
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Evita clickjacking: la app no se embebe en iframes de terceros.
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // No filtrar la URL completa como referer hacia otros orígenes.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // La app no usa cámara/micrófono/ubicación → se deniegan explícitamente.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // better-sqlite3 removido — la DB ahora es Supabase (no hay módulos nativos en Next.js)
  // Baileys y pino solo corren en el worker (proceso separado), no en Next.js
  serverExternalPackages: ["@whiskeysockets/baileys", "pino"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
