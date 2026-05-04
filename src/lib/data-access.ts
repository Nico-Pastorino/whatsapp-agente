import { randomUUID } from "node:crypto";
import { getBusinessId, getWorkerInstanceName } from "./env";
import { getSupabaseAdminClient } from "./supabase";
import {
  extractPhoneNumberIfKnown,
  getPhoneFromJid,
  normalizeWhatsAppJid,
  parseWhatsAppIdentity,
  type IdentityType,
} from "./whatsapp-jid";

export interface ProductItem {
  id?: string;
  name: string;
  price: string;
  description: string;
}

export interface BusinessProfile {
  id: string;
  name: string;
  description: string;
  products: ProductItem[];
  extra: string;
  updated_at: number;
}

export interface Conversation {
  id: string;
  contact_id: string | null;
  phone: string;
  name: string | null;
  mode: "AI" | "HUMAN";
  last_message_at: number | null;
  created_at: number;
}

export interface ConversationWithPreview extends Conversation {
  last_message_preview: string | null;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "human";
  content: string;
  created_at: number;
}

export interface ConnectionState {
  id: 1;
  status: "disconnected" | "qr" | "connecting" | "connected";
  qr_string: string | null;
  phone: string | null;
  updated_at: number;
  worker_online: boolean;
  last_seen_at: number | null;
  auth_path: string | null;
}

export interface OutboxItem {
  id: string;
  conversation_id: string;
  contact_id: string | null;
  phone: string;
  content: string;
  sent: number;
  created_at: number;
}

interface SubscriptionRow {
  plan_code: string;
  status: "trial" | "active" | "past_due" | "canceled";
  monthly_message_limit: number | null;
  monthly_ai_reply_limit: number | null;
}

interface UsageRow {
  id: string;
  inbound_messages_count: number;
  ai_replies_count: number;
  human_messages_count: number;
}

interface ContactRow {
  id: string;
  display_name: string | null;
  phone_number: string | null;
  primary_jid: string | null;
  updated_at?: string;
  created_at?: string;
}

interface ContactIdentityRow {
  id: string;
  contact_id: string;
  identity_type: IdentityType;
  identity_value: string;
}

interface ConversationRow {
  id: string;
  contact_id: string | null;
  phone_jid: string;
  display_name: string | null;
  mode: "AI" | "HUMAN";
  last_message_at: string | null;
  created_at: string;
  contact?: ContactRow | ContactRow[] | null;
}

interface ResolvedContactIdentity {
  contactId: string;
  contact: ContactRow;
  identitiesFound: string[];
  phoneNumber: string | null;
  canonicalTargetJid: string;
}

interface ResolveContactIdentityInput {
  businessId?: string;
  rawJid: string;
  pushName?: string;
  phoneNumberIfKnown?: string | null;
}

function toUnixSeconds(value: string | null | undefined): number | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : Math.floor(timestamp / 1000);
}

function requireSingleRow<T>(value: T | null, table: string): T {
  if (!value) {
    throw new Error(`Missing expected row in ${table}`);
  }
  return value;
}

