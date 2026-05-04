export type IdentityType = "phone" | "pn_jid" | "lid_jid" | "raw_jid";

export interface ParsedWhatsAppIdentity {
  rawJid: string;
  normalizedJid: string;
  localPart: string;
  identityType: IdentityType;
  phoneNumber: string | null;
}

function stripDeviceSuffix(localPart: string): string {
  const colonIdx = localPart.indexOf(":");
  return colonIdx === -1 ? localPart : localPart.slice(0, colonIdx);
}

function cleanPhoneCandidate(input: string): string {
  return input.replace(/[^\d]/g, "");
}

export function parseWhatsAppIdentity(rawInput: string): ParsedWhatsAppIdentity {
  const rawJid = rawInput.trim();
  const atIdx = rawJid.indexOf("@");
  const domain = atIdx === -1 ? "" : rawJid.slice(atIdx);
  const localPart = stripDeviceSuffix(atIdx === -1 ? rawJid : rawJid.slice(0, atIdx));
  const cleanedLocal = cleanPhoneCandidate(localPart);

  if (domain === "@lid") {
    return {
      rawJid,
      normalizedJid: `${localPart}@lid`,
      localPart,
      identityType: "lid_jid",
      phoneNumber: null,
    };
  }

  if (domain === "@s.whatsapp.net" || atIdx === -1) {
    const phoneNumber = cleanedLocal || null;
    const normalizedJid = phoneNumber
      ? `${phoneNumber}@s.whatsapp.net`
      : `${localPart}@s.whatsapp.net`;
    return {
      rawJid,
      normalizedJid,
      localPart,
      identityType: atIdx === -1 ? "phone" : "pn_jid",
      phoneNumber,
    };
  }

  return {
    rawJid,
    normalizedJid: atIdx === -1 ? rawJid : `${localPart}${domain}`,
    localPart,
    identityType: "raw_jid",
    phoneNumber: cleanedLocal || null,
  };
}

export function normalizeWhatsAppJid(input: string): string {
  return parseWhatsAppIdentity(input).normalizedJid;
}

export function getPhoneFromJid(jid: string): string {
  return parseWhatsAppIdentity(jid).phoneNumber ?? parseWhatsAppIdentity(jid).localPart;
}

export function extractPhoneNumberIfKnown(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = cleanPhoneCandidate(value);
  return cleaned.length >= 7 ? cleaned : null;
}
