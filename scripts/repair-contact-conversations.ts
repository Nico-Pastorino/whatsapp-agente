import "./env-loader";
import { createClient } from "@supabase/supabase-js";
import { parseWhatsAppIdentity } from "../src/lib/whatsapp-jid";

const APPLY = process.argv.includes("--apply");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const businessId = process.env.BUSINESS_ID!;

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !businessId) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY o BUSINESS_ID");
  process.exit(1);
}

interface ConversationRow {
  id: string;
  contact_id: string | null;
  phone_jid: string;
  display_name: string | null;
  mode: "AI" | "HUMAN";
  last_message_at: string | null;
  created_at: string;
}

interface ContactRow {
  id: string;
  display_name: string | null;
  phone_number: string | null;
  primary_jid: string | null;
}

async function countMessages(conversationId: string): Promise<number> {
  const { count, error } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversationId);

  if (error) throw error;
  return count ?? 0;
}

async function upsertIdentity(
  contactId: string,
  identityType: "phone" | "pn_jid" | "lid_jid" | "raw_jid",
  identityValue: string
): Promise<void> {
  const { error } = await supabase.from("contact_identities").upsert(
    {
      business_id: businessId,
      contact_id: contactId,
      identity_type: identityType,
      identity_value: identityValue,
    },
    { onConflict: "business_id,identity_value", ignoreDuplicates: true }
  );
  if (error) throw error;
}

function groupKey(row: ConversationRow): string {
  const parsed = parseWhatsAppIdentity(row.phone_jid);
  if (parsed.phoneNumber) return `phone:${parsed.phoneNumber}`;
  if (row.display_name?.trim()) return `name:${row.display_name.trim().toLowerCase()}`;
  return `jid:${parsed.normalizedJid}`;
}

function choosePrimary(rows: Array<ConversationRow & { msgCount: number }>): ConversationRow & { msgCount: number } {
  return [...rows].sort((a, b) => {
    const aPn = a.phone_jid.endsWith("@s.whatsapp.net") ? 1 : 0;
    const bPn = b.phone_jid.endsWith("@s.whatsapp.net") ? 1 : 0;
    if (bPn !== aPn) return bPn - aPn;
    const aHuman = a.mode === "HUMAN" ? 1 : 0;
    const bHuman = b.mode === "HUMAN" ? 1 : 0;
    if (bHuman !== aHuman) return bHuman - aHuman;
    if (b.msgCount !== a.msgCount) return b.msgCount - a.msgCount;
    return a.created_at.localeCompare(b.created_at);
  })[0]!;
}

