// Datos de contacto de soporte. Vienen de variables públicas de entorno.
// Si no están configuradas, los valores quedan vacíos y la UI desactiva el
// botón correspondiente (la app no rompe ni falla el build).
//
// Configurar en Vercel / .env.local:
//   NEXT_PUBLIC_SUPPORT_WHATSAPP_URL=https://wa.me/549XXXXXXXXXX?text=...
//   NEXT_PUBLIC_SUPPORT_EMAIL=soporte@atende.app

// IMPORTANTE: se referencian de forma literal para que Next.js las reemplace
// en el bundle del cliente (no usar lectura dinámica acá).
export const SUPPORT_WHATSAPP_URL = (process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP_URL ?? "").trim();
export const SUPPORT_EMAIL = (process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "").trim();

export const HAS_SUPPORT_WHATSAPP = SUPPORT_WHATSAPP_URL.length > 0;
export const HAS_SUPPORT_EMAIL = SUPPORT_EMAIL.length > 0;
export const HAS_ANY_SUPPORT = HAS_SUPPORT_WHATSAPP || HAS_SUPPORT_EMAIL;

/** mailto con asunto prearmado (vacío si no hay email configurado). */
export const SUPPORT_MAILTO = HAS_SUPPORT_EMAIL
  ? `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Ayuda con Atendé")}`
  : "";
