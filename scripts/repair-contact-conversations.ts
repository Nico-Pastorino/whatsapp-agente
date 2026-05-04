import "./env-loader";
import { createClient } from "@supabase/supabase-js";
import {
  extractPhoneFromJid,
  getJidType,
  normalizeWhatsAppJid,
  parseWhatsAppIdentity,
} from "../src/lib/whatsapp-jid";

const APPLY = process.argv.includes("--apply");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const businessId = process.env.BUSINESS_ID;

if (!supabaseUrl || !supabaseKey || !businessId) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY o BUSINESS_ID");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type ConversationMode = "AI" | "HUMAN";

interface ConversationRow {
  id: string;
  business_id: string;
  contact_id: string | null;
  phone_jid: string | null;
  display_name: string | null;
  mode: ConversationMode;
  last_message_at: string | null;
  created_at: string;
}

interface ContactRow {
  id: string;
  display_name: string | null;
  phone_number: string | null;
  primary_jid: string | null;
}

interface IdentityRow {
  id: string;
  contact_id: string;
  identity_type: "phone" | "pn_jid" | "lid_jid" | "raw_jid";
  identity_value: string;
}

interface ConversationScore extends ConversationRow {
  messageCount: number;
}

function parseTimestamp(value: string | null | undefined): number {
  if (!value) return 0;
  const ts = Date.parse(value);
  return Number.isNaN(ts) ? 0 : ts;
}

function safeDisplayName(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function preferredConversation(a: ConversationScore, b: ConversationScore): ConversationScore {
  const aPn = a.phone_jid?.endsWith("@s.whatsapp.net") ? 1 : 0;
  const bPn = b.phone_jid?.endsWith("@s.whatsapp.net") ? 1 : 0;
  if (bPn !== aPn) return bPn > aPn ? b : a;

  if (a.mode !== b.mode) {
    if (a.mode === "HUMAN") return a;
    if (b.mode === "HUMAN") return b;
  }

  const aTime = parseTimestamp(a.last_message_at) || parseTimestamp(a.created_at);
  const bTime = parseTimestamp(b.last_message_at) || parseTimestamp(b.created_at);
  if (bTime !== aTime) return bTime > aTime ? b : a;

  return b.messageCount > a.messageCount ? b : a;
}

function normalizeDisplayKey(value: string | null | undefined): string | null {
  const safe = safeDisplayName(value);
  return safe ? safe.toLowerCase() : null;
}

function groupKey(row: ConversationRow): string {
  const parsed = parseWhatsAppIdentity(row.phone_jid ?? "");
  if (parsed.phoneNumber) return `phone:${parsed.phoneNumber}`;
  const displayKey = normalizeDisplayKey(row.display_name);
  if (displayKey) return `name:${displayKey}`;
  return `jid:${parsed.normalizedJid}`;
}

async function countMessages(conversationId: string): Promise<number> {
  const { count, error } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversationId);
  if (error) throw error;
  return count ?? 0;
}

async function getContactIdentities(contactId: string): Promise<IdentityRow[]> {
  const { data, error } = await supabase
    .from("contact_identities")
    .select("id, contact_id, identity_type, identity_value")
    .eq("business_id", businessId)
    .eq("contact_id", contactId);
  if (error) throw error;
  return (data ?? []) as IdentityRow[];
}

async function upsertIdentity(
  contactId: string,
  identityType: IdentityRow["identity_type"],
  identityValue: string
): Promise<void> {
  const { error } = await supabase.from("contact_identities").upsert(
    {
      business_id: businessId,
      contact_id: contactId,
      identity_type: identityType,
      identity_value: identityValue,
    },
    { onConflict: "business_id,identity_value" }
  );
  if (error) throw error;
}

