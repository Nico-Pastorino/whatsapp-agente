/**
 * Utilidades de normalización de JIDs de WhatsApp.
 *
 * Problema: WhatsApp envía el mismo contacto con distintos formatos:
 *   5492355472157@s.whatsapp.net       ← formato base
 *   5492355472157:3@s.whatsapp.net     ← con sufijo de dispositivo
 *   27518073606199@lid                 ← formato LID (Linked ID)
 *   5492355472157                      ← número sin dominio
 *
 * Si no normalizamos, se crean múltiples conversaciones para el mismo contacto.
 */

/**
 * Devuelve el JID canónico para un contacto de WhatsApp.
 *
 * Reglas:
 *  - JIDs @lid se conservan tal cual (no se puede mapear a teléfono).
 *  - Se elimina el sufijo de dispositivo :N antes del @.
 *  - Se elimina el + inicial del número.
 *  - Si el input es solo un número, se le agrega @s.whatsapp.net.
 *
 * Ejemplos:
 *   "5492355472157:3@s.whatsapp.net" → "5492355472157@s.whatsapp.net"
 *   "5492355472157@s.whatsapp.net"   → "5492355472157@s.whatsapp.net"
 *   "27518073606199@lid"             → "27518073606199@lid"
 *   "5492355472157"                  → "5492355472157@s.whatsapp.net"
 *   "+5492355472157"                 → "5492355472157@s.whatsapp.net"
 */
export function normalizeWhatsAppJid(input: string): string {
  const raw = input.trim();

  // JIDs @lid: no se puede normalizar a teléfono — conservar tal cual
  if (raw.endsWith("@lid")) {
    return raw;
  }

  const atIdx = raw.indexOf("@");

  let number: string;
  let domain: string;

  if (atIdx !== -1) {
    domain = raw.slice(atIdx); // "@s.whatsapp.net" u otro
    const localPart = raw.slice(0, atIdx);
    // Quitar sufijo de dispositivo: "5492355472157:3" → "5492355472157"
    const colonIdx = localPart.indexOf(":");
    number = colonIdx !== -1 ? localPart.slice(0, colonIdx) : localPart;
  } else {
    domain = "@s.whatsapp.net";
    number = raw;
  }

  // Limpiar el número: quitar +, espacios y guiones
  number = number.replace(/[+\s\-]/g, "");

  return `${number}${domain}`;
}

/**
 * Extrae el número de teléfono limpio desde un JID normalizado.
 *
 * Ejemplos:
 *   "5492355472157@s.whatsapp.net" → "5492355472157"
 *   "27518073606199@lid"           → "27518073606199"
 */
export function getPhoneFromJid(jid: string): string {
  return jid.split("@")[0].split(":")[0];
}