function monthStartIso(date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

function defaultSlugFromBusinessId(businessId: string): string {
  return `business-${businessId.slice(0, 8)}`;
}

function normalizeOptionalPhoneNumber(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value.replace(/[^\d]/g, "");
  return cleaned.length >= 7 ? cleaned : null;
}

function asSingleContact(contact: ContactRow | ContactRow[] | null | undefined): ContactRow | null {
  if (!contact) return null;
  return Array.isArray(contact) ? contact[0] ?? null : contact;
}

function mapConversationRow(row: ConversationRow): Conversation {
  const contact = asSingleContact(row.contact);
  return {
    id: row.id,
    contact_id: row.contact_id,
    phone: contact?.primary_jid ?? row.phone_jid,
    name: contact?.display_name ?? row.display_name,
    mode: row.mode,
    last_message_at: toUnixSeconds(row.last_message_at),
    created_at: toUnixSeconds(row.created_at) ?? 0,
  };
}

function mapMessageRow(row: {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "human";
  content: string;
  created_at: string;
}): Message {
  return {
    id: row.id,
    conversation_id: row.conversation_id,
    role: row.role,
    content: row.content,
    created_at: toUnixSeconds(row.created_at) ?? 0,
  };
}

function buildIdentityCandidates(
  rawJid: string,
  phoneNumberIfKnown?: string | null
): Array<{ type: IdentityType; value: string }> {
  const parsed = parseWhatsAppIdentity(rawJid);
  const normalizedPhone = normalizeOptionalPhoneNumber(phoneNumberIfKnown);
  const candidates: Array<{ type: IdentityType; value: string }> = [];
  const seen = new Set<string>();

  const pushCandidate = (type: IdentityType, value: string | null | undefined) => {
    if (!value) return;
    const normalized = value.trim();
    if (!normalized) return;
    if (seen.has(normalized)) return;
    seen.add(normalized);
    candidates.push({ type, value: normalized });
  };

  pushCandidate(parsed.identityType, parsed.normalizedJid);
  if (parsed.rawJid !== parsed.normalizedJid) {
    pushCandidate("raw_jid", parsed.rawJid);
  }
  pushCandidate("phone", normalizedPhone ?? parsed.phoneNumber);

  return candidates;
}

async function ensureBusinessBootstrap(): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const businessId = getBusinessId();
  const instanceName = getWorkerInstanceName();
  const now = new Date().toISOString();

  const { error: businessError } = await supabase.from("businesses").upsert(
    {
      id: businessId,
      slug: defaultSlugFromBusinessId(businessId),
      display_name: "",
      updated_at: now,
    },
    {
      onConflict: "id",
      ignoreDuplicates: true,
    }
  );
  if (businessError) throw businessError;

  const { error: settingsError } = await supabase
    .from("business_settings")
    .upsert(
      {
        business_id: businessId,
        description: "",
        extra: "",
        system_prompt_override: "",
        updated_at: now,
      },
      { onConflict: "business_id", ignoreDuplicates: true }
    );
  if (settingsError) throw settingsError;

  const { error: subscriptionError } = await supabase
    .from("subscriptions")
    .upsert(
      {
        business_id: businessId,
        plan_code: "starter",
        status: "active",
        updated_at: now,
      },
      { onConflict: "business_id", ignoreDuplicates: true }
    );
  if (subscriptionError) throw subscriptionError;

  const { error: sessionError } = await supabase.from("whatsapp_sessions").upsert(
    {
      business_id: businessId,
      instance_name: instanceName,
      status: "disconnected",
      desired_action: "none",
      updated_at: now,
    },
    {
      onConflict: "business_id,instance_name",
      ignoreDuplicates: true,
    }
  );
  if (sessionError) throw sessionError;
}

async function getCurrentUsage(): Promise<UsageRow> {
  await ensureBusinessBootstrap();

  const supabase = getSupabaseAdminClient();
  const businessId = getBusinessId();
  const monthStart = monthStartIso();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("usage_monthly")
    .upsert(
      {
        business_id: businessId,
        month_start: monthStart,
        updated_at: now,
      },
      {
        onConflict: "business_id,month_start",
        ignoreDuplicates: false,
      }
    )
    .select("id, inbound_messages_count, ai_replies_count, human_messages_count")
    .single();

  if (error) throw error;
  return requireSingleRow(data, "usage_monthly");
}