async function findExistingContact(
  phoneNumber: string | null,
  displayName: string | null,
  pnJid: string | null
): Promise<ContactRow | null> {
  if (phoneNumber) {
    const { data, error } = await supabase
      .from("contacts")
      .select("id, display_name, phone_number, primary_jid")
      .eq("business_id", businessId)
      .eq("phone_number", phoneNumber)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (data) return data as ContactRow;
  }

  if (pnJid) {
    const { data, error } = await supabase
      .from("contacts")
      .select("id, display_name, phone_number, primary_jid")
      .eq("business_id", businessId)
      .eq("primary_jid", pnJid)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (data) return data as ContactRow;
  }

  const displayKey = safeDisplayName(displayName);
  if (displayKey) {
    const { data, error } = await supabase
      .from("contacts")
      .select("id, display_name, phone_number, primary_jid")
      .eq("business_id", businessId)
      .eq("display_name", displayKey);
    if (error) throw error;
    if ((data ?? []).length === 1) {
      return data?.[0] as ContactRow;
    }
  }

  return null;
}

async function createOrUpdateContact(
  primary: ConversationScore,
  group: ConversationScore[]
): Promise<ContactRow> {
  const normalizedDisplayName =
    safeDisplayName(primary.display_name) ??
    group.map((row) => safeDisplayName(row.display_name)).find(Boolean) ??
    null;

  const pnJid =
    group
      .map((row) => normalizeWhatsAppJid(row.phone_jid ?? ""))
      .find((jid) => jid.endsWith("@s.whatsapp.net")) ?? null;
  const lidJid =
    group
      .map((row) => normalizeWhatsAppJid(row.phone_jid ?? ""))
      .find((jid) => jid.endsWith("@lid")) ?? null;
  const phoneNumber =
    group
      .map((row) => extractPhoneFromJid(row.phone_jid ?? ""))
      .find(Boolean) ?? null;

  const existing = await findExistingContact(phoneNumber, normalizedDisplayName, pnJid);
  if (existing) {
    const nextPrimaryJid =
      pnJid ??
      (existing.primary_jid?.endsWith("@s.whatsapp.net") ? existing.primary_jid : null) ??
      existing.primary_jid ??
      lidJid;

    const { data, error } = await supabase
      .from("contacts")
      .update({
        display_name: existing.display_name ?? normalizedDisplayName,
        phone_number: existing.phone_number ?? phoneNumber,
        primary_jid: nextPrimaryJid,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("id, display_name, phone_number, primary_jid")
      .single();
    if (error) throw error;
    return data as ContactRow;
  }

  const { data, error } = await supabase
    .from("contacts")
    .insert({
      business_id: businessId,
      display_name: normalizedDisplayName,
      phone_number: phoneNumber,
      primary_jid: pnJid ?? lidJid ?? normalizeWhatsAppJid(primary.phone_jid ?? ""),
      updated_at: new Date().toISOString(),
    })
    .select("id, display_name, phone_number, primary_jid")
    .single();
  if (error) throw error;
  return data as ContactRow;
}

async function repairGroup(groupRows: ConversationScore[]): Promise<void> {
  const primary = groupRows.reduce(preferredConversation);
  const duplicates = groupRows.filter((row) => row.id !== primary.id);
  const phoneNumber =
    groupRows.map((row) => extractPhoneFromJid(row.phone_jid ?? "")).find(Boolean) ?? null;
  const pnJid =
    groupRows.map((row) => normalizeWhatsAppJid(row.phone_jid ?? "")).find((jid) => jid.endsWith("@s.whatsapp.net")) ??
    null;
  const lidJids = groupRows
    .map((row) => normalizeWhatsAppJid(row.phone_jid ?? ""))
    .filter((jid) => jid.endsWith("@lid"));

  console.log(
    `[repair] primary=${primary.id} duplicates=${duplicates.length} phone=${phoneNumber ?? "-"} pn_jid=${pnJid ?? "-"}`
  );
  for (const row of groupRows) {
    console.log(
      `  [repair] conv=${row.id} jid=${row.phone_jid ?? "-"} mode=${row.mode} messages=${row.messageCount} contact_id=${row.contact_id ?? "-"}`
    );
  }

  if (!APPLY) return;

  const contact = await createOrUpdateContact(primary, groupRows);
  const currentIdentities = await getContactIdentities(contact.id);
  const currentIdentityValues = new Set(currentIdentities.map((identity) => identity.identity_value));

  if (phoneNumber && !currentIdentityValues.has(phoneNumber)) {
    await upsertIdentity(contact.id, "phone", phoneNumber);
  }

  if (pnJid && !currentIdentityValues.has(pnJid)) {
    await upsertIdentity(contact.id, "pn_jid", pnJid);
  }

  for (const lidJid of lidJids) {
    if (!currentIdentityValues.has(lidJid)) {
      await upsertIdentity(contact.id, "lid_jid", lidJid);
    }
  }

  for (const row of groupRows) {
    const normalizedJid = normalizeWhatsAppJid(row.phone_jid ?? "");
    const jidType = getJidType(normalizedJid);
    if (!currentIdentityValues.has(normalizedJid)) {
      await upsertIdentity(contact.id, jidType, normalizedJid);
    }

    const raw = row.phone_jid?.trim();
    if (raw && raw !== normalizedJid && !currentIdentityValues.has(raw)) {
      await upsertIdentity(contact.id, "raw_jid", raw);
    }
  }

  const primaryDisplayName =
    contact.display_name ??
    safeDisplayName(primary.display_name) ??
    null;
  const nextMode = groupRows.some((row) => row.mode === "HUMAN") ? "HUMAN" : primary.mode;
  const nextLastMessageAt = groupRows
    .map((row) => row.last_message_at)
    .filter(Boolean)
    .sort()
    .pop() ?? primary.last_message_at;

  await supabase
    .from("contacts")
    .update({
      display_name: primaryDisplayName,
      phone_number: phoneNumber ?? contact.phone_number,
      primary_jid: pnJid ?? contact.primary_jid,
      updated_at: new Date().toISOString(),
    })
    .eq("id", contact.id);

  await supabase
    .from("conversations")
    .update({
      contact_id: contact.id,
      phone_jid: pnJid ?? primary.phone_jid,
      display_name: primaryDisplayName,
      mode: nextMode,
      last_message_at: nextLastMessageAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", primary.id);

  for (const duplicate of duplicates) {
    const { error: messagesError } = await supabase
      .from("messages")
      .update({ conversation_id: primary.id })
      .eq("conversation_id", duplicate.id);
    if (messagesError) throw messagesError;

    const { error: outboxError } = await supabase
      .from("outbox_messages")
      .update({
        conversation_id: primary.id,
        contact_id: contact.id,
        target_jid: pnJid ?? duplicate.phone_jid ?? primary.phone_jid,
      })
      .eq("conversation_id", duplicate.id);
    if (outboxError) throw outboxError;

    const { error: deleteError } = await supabase
      .from("conversations")
      .delete()
      .eq("id", duplicate.id);
    if (deleteError) throw deleteError;
  }

  if (pnJid) {
    const { error: normalizeOutboxError } = await supabase
      .from("outbox_messages")
      .update({ target_jid: pnJid })
      .eq("conversation_id", primary.id);
    if (normalizeOutboxError) throw normalizeOutboxError;
  }
}

async function run(): Promise<void> {
  console.log(APPLY ? "[repair] mode=apply" : "[repair] mode=dry-run");

  const { data, error } = await supabase
    .from("conversations")
    .select("id, business_id, contact_id, phone_jid, display_name, mode, last_message_at, created_at")
    .eq("business_id", businessId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const conversations = (data ?? []) as ConversationRow[];
  if (conversations.length === 0) {
    console.log("[repair] no conversations found");
    return;
  }

  const scored = await Promise.all(
    conversations.map(async (row) => ({
      ...row,
      messageCount: await countMessages(row.id),
    }))
  );

  const groups = new Map<string, ConversationScore[]>();
  for (const row of scored) {
    const key = groupKey(row);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  for (const [key, groupRows] of groups) {
    const shouldRepair =
      groupRows.length > 1 ||
      groupRows.some((row) => !row.contact_id) ||
      groupRows.some((row) => (row.phone_jid ?? "").endsWith("@lid"));

    if (!shouldRepair) continue;
    console.log(`[repair] group=${key}`);
    await repairGroup(groupRows);
  }

  console.log(APPLY ? "[repair] apply complete" : "[repair] dry-run complete; use --apply");
}

run().catch((error) => {
  console.error("[repair] error:", error);
  process.exit(1);
});
