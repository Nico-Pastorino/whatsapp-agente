export type IdentityType = "phone" | "pn_jid" | "lid_jid" | "raw_jid";

function cleanInput(input: string): string {
  return input.trim().replace(/[+\s\-()]/g, "");
}

function stripDeviceSuffix(localPart: string): string {
  const colonIdx = localPart.indexOf(":");
  return colonIdx === -1 ? localPart : localPart.slice(0, colonIdx);
}

export function getJidType(jid: string): IdentityType {
  const normalized = cleanInput(jid);
  if (normalized.endsWith("@s.whatsapp.net")) return "pn_jid";
  if (normalized.endsWith("@lid")) return "lid_jid";
  if (!normalized.includes("@")) return "phone";
  return "raw_jid";
}

export function normalizeWhatsAppJid(input: string): string {
  const cleaned = cleanInput(input);
  const type = getJidType(cleaned);

  if (type === "phone") {
    return `${cleaned}@s.whatsapp.net`;
  }

  const atIdx = cleaned.indexOf("@");
  const localPart = stripDeviceSuffix(cleaned.slice(0, atIdx));
  const domain = cleaned.slice(atIdx);

  if (type === "pn_jid") {
    return `${localPart}@s.whatsapp.net`;
  }

  if (type === "lid_jid") {
    return `${localPart}@lid`;
  }

  return `${localPart}${domain}`;
}

export function extractPhoneFromJid(input: string): string | null {
  const normalized = normalizeWhatsAppJid(input);
  const type = getJidType(normalized);

  if (type === "lid_jid") {
    return null;
  }

  const localPart = normalized.split("@")[0] ?? "";
  const digits = localPart.replace(/[^\d]/g, "");
  return digits.length >= 7 ? digits : null;
}

export interface ParsedWhatsAppIdentity {
  rawJid: string;
  normalizedJid: string;
  jidType: IdentityType;
  phoneNumber: string | null;
  localPart: string;
}

export function parseWhatsAppIdentity(rawInput: string): ParsedWhatsAppIdentity {
  const rawJid = cleanInput(rawInput);
  const normalizedJid = normalizeWhatsAppJid(rawJid);
  const jidType = getJidType(normalizedJid);
  const phoneNumber = extractPhoneFromJid(normalizedJid);
  const localPart = normalizedJid.split("@")[0] ?? "";

  return {
    rawJid,
    normalizedJid,
    jidType,
    phoneNumber,
    localPart,
  };
}

export function extractPhoneNumberIfKnown(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.includes("@")) {
    const parsed = parseWhatsAppIdentity(trimmed);
    return parsed.jidType === "pn_jid" ? parsed.phoneNumber : null;
  }

  const telMatch = trimmed.match(/TEL[^:\d+]*:([+\d\s\-()]+)/i);
  if (telMatch?.[1]) {
    const cleanedTel = telMatch[1].replace(/[^\d]/g, "");
    return cleanedTel.length >= 7 ? cleanedTel : null;
  }

  if (!/^[+\d\s\-()]+$/.test(trimmed)) {
    return null;
  }

  const cleaned = trimmed.replace(/[^\d]/g, "");
  return cleaned.length >= 7 ? cleaned : null;
}