async function incrementUsage(
  field: "inbound_messages_count" | "ai_replies_count" | "human_messages_count"
): Promise<void> {
  const usage = await getCurrentUsage();
  const supabase = getSupabaseAdminClient();
  const patch = {
    [field]: usage[field] + 1,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("usage_monthly")
    .update(patch)
    .eq("id", usage.id);

  if (error) throw error;
}

async function getConversationRowById(id: string): Promise<ConversationRow | null> {
  await ensureBusinessBootstrap();

  const supabase = getSupabaseAdminClient();
  const businessId = getBusinessId();
  const { data, error } = await supabase
    .from("conversations")
    .select(
      "id, contact_id, phone_jid, display_name, mode, last_message_at, created_at, contact:contacts!conversations_contact_id_fkey(id, display_name, phone_number, primary_jid)"
    )
    .eq("business_id", businessId)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data as ConversationRow | null;
}

async function upsertIdentityForContact(
  businessId: string,
  contactId: string,
  type: IdentityType,
  value: string
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { data: existing, error: existingError } = await supabase
    .from("contact_identities")
    .select("id, contact_id, identity_type, identity_value")
    .eq("business_id", businessId)
    .eq("identity_value", value)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) return;

  const { error } = await supabase.from("contact_identities").upsert(
    {
      business_id: businessId,
      contact_id: contactId,
      identity_type: type,
      identity_value: value,
    },
    {
      onConflict: "business_id,identity_value",
      ignoreDuplicates: true,
    }
  );

  if (error) throw error;
}

async function getBestTargetJidForContact(
  businessId: string,
  contact: ContactRow
): Promise<string> {
  if (contact.primary_jid) return contact.primary_jid;

  const supabase = getSupabaseAdminClient();
  const { data: identities, error } = await supabase
    .from("contact_identities")
    .select("identity_type, identity_value")
    .eq("business_id", businessId)
    .eq("contact_id", contact.id);

  if (error) throw error;

  const pnJid = identities?.find((identity) => identity.identity_type === "pn_jid")?.identity_value;
  if (pnJid) return pnJid;

  const lidJid = identities?.find((identity) => identity.identity_type === "lid_jid")?.identity_value;
  if (lidJid) return lidJid;

  const rawJid = identities?.find((identity) => identity.identity_type === "raw_jid")?.identity_value;
  if (rawJid) return rawJid;

  if (contact.phone_number) return `${contact.phone_number}@s.whatsapp.net`;
  return "";
}

async function updateContactMetadata(
  businessId: string,
  contact: ContactRow,
  patch: {
    display_name?: string | null;
    phone_number?: string | null;
    primary_jid?: string | null;
  }
): Promise<ContactRow> {
  const nextDisplayName = patch.display_name ?? contact.display_name ?? null;
  const nextPhoneNumber = patch.phone_number ?? contact.phone_number ?? null;
  const nextPrimaryJid = patch.primary_jid ?? contact.primary_jid ?? null;

  const shouldUpdate =
    nextDisplayName !== contact.display_name ||
    nextPhoneNumber !== contact.phone_number ||
    nextPrimaryJid !== contact.primary_jid;

  if (!shouldUpdate) return { ...contact };

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("contacts")
    .update({
      display_name: nextDisplayName,
      phone_number: nextPhoneNumber,
      primary_jid: nextPrimaryJid,
      updated_at: new Date().toISOString(),
    })
    .eq("business_id", businessId)
    .eq("id", contact.id)
    .select("id, display_name, phone_number, primary_jid")
    .single();

  if (error) throw error;
  return requireSingleRow(data, "contacts");
}