async function findOrCreateContact(primary: ConversationRow, rows: ConversationRow[]): Promise<ContactRow> {
  const candidates = rows.map((row) => parseWhatsAppIdentity(row.phone_jid));
  const pnJid = candidates.find((item) => item.identityType === "pn_jid")?.normalizedJid ?? null;
  const lidJid = candidates.find((item) => item.identityType === "lid_jid")?.normalizedJid ?? null;
  const phoneNumber = candidates.find((item) => item.phoneNumber)?.phoneNumber ?? null;
  const displayName = rows.find((row) => row.display_name?.trim())?.display_name?.trim() ?? null;

  const orFilters: string[] = [];
  if (phoneNumber) orFilters.push(`phone_number.eq.${phoneNumber}`);
  if (pnJid) orFilters.push(`primary_jid.eq.${pnJid}`);
  if (displayName) orFilters.push(`display_name.eq.${displayName}`);

  if (orFilters.length > 0) {
    const { data: existing, error } = await supabase
      .from("contacts")
      .select("id, display_name, phone_number, primary_jid")
      .eq("business_id", businessId)
      .or(orFilters.join(","))
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (existing) {
      const nextPrimaryJid =
        pnJid ??
        (existing.primary_jid?.endsWith("@s.whatsapp.net") ? existing.primary_jid : existing.primary_jid ?? lidJid);

      const { data: updated, error: updateError } = await supabase
        .from("contacts")
        .update({
          display_name: existing.display_name ?? displayName,
          phone_number: existing.phone_number ?? phoneNumber,
          primary_jid: nextPrimaryJid,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select("id, display_name, phone_number, primary_jid")
        .single();

      if (updateError) throw updateError;
      return updated;
    }
  }

  const { data: created, error: createError } = await supabase
    .from("contacts")
    .insert({
      business_id: businessId,
      display_name: displayName,
      phone_number: phoneNumber,
      primary_jid: pnJid ?? lidJid ?? primary.phone_jid,
      updated_at: new Date().toISOString(),
    })
    .select("id, display_name, phone_number, primary_jid")
    .single();

  if (createError) throw createError;
  return created;
}

async function run(): Promise<void> {
  console.log(APPLY ? "[repair] mode=apply" : "[repair] mode=dry-run");

  const { data: conversations, error } = await supabase
    .from("conversations")
    .select("id, contact_id, phone_jid, display_name, mode, last_message_at, created_at")
    .eq("business_id", businessId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  if (!conversations || conversations.length === 0) {
    console.log("[repair] no conversations found");
    return;
  }

  const groups = new Map<string, ConversationRow[]>();
  for (const row of conversations as ConversationRow[]) {
    const key = groupKey(row);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  for (const [key, rows] of groups) {
    const scored = await Promise.all(
      rows.map(async (row) => ({ ...row, msgCount: await countMessages(row.id) }))
    );
    const primary = choosePrimary(scored);
    const duplicates = scored.filter((row) => row.id !== primary.id);

    console.log(`[repair] group=${key} primary=${primary.id} duplicates=${duplicates.length}`);
    for (const row of scored) {
      console.log(`  - conv=${row.id} jid=${row.phone_jid} mode=${row.mode} messages=${row.msgCount}`);
    }

    if (!APPLY) continue;

    const contact = await findOrCreateContact(primary, rows);
    const pnJid = rows
      .map((row) => parseWhatsAppIdentity(row.phone_jid))
      .find((item) => item.identityType === "pn_jid")
      ?.normalizedJid;
    const lidJid = rows
      .map((row) => parseWhatsAppIdentity(row.phone_jid))
      .find((item) => item.identityType === "lid_jid")
      ?.normalizedJid;
    const phoneNumber = rows
      .map((row) => parseWhatsAppIdentity(row.phone_jid).phoneNumber)
      .find(Boolean);

    if (pnJid) await upsertIdentity(contact.id, "pn_jid", pnJid);
    if (lidJid) await upsertIdentity(contact.id, "lid_jid", lidJid);
    if (phoneNumber) await upsertIdentity(contact.id, "phone", phoneNumber);

    for (const row of rows) {
      const parsed = parseWhatsAppIdentity(row.phone_jid);
      await upsertIdentity(contact.id, parsed.identityType, parsed.normalizedJid);
      if (parsed.rawJid !== parsed.normalizedJid) {
        await upsertIdentity(contact.id, "raw_jid", parsed.rawJid);
      }
    }

    const primaryJid = pnJid ?? contact.primary_jid ?? primary.phone_jid;
    const normalizedPhone = phoneNumber ?? contact.phone_number;

    await supabase
      .from("contacts")
      .update({
        primary_jid: primaryJid,
        phone_number: normalizedPhone,
        display_name: contact.display_name ?? primary.display_name,
        updated_at: new Date().toISOString(),
      })
      .eq("id", contact.id);

    await supabase
      .from("conversations")
      .update({
        contact_id: contact.id,
        phone_jid: primaryJid,
        display_name: contact.display_name ?? primary.display_name,
        updated_at: new Date().toISOString(),
      })
      .eq("id", primary.id);

    for (const duplicate of duplicates) {
      const latestAt = [primary.last_message_at, duplicate.last_message_at].filter(Boolean).sort().pop();

      const { error: moveMessagesError } = await supabase
        .from("messages")
        .update({ conversation_id: primary.id })
        .eq("conversation_id", duplicate.id);
      if (moveMessagesError) throw moveMessagesError;

      const { error: moveOutboxError } = await supabase
        .from("outbox_messages")
        .update({
          conversation_id: primary.id,
          contact_id: contact.id,
          phone_jid: primaryJid,
        })
        .eq("conversation_id", duplicate.id);
      if (moveOutboxError) throw moveOutboxError;

      await supabase
        .from("conversations")
        .update({
          contact_id: contact.id,
          phone_jid: primaryJid,
          display_name: contact.display_name ?? primary.display_name,
          last_message_at: latestAt ?? primary.last_message_at,
          updated_at: new Date().toISOString(),
        })
        .eq("id", primary.id);

      const { error: deleteError } = await supabase
        .from("conversations")
        .delete()
        .eq("id", duplicate.id);
      if (deleteError) throw deleteError;
    }
  }

  console.log(APPLY ? "[repair] apply complete" : "[repair] dry-run complete; use --apply");
}

run().catch((error) => {
  console.error("[repair] error:", error);
  process.exit(1);
});
