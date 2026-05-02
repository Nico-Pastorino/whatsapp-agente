import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 removido — la DB ahora es Supabase (no hay módulos nativos en Next.js)
  // Baileys y pino solo corren en el worker (proceso separado), no en Next.js
  serverExternalPackages: ["@whiskeysockets/baileys", "pino"],
};

export default nextConfig;