export async function resolveContactIdentity(
  input: ResolveContactIdentityInput
): Promise<ResolvedContactIdentity> {
  await ensureBusinessBootstrap();

  const supabase = getSupabaseAdminClient();
  const businessId = input.businessId ?? getBusinessId();
  const parsed = parseWhatsAppIdentity(input.rawJid);
  const phoneNumberIfKnown =
    normalizeOptionalPhoneNumber(input.phoneNumberIfKnown) ?? parsed.phoneNumber;
  const identityCandidates = buildIdentityCandidates(input.rawJid, phoneNumberIfKnown);

  console.log("[identity] rawJid:", input.rawJid);

  for (const candidate of identityCandidates) {
    const { data: identity, error } = await supabase
      .from("contact_identities")
      .select("id, contact_id, identity_type, identity_value")
      .eq("business_id", businessId)
      .eq("identity_value", candidate.value)
      .maybeSingle();

    if (error) throw error;
    if (!identity) continue;

    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .select("id, display_name, phone_number, primary_jid")
      .eq("business_id", businessId)
      .eq("id", identity.contact_id)
      .single();

    if (contactError) throw contactError;

    const updated = await updateContactMetadata(businessId, contact, {
      display_name: input.pushName?.trim() || contact.display_name,
      phone_number: phoneNumberIfKnown ?? contact.phone_number,
      primary_jid:
        parsed.identityType === "pn_jid" ? parsed.normalizedJid : contact.primary_jid,
    });

    for (const nextCandidate of identityCandidates) {
      await upsertIdentityForContact(
        businessId,
        updated.id,
        nextCandidate.type,
        nextCandidate.value
      );
    }

    const canonicalTargetJid = await getBestTargetJidForContact(businessId, updated);
    console.log("[identity] resolved contact_id:", updated.id);
    console.log(
      "[identity] identities found:",
      identityCandidates.map((item) => `${item.type}:${item.value}`).join(", ")
    );

    return {
      contactId: updated.id,
      contact: updated,
      identitiesFound: identityCandidates.map((item) => item.value),
      phoneNumber: updated.phone_number ?? phoneNumberIfKnown,
      canonicalTargetJid,
    };
  }

  if (phoneNumberIfKnown) {
    const { data: contactByPhone, error } = await supabase
      .from("contacts")
      .select("id, display_name, phone_number, primary_jid")
      .eq("business_id", businessId)
      .eq("phone_number", phoneNumberIfKnown)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (contactByPhone) {
      const updated = await updateContactMetadata(businessId, contactByPhone, {
        display_name: input.pushName?.trim() || contactByPhone.display_name,
        phone_number: phoneNumberIfKnown,
        primary_jid:
          parsed.identityType === "pn_jid"
            ? parsed.normalizedJid
            : contactByPhone.primary_jid,
      });

      for (const nextCandidate of identityCandidates) {
        await upsertIdentityForContact(
          businessId,
          updated.id,
          nextCandidate.type,
          nextCandidate.value
        );
      }

      const canonicalTargetJid = await getBestTargetJidForContact(businessId, updated);
      console.log("[identity] resolved contact_id:", updated.id);
      console.log(
        "[identity] identities found:",
        identityCandidates.map((item) => `${item.type}:${item.value}`).join(", ")
      );

      return {
        contactId: updated.id,
        contact: updated,
        identitiesFound: identityCandidates.map((item) => item.value),
        phoneNumber: updated.phone_number,
        canonicalTargetJid,
      };
    }
  }

  const primaryJid =
    parsed.identityType === "pn_jid"
      ? parsed.normalizedJid
      : phoneNumberIfKnown
      ? `${phoneNumberIfKnown}@s.whatsapp.net`
      : parsed.normalizedJid;

  const { data: created, error: createError } = await supabase
    .from("contacts")
    .insert({
      business_id: businessId,
      display_name: input.pushName?.trim() || null,
      phone_number: phoneNumberIfKnown,
      primary_jid: primaryJid,
      updated_at: new Date().toISOString(),
    })
    .select("id, display_name, phone_number, primary_jid")
    .single();

  if (createError) throw createError;

  for (const candidate of identityCandidates) {
    await upsertIdentityForContact(businessId, created.id, candidate.type, candidate.value);
  }

  console.log("[identity] resolved contact_id:", created.id);
  console.log(
    "[identity] identities found:",
    identityCandidates.map((item) => `${item.type}:${item.value}`).join(", ")
  );

  return {
    contactId: created.id,
    contact: created,
    identitiesFound: identityCandidates.map((item) => item.value),
    phoneNumber: created.phone_number,
    canonicalTargetJid: await getBestTargetJidForContact(businessId, created),
  };
}

