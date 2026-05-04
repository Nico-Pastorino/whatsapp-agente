import "./env-loader";
import { createClient } from "@supabase/supabase-js";
import { getPhoneFromJid, parseWhatsAppIdentity } from "../src/lib/whatsapp-jid";

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

function scoreConversation(row: ConversationRow, msgCount: number): number {
  let score = 0;
  if (row.mode === "HUMAN") score += 1000;
  if (row.phone_jid.endsWith("@s.whatsapp.net")) score += 100;
  score += msgCount;
  return score;
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
    {
      onConflict: "business_id,identity_value",
      ignoreDuplicates: true,
    }
  );

  if (error) throw error;
}

async function createOrReuseContact(key: string, rows: ConversationRow[]): Promise<ContactRow> {
  const first = rows[0];
  const parsed = parseWhatsAppIdentity(first.phone_jid);
  const phoneNumber = rows.map((row) => parseWhatsAppIdentity(row.phone_jid).phoneNumber).find(Boolean) ?? null;
  const displayName = rows.map((row) => row.display_name?.trim()).find(Boolean) ?? null;
  const primaryJid =
    rows
      .map((row) => parseWhatsAppIdentity(row.phone_jid))
      .find((candidate) => candidate.identityType === "pn_jid")
      ?.normalizedJid ??
    parsed.normalizedJid;

  const { data: existing, error: existingError } = await supabase
    .from("contacts")
    .select("id, display_name, phone_number, primary_jid")
    .eq("business_id", businessId)
    .or(phoneNumber ? `phone_number.eq.${phoneNumber},primary_jid.eq.${primaryJid}` : `primary_jid.eq.${primaryJid}`)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) {
    const { data: updated, error: updateError } = await supabase
      .from("contacts")
      .update({
        display_name: existing.display_name ?? displayName,
        phone_number: existing.phone_number ?? phoneNumber,
        primary_jid:
          existing.primary_jid?.endsWith("@s.whatsapp.net") ? existing.primary_jid : primaryJid,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("id, display_name, phone_number, primary_jid")
      .single();

    if (updateError) throw updateError;
    return updated;
  }

  const { data: created, error: createError } = await supabase
    .from("contacts")
    .insert({
      business_id: businessId,
      display_name: displayName,
      phone_number: phoneNumber,
      primary_jid: primaryJid,
      updated_at: new Date().toISOString(),
    })
    .select("id, display_name, phone_number, primary_jid")
    .single();

  if (createError) throw createError;
  return created;
}

async function run(): Promise<void> {
  console.log(APPLY ? "[contacts] mode=apply" : "[contacts] mode=dry-run");

  const { data: conversations, error } = await supabase
    .from("conversations")
    .select("id, contact_id, phone_jid, display_name, mode, last_message_at, created_at")
    .eq("business_id", businessId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  if (!conversations || conversations.length === 0) {
    console.log("[contacts] no conversations found");
    return;
  }

  const groups = new Map<string, ConversationRow[]>();
  for (const row of conversations as ConversationRow[]) {
    const parsed = parseWhatsAppIdentity(row.phone_jid);
    const key = parsed.phoneNumber ? `phone:${parsed.phoneNumber}` : `jid:${parsed.normalizedJid}`;
    const existing = groups.get(key) ?? [];
    existing.push(row);
    groups.set(key, existing);
  }

  for (const [key, rows] of groups) {
    const counts = await Promise.all(rows.map((row) => countMessages(row.id)));
    const ranked = rows
      .map((row, index) => ({ row, msgCount: counts[index], score: scoreConversation(row, counts[index]) }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.row.created_at.localeCompare(b.row.created_at);
      });

    const primary = ranked[0]!.row;
    const duplicates = ranked.slice(1).map((item) => item.row);

    console.log(`[contacts] group=${key} primary=${primary.id} duplicates=${duplicates.length}`);
    for (const item of ranked) {
      console.log(
        `  - conv=${item.row.id} jid=${item.row.phone_jid} mode=${item.row.mode} messages=${item.msgCount}`
      );
    }

    if (!APPLY) continue;

    const contact = await createOrReuseContact(key, rows);
    console.log(`[contacts] contact=${contact.id} phone=${contact.phone_number ?? "-"} primary_jid=${contact.primary_jid ?? "-"}`);

    for (const row of rows) {
      const parsed = parseWhatsAppIdentity(row.phone_jid);
      await upsertIdentity(contact.id, parsed.identityType, parsed.normalizedJid);
      if (parsed.rawJid !== parsed.normalizedJid) {
        await upsertIdentity(contact.id, "raw_jid", parsed.rawJid);
      }
      if (parsed.phoneNumber) {
        await upsertIdentity(contact.id, "phone", parsed.phoneNumber);
      }
    }

    await supabase
      .from("conversations")
      .update({
        contact_id: contact.id,
        phone_jid: contact.primary_jid ?? primary.phone_jid,
        display_name: contact.display_name ?? primary.display_name,
        updated_at: new Date().toISOString(),
      })
      .eq("id", primary.id);

    for (const duplicate of duplicates) {
      const canonicalJid = contact.primary_jid ?? primary.phone_jid;

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
          phone_jid: canonicalJid,
        })
        .eq("conversation_id", duplicate.id);
      if (moveOutboxError) throw moveOutboxError;

      const latestAt = [primary.last_message_at, duplicate.last_message_at].filter(Boolean).sort().pop();
      await supabase
        .from("conversations")
        .update({
          contact_id: contact.id,
          phone_jid: canonicalJid,
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

  if (!APPLY) {
    console.log("[contacts] dry-run complete. Re-run with --apply to execute.");
  } else {
    console.log("[contacts] migration applied.");
  }
}

run().catch((error) => {
  console.error("[contacts] error:", error);
  process.exit(1);
});