export async function canUseAssistant(): Promise<boolean> {
  await ensureBusinessBootstrap();

  const supabase = getSupabaseAdminClient();
  const businessId = getBusinessId();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("plan_code, status, monthly_message_limit, monthly_ai_reply_limit")
    .eq("business_id", businessId)
    .single();

  if (error) throw error;

  const subscription = requireSingleRow(data, "subscriptions") as SubscriptionRow;
  if (subscription.status !== "active" && subscription.status !== "trial") {
    return false;
  }

  const usage = await getCurrentUsage();
  if (
    typeof subscription.monthly_message_limit === "number" &&
    usage.inbound_messages_count >= subscription.monthly_message_limit
  ) {
    return false;
  }

  if (
    typeof subscription.monthly_ai_reply_limit === "number" &&
    usage.ai_replies_count >= subscription.monthly_ai_reply_limit
  ) {
    return false;
  }

  return true;
}

export async function recordInboundMessageUsage(): Promise<void> {
  await incrementUsage("inbound_messages_count");
}

export async function recordAiReplyUsage(): Promise<void> {
  await incrementUsage("ai_replies_count");
}

export async function recordHumanMessageUsage(): Promise<void> {
  await incrementUsage("human_messages_count");
}

export async function getBusinessProfile(): Promise<BusinessProfile> {
  await ensureBusinessBootstrap();

  const supabase = getSupabaseAdminClient();
  const businessId = getBusinessId();
  const [
    { data: business, error: businessError },
    { data: settings, error: settingsError },
    { data: products, error: productsError },
  ] = await Promise.all([
    supabase
      .from("businesses")
      .select("id, display_name, updated_at")
      .eq("id", businessId)
      .single(),
    supabase
      .from("business_settings")
      .select("description, extra, updated_at")
      .eq("business_id", businessId)
      .single(),
    supabase
      .from("products")
      .select("id, name, price_text, description")
      .eq("business_id", businessId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  if (businessError) throw businessError;
  if (settingsError) throw settingsError;
  if (productsError) throw productsError;

  const updatedAt = Math.max(
    toUnixSeconds(business?.updated_at) ?? 0,
    toUnixSeconds(settings?.updated_at) ?? 0
  );

  return {
    id: businessId,
    name: business?.display_name ?? "",
    description: settings?.description ?? "",
    extra: settings?.extra ?? "",
    products: (products ?? []).map((product) => ({
      id: product.id,
      name: product.name,
      price: product.price_text,
      description: product.description,
    })),
    updated_at: updatedAt,
  };
}

export async function setBusinessProfile(patch: {
  name: string;
  description: string;
  products: ProductItem[];
  extra: string;
}): Promise<void> {
  await ensureBusinessBootstrap();

  const supabase = getSupabaseAdminClient();
  const businessId = getBusinessId();
  const now = new Date().toISOString();

  const { error: businessError } = await supabase
    .from("businesses")
    .update({
      display_name: patch.name,
      updated_at: now,
    })
    .eq("id", businessId);
  if (businessError) throw businessError;

  const { error: settingsError } = await supabase
    .from("business_settings")
    .update({
      description: patch.description,
      extra: patch.extra,
      updated_at: now,
    })
    .eq("business_id", businessId);
  if (settingsError) throw settingsError;

  const { error: deleteError } = await supabase
    .from("products")
    .delete()
    .eq("business_id", businessId);
  if (deleteError) throw deleteError;

  if (patch.products.length > 0) {
    const { error: insertError } = await supabase.from("products").insert(
      patch.products.map((product, index) => ({
        id: product.id ?? randomUUID(),
        business_id: businessId,
        name: product.name,
        price_text: product.price,
        description: product.description,
        sort_order: index,
        updated_at: now,
      }))
    );

    if (insertError) throw insertError;
  }
}

export async function getOrCreateConversation(input: {
  rawJid: string;
  pushName?: string;
  phoneNumberIfKnown?: string | null;
}): Promise<Conversation> {
  await ensureBusinessBootstrap();

  const supabase = getSupabaseAdminClient();
  const businessId = getBusinessId();
  const now = new Date().toISOString();
  const resolved = await resolveContactIdentity({
    businessId,
    rawJid: input.rawJid,
    pushName: input.pushName,
    phoneNumberIfKnown: input.phoneNumberIfKnown,
  });

  const targetJid =
    resolved.canonicalTargetJid || normalizeWhatsAppJid(input.rawJid);

  const { data: existing, error: existingError } = await supabase
    .from("conversations")
    .select(
      "id, contact_id, phone_jid, display_name, mode, last_message_at, created_at, contact:contacts!conversations_contact_id_fkey(id, display_name, phone_number, primary_jid)"
    )
    .eq("business_id", businessId)
    .eq("contact_id", resolved.contactId)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing) {
    const nextDisplayName =
      resolved.contact.display_name ?? input.pushName?.trim() ?? existing.display_name;
    const { error: updateError } = await supabase
      .from("conversations")
      .update({
        phone_jid: targetJid || existing.phone_jid,
        display_name: nextDisplayName,
        updated_at: now,
      })
      .eq("id", existing.id);

    if (updateError) throw updateError;

    console.log("[conversation] reused conversation_id:", existing.id);
    return mapConversationRow({
      ...existing,
      phone_jid: targetJid || existing.phone_jid,
      display_name: nextDisplayName,
      contact: {
        ...resolved.contact,
        primary_jid: targetJid || resolved.contact.primary_jid,
      },
    } as ConversationRow);
  }

  const { data: created, error: createError } = await supabase
    .from("conversations")
    .insert({
      business_id: businessId,
      contact_id: resolved.contactId,
      phone_jid: targetJid,
      display_name: resolved.contact.display_name ?? input.pushName?.trim() ?? null,
      mode: "AI",
      created_at: now,
      updated_at: now,
    })
    .select(
      "id, contact_id, phone_jid, display_name, mode, last_message_at, created_at, contact:contacts!conversations_contact_id_fkey(id, display_name, phone_number, primary_jid)"
    )
    .single();

  if (createError) {
    const { data: retried, error: retryError } = await supabase
      .from("conversations")
      .select(
        "id, contact_id, phone_jid, display_name, mode, last_message_at, created_at, contact:contacts!conversations_contact_id_fkey(id, display_name, phone_number, primary_jid)"
      )
      .eq("business_id", businessId)
      .eq("contact_id", resolved.contactId)
      .maybeSingle();

    if (retryError) throw retryError;
    if (retried) {
      console.log("[conversation] reused conversation_id:", retried.id);
      return mapConversationRow(retried as ConversationRow);
    }
    throw createError;
  }

  console.log("[conversation] created conversation_id:", created.id);
  return mapConversationRow(created as ConversationRow);
}

export async function getConversationById(id: string): Promise<Conversation | null> {
  const row = await getConversationRowById(id);
  return row ? mapConversationRow(row) : null;
}

export async function setMode(
  conversationId: string,
  mode: "AI" | "HUMAN"
): Promise<void> {
  await ensureBusinessBootstrap();

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("conversations")
    .update({
      mode,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId)
    .eq("business_id", getBusinessId());

  if (error) throw error;
}

export async function listConversations(): Promise<ConversationWithPreview[]> {
  await ensureBusinessBootstrap();

  const supabase = getSupabaseAdminClient();
  const businessId = getBusinessId();
  const { data: conversations, error: conversationsError } = await supabase
    .from("conversations")
    .select(
      "id, contact_id, phone_jid, display_name, mode, last_message_at, created_at, contact:contacts!conversations_contact_id_fkey(id, display_name, phone_number, primary_jid)"
    )
    .eq("business_id", businessId)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (conversationsError) throw conversationsError;

  const mapped = (conversations ?? []).map((row) => mapConversationRow(row as ConversationRow));
  if (mapped.length === 0) return [];

  const previews = await Promise.all(
    mapped.map(async (conversation) => {
      const { data, error } = await supabase
        .from("messages")
        .select("content")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      return {
        ...conversation,
        last_message_preview: data?.content ?? null,
      };
    })
  );

  return previews;
}

export async function deleteConversation(id: string): Promise<void> {
  await ensureBusinessBootstrap();

  const supabase = getSupabaseAdminClient();
  const businessId = getBusinessId();
  const { error } = await supabase
    .from("conversations")
    .delete()
    .eq("id", id)
    .eq("business_id", businessId);

  if (error) throw error;
}

export async function insertMessage(
  conversationId: string,
  role: "user" | "assistant" | "human",
  content: string
): Promise<Message> {
  await ensureBusinessBootstrap();

  const supabase = getSupabaseAdminClient();
  const businessId = getBusinessId();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("messages")
    .insert({
      business_id: businessId,
      conversation_id: conversationId,
      role,
      content,
      created_at: now,
    })
    .select("id, conversation_id, role, content, created_at")
    .single();

  if (error) throw error;

  const { error: updateConversationError } = await supabase
    .from("conversations")
    .update({
      last_message_at: now,
      updated_at: now,
    })
    .eq("id", conversationId)
    .eq("business_id", businessId);

  if (updateConversationError) throw updateConversationError;
  return mapMessageRow(requireSingleRow(data, "messages"));
}

export async function getMessages(
  conversationId: string,
  limit = 50
): Promise<Message[]> {
  await ensureBusinessBootstrap();

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("messages")
    .select("id, conversation_id, role, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map(mapMessageRow);
}

export async function getRecentHistory(
  conversationId: string,
  limit = 20
): Promise<Message[]> {
  await ensureBusinessBootstrap();

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("messages")
    .select("id, conversation_id, role, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map(mapMessageRow).reverse();
}

export async function getConnectionState(): Promise<ConnectionState> {
  await ensureBusinessBootstrap();

  const supabase = getSupabaseAdminClient();
  const businessId = getBusinessId();
  const instanceName = getWorkerInstanceName();
  const { data, error } = await supabase
    .from("whatsapp_sessions")
    .select("status, qr_string, phone, auth_path, last_seen_at, updated_at")
    .eq("business_id", businessId)
    .eq("instance_name", instanceName)
    .single();

  if (error) throw error;

  const lastSeenAt = toUnixSeconds(data.last_seen_at);
  const now = Math.floor(Date.now() / 1000);
  const workerOnline = typeof lastSeenAt === "number" ? now - lastSeenAt <= 15 : false;

  return {
    id: 1,
    status: data.status,
    qr_string: data.qr_string,
    phone: data.phone,
    auth_path: data.auth_path,
    last_seen_at: lastSeenAt,
    updated_at: toUnixSeconds(data.updated_at) ?? 0,
    worker_online: workerOnline,
  };
}

export async function setConnectionState(patch: {
  status: "disconnected" | "qr" | "connecting" | "connected";
  qr_string?: string | null;
  phone?: string | null;
  auth_path?: string | null;
}): Promise<void> {
  await ensureBusinessBootstrap();

  const supabase = getSupabaseAdminClient();
  const businessId = getBusinessId();
  const instanceName = getWorkerInstanceName();
  const current = await getConnectionState();

  const { error } = await supabase
    .from("whatsapp_sessions")
    .update({
      status: patch.status,
      qr_string: patch.qr_string !== undefined ? patch.qr_string : current.qr_string,
      phone: patch.phone !== undefined ? patch.phone : current.phone,
      auth_path: patch.auth_path !== undefined ? patch.auth_path : current.auth_path,
      updated_at: new Date().toISOString(),
    })
    .eq("business_id", businessId)
    .eq("instance_name", instanceName);

  if (error) throw error;
}

export async function updateWorkerHeartbeat(authPath?: string): Promise<void> {
  await ensureBusinessBootstrap();

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("whatsapp_sessions")
    .update({
      last_seen_at: new Date().toISOString(),
      auth_path: authPath,
      updated_at: new Date().toISOString(),
    })
    .eq("business_id", getBusinessId())
    .eq("instance_name", getWorkerInstanceName());

  if (error) throw error;
}

export async function enqueueOutbox(
  conversationId: string,
  content: string
): Promise<void> {
  await ensureBusinessBootstrap();

  const businessId = getBusinessId();
  const conversation = await getConversationRowById(conversationId);
  if (!conversation) {
    throw new Error(`Conversation not found for outbox: ${conversationId}`);
  }

  const targetJid =
    asSingleContact(conversation.contact)?.primary_jid ??
    conversation.phone_jid;

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("outbox_messages").insert({
    business_id: businessId,
    conversation_id: conversation.id,
    contact_id: conversation.contact_id,
    phone_jid: targetJid,
    content,
  });

  if (error) throw error;
}

export async function getPendingOutbox(limit = 20): Promise<OutboxItem[]> {
  await ensureBusinessBootstrap();

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("outbox_messages")
    .select("id, conversation_id, contact_id, phone_jid, content, sent, created_at")
    .eq("business_id", getBusinessId())
    .eq("sent", false)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    conversation_id: row.conversation_id,
    contact_id: row.contact_id ?? null,
    phone: row.phone_jid,
    content: row.content,
    sent: row.sent ? 1 : 0,
    created_at: toUnixSeconds(row.created_at) ?? 0,
  }));
}

export async function markOutboxSent(id: string): Promise<void> {
  await ensureBusinessBootstrap();

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("outbox_messages")
    .update({
      sent: true,
      sent_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("business_id", getBusinessId());

  if (error) throw error;
}

export async function requestWhatsappDisconnect(): Promise<void> {
  await ensureBusinessBootstrap();

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("whatsapp_sessions")
    .update({
      desired_action: "disconnect",
      updated_at: new Date().toISOString(),
    })
    .eq("business_id", getBusinessId())
    .eq("instance_name", getWorkerInstanceName());

  if (error) throw error;
}

export async function getRequestedSessionAction(): Promise<string> {
  await ensureBusinessBootstrap();

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("whatsapp_sessions")
    .select("desired_action")
    .eq("business_id", getBusinessId())
    .eq("instance_name", getWorkerInstanceName())
    .single();

  if (error) throw error;
  return data.desired_action ?? "none";
}

export async function clearRequestedSessionAction(): Promise<void> {
  await ensureBusinessBootstrap();

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("whatsapp_sessions")
    .update({
      desired_action: "none",
      updated_at: new Date().toISOString(),
    })
    .eq("business_id", getBusinessId())
    .eq("instance_name", getWorkerInstanceName());

  if (error) throw error;
}

export function derivePhoneNumberFromMessage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  msg: any
): string | null {
  const candidates: unknown[] = [
    msg.key?.participant,
    msg.key?.remoteJid,
    msg.participant,
    msg.message?.messageContextInfo?.participant,
    msg.message?.messageContextInfo?.remoteJid,
    msg.message?.contactMessage?.vcard,
    msg.message?.contactsArrayMessage?.displayName,
    msg?.sender?.id,
    msg?.sender?.phoneNumber,
  ];

  for (const candidate of candidates) {
    const phone = extractPhoneNumberIfKnown(candidate);
    if (phone) return phone;
  }

  return null;
}

export function getDisplayLabelForConversation(conversation: Conversation): string {
  if (conversation.name?.trim()) return conversation.name.trim();
  const target = conversation.phone || "";
  return getPhoneFromJid(target);
}
