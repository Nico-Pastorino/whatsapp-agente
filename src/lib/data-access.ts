import { randomUUID } from "node:crypto";
import { getBusinessId, getWorkerInstanceName } from "./env";
import { getSupabaseAdminClient } from "./supabase";
import {
  extractPhoneFromJid,
  extractPhoneNumberIfKnown,
  getJidType,
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
  contact_id: string;
  phone: string;
  phone_number: string | null;
  primary_jid: string | null;
  name: string | null;
  mode: "AI" | "HUMAN";
  outgoing_jid: string | null;
  safe_outgoing_jid: string | null;
  has_safe_outgoing_jid: boolean;
  needs_phone_mapping: boolean;
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
  contact_id: string;
  target_jid: string;
  content: string;
  sent: number;
  created_at: number;
}

export interface BestOutgoingJidResult {
  targetJid: string;
  hasSafeOutgoingJid: boolean;
  reason: "needs_phone_mapping" | "contact_not_found" | "unavailable" | null;
  targetType:
    | "pn_jid"
    | "primary_jid"
    | "other_phone_jid"
    | "lid_jid"
    | "raw_jid"
    | "unavailable";
}

interface ContactRow {
  id: string;
  display_name: string | null;
  phone_number: string | null;
  primary_jid: string | null;
}

interface ContactIdentityRow {
  id: string;
  contact_id: string;
  identity_type: IdentityType;
  identity_value: string;
}

interface ConversationRow {
  id: string;
  business_id: string;
  contact_id: string;
  phone_jid: string | null;
  display_name: string | null;
  mode: "AI" | "HUMAN";
  last_message_at: string | null;
  created_at: string;
  contact?: ContactRow | ContactRow[] | null;
}

interface SubscriptionRow {
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

export interface ResolveContactIdentityParams {
  businessId?: string;
  rawJid: string;
  pushName?: string;
  phoneNumberIfKnown?: string | null;
}

export interface ResolvedContactIdentity {
  contact_id: string;
  contact: ContactRow;
  identities: ContactIdentityRow[];
  preferredOutgoingJid: string | null;
}

function toUnixSeconds(value: string | null | undefined): number | null {
  if (!value) return null;
  const ts = Date.parse(value);
  return Number.isNaN(ts) ? null : Math.floor(ts / 1000);
}

function monthStartIso(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

function defaultSlugFromBusinessId(businessId: string): string {
  return `business-${businessId.slice(0, 8)}`;
}

function normalizePhoneNumber(value: string | null | undefined): string | null {
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
    phone: row.phone_jid ?? contact?.primary_jid ?? "",
    phone_number: contact?.phone_number ?? null,
    primary_jid: contact?.primary_jid ?? null,
    name: contact?.display_name ?? row.display_name,
    mode: row.mode,
    outgoing_jid: null,
    safe_outgoing_jid: null,
    has_safe_outgoing_jid: false,
    needs_phone_mapping: false,
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

function buildIdentityCandidates(rawJid: string): Array<{ type: IdentityType; value: string }> {
  const parsed = parseWhatsAppIdentity(rawJid);
  const candidates: Array<{ type: IdentityType; value: string }> = [
    { type: parsed.jidType, value: parsed.normalizedJid },
  ];

  if (parsed.rawJid !== parsed.normalizedJid) {
    candidates.push({ type: "raw_jid", value: parsed.rawJid });
  }

  const phone = extractPhoneFromJid(parsed.normalizedJid);
  if (phone) {
    candidates.push({ type: "phone", value: phone });
  }

  return candidates.filter(
    (candidate, index, all) =>
      all.findIndex((other) => other.value === candidate.value) === index
  );
}

async function ensureBusinessBootstrap(): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const businessId = getBusinessId();
  const instanceName = getWorkerInstanceName();
  const now = new Date().toISOString();

  await supabase.from("businesses").upsert(
    {
      id: businessId,
      slug: defaultSlugFromBusinessId(businessId),
      display_name: "",
      updated_at: now,
    },
    { onConflict: "id", ignoreDuplicates: true }
  );

  await supabase.from("business_settings").upsert(
    {
      business_id: businessId,
      description: "",
      extra: "",
      system_prompt_override: "",
      updated_at: now,
    },
    { onConflict: "business_id", ignoreDuplicates: true }
  );

  await supabase.from("subscriptions").upsert(
    {
      business_id: businessId,
      plan_code: "starter",
      status: "active",
      updated_at: now,
    },
    { onConflict: "business_id", ignoreDuplicates: true }
  );

  await supabase.from("whatsapp_sessions").upsert(
    {
      business_id: businessId,
      instance_name: instanceName,
      status: "disconnected",
      desired_action: "none",
      updated_at: now,
    },
    { onConflict: "business_id,instance_name", ignoreDuplicates: true }
  );
}

async function getCurrentUsage(): Promise<UsageRow> {
  await ensureBusinessBootstrap();
  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("usage_monthly")
    .upsert(
      {
        business_id: getBusinessId(),
        month_start: monthStartIso(),
        updated_at: now,
      },
      { onConflict: "business_id,month_start", ignoreDuplicates: false }
    )
    .select("id, inbound_messages_count, ai_replies_count, human_messages_count")
    .single();

  if (error || !data) throw error ?? new Error("usage_monthly missing");
  return data as UsageRow;
}

async function incrementUsage(
  field: "inbound_messages_count" | "ai_replies_count" | "human_messages_count"
): Promise<void> {
  const usage = await getCurrentUsage();
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("usage_monthly")
    .update({
      [field]: usage[field] + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", usage.id);
  if (error) throw error;
}

async function getContactById(contactId: string): Promise<ContactRow | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("id, display_name, phone_number, primary_jid")
    .eq("business_id", getBusinessId())
    .eq("id", contactId)
    .maybeSingle();
  if (error) throw error;
  return data as ContactRow | null;
}

async function getContactIdentities(contactId: string): Promise<ContactIdentityRow[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("contact_identities")
    .select("id, contact_id, identity_type, identity_value")
    .eq("business_id", getBusinessId())
    .eq("contact_id", contactId);
  if (error) throw error;
  return (data ?? []) as ContactIdentityRow[];
}

async function upsertContactIdentity(
  contactId: string,
  identityType: IdentityType,
  identityValue: string
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("contact_identities").upsert(
    {
      business_id: getBusinessId(),
      contact_id: contactId,
      identity_type: identityType,
      identity_value: identityValue,
    },
    { onConflict: "business_id,identity_value", ignoreDuplicates: true }
  );
  if (error) throw error;
}

async function updateContactRow(contactId: string, patch: Partial<ContactRow>): Promise<ContactRow> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("contacts")
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq("business_id", getBusinessId())
    .eq("id", contactId)
    .select("id, display_name, phone_number, primary_jid")
    .single();
  if (error || !data) throw error ?? new Error("contacts update failed");
  return data as ContactRow;
}

async function promoteContactPhoneIdentity(
  contactId: string,
  phoneNumber: string | null | undefined,
  fallbackDisplayName?: string | null
): Promise<ContactRow> {
  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  let contact = await getContactById(contactId);
  if (!contact) {
    throw new Error("Contacto no encontrado.");
  }

  const patch: Partial<ContactRow> = {};
  if (fallbackDisplayName && !contact.display_name) {
    patch.display_name = fallbackDisplayName;
  }

  if (normalizedPhone) {
    patch.phone_number = normalizedPhone;
    patch.primary_jid = `${normalizedPhone}@s.whatsapp.net`;
  }

  if (Object.keys(patch).length > 0) {
    contact = await updateContactRow(contactId, patch);
  }

  if (normalizedPhone) {
    await upsertContactIdentity(contactId, "phone", normalizedPhone);
    await upsertContactIdentity(contactId, "pn_jid", `${normalizedPhone}@s.whatsapp.net`);
  }

  return contact;
}

async function createContact(params: {
  displayName?: string | null;
  phoneNumber?: string | null;
  primaryJid?: string | null;
}): Promise<ContactRow> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("contacts")
    .insert({
      business_id: getBusinessId(),
      display_name: params.displayName ?? null,
      phone_number: normalizePhoneNumber(params.phoneNumber),
      primary_jid: params.primaryJid ?? null,
      updated_at: new Date().toISOString(),
    })
    .select("id, display_name, phone_number, primary_jid")
    .single();
  if (error || !data) throw error ?? new Error("contacts insert failed");
  return data as ContactRow;
}

async function getConversationRowById(conversationId: string): Promise<ConversationRow | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("conversations")
    .select(
      "id, business_id, contact_id, phone_jid, display_name, mode, last_message_at, created_at, contact:contacts!conversations_contact_id_fkey(id, display_name, phone_number, primary_jid)"
    )
    .eq("business_id", getBusinessId())
    .eq("id", conversationId)
    .maybeSingle();
  if (error) throw error;
  return data as ConversationRow | null;
}

async function enrichConversationDeliveryState(conversation: Conversation): Promise<Conversation> {
  const best = await getBestOutgoingJidForContact(conversation.contact_id);
  const contact = await getContactById(conversation.contact_id);
  return {
    ...conversation,
    phone_number: contact?.phone_number ?? conversation.phone_number,
    primary_jid: contact?.primary_jid ?? conversation.primary_jid,
    outgoing_jid: best.targetJid || null,
    safe_outgoing_jid: best.targetJid || null,
    has_safe_outgoing_jid: best.hasSafeOutgoingJid,
    needs_phone_mapping: best.reason === "needs_phone_mapping",
  };
}

export async function getBestOutgoingJidForContact(contactId: string): Promise<BestOutgoingJidResult> {
  const contact = await getContactById(contactId);
  if (!contact) {
    return {
      targetJid: "",
      hasSafeOutgoingJid: false,
      reason: "contact_not_found",
      targetType: "unavailable",
    };
  }

  const identities = await getContactIdentities(contactId);

  const pnJid = identities.find((item) => item.identity_type === "pn_jid")?.identity_value;
  if (pnJid) {
    return {
      targetJid: pnJid,
      hasSafeOutgoingJid: true,
      reason: null,
      targetType: "pn_jid",
    };
  }

  if (contact.primary_jid?.endsWith("@s.whatsapp.net")) {
    return {
      targetJid: contact.primary_jid,
      hasSafeOutgoingJid: true,
      reason: null,
      targetType: "primary_jid",
    };
  }

  const anyPhoneJid = identities.find((item) => item.identity_value.endsWith("@s.whatsapp.net"))?.identity_value;
  if (anyPhoneJid) {
    return {
      targetJid: anyPhoneJid,
      hasSafeOutgoingJid: true,
      reason: null,
      targetType: "other_phone_jid",
    };
  }

  const lidJid = identities.find((item) => item.identity_type === "lid_jid")?.identity_value;
  if (lidJid) {
    return {
      targetJid: "",
      hasSafeOutgoingJid: false,
      reason: "needs_phone_mapping",
      targetType: "lid_jid",
    };
  }

  const rawJid = identities.find((item) => item.identity_type === "raw_jid")?.identity_value;
  if (rawJid?.endsWith("@s.whatsapp.net")) {
    return {
      targetJid: rawJid,
      hasSafeOutgoingJid: true,
      reason: null,
      targetType: "raw_jid",
    };
  }

  return {
    targetJid: "",
    hasSafeOutgoingJid: false,
    reason: "unavailable",
    targetType: "unavailable",
  };
}

export async function getBestOutgoingJidForConversation(
  conversationId: string
): Promise<BestOutgoingJidResult> {
  const conversation = await getConversationRowById(conversationId);
  if (!conversation) {
    return {
      targetJid: "",
      hasSafeOutgoingJid: false,
      reason: "unavailable",
      targetType: "unavailable",
    };
  }
  return getBestOutgoingJidForContact(conversation.contact_id);
}

export async function resolveContactIdentity(
  params: ResolveContactIdentityParams
): Promise<ResolvedContactIdentity> {
  await ensureBusinessBootstrap();

  const supabase = getSupabaseAdminClient();
  const businessId = params.businessId ?? getBusinessId();
  const parsed = parseWhatsAppIdentity(params.rawJid);
  const pushName = params.pushName?.trim() || null;
  const phoneNumberIfKnown =
    normalizePhoneNumber(params.phoneNumberIfKnown) ?? parsed.phoneNumber;

  console.log(`[identity] rawJid=${params.rawJid}`);
  console.log(`[identity] pushName=${pushName ?? ""}`);
  console.log(`[identity] jidType=${parsed.jidType}`);
  console.log(`[identity] possiblePhoneNumber=${phoneNumberIfKnown ?? ""}`);
  console.log(
    `[identity] possiblePnJid=${phoneNumberIfKnown ? `${phoneNumberIfKnown}@s.whatsapp.net` : ""}`
  );

  const identityCandidates = buildIdentityCandidates(params.rawJid);

  for (const candidate of identityCandidates) {
    const { data, error } = await supabase
      .from("contact_identities")
      .select("id, contact_id, identity_type, identity_value")
      .eq("business_id", businessId)
      .eq("identity_value", candidate.value)
      .maybeSingle();
    if (error) throw error;
    if (!data) continue;

    let contact = await getContactById(data.contact_id);
    if (!contact) break;

    if (parsed.jidType === "pn_jid") {
      contact = await updateContactRow(contact.id, {
        phone_number: phoneNumberIfKnown ?? contact.phone_number,
        primary_jid: parsed.normalizedJid,
        display_name: contact.display_name ?? pushName,
      });
    } else {
      if (phoneNumberIfKnown) {
        contact = await promoteContactPhoneIdentity(contact.id, phoneNumberIfKnown, pushName);
      } else {
        const patch: Partial<ContactRow> = {};
        if (!contact.display_name && pushName) patch.display_name = pushName;
        if (!contact.primary_jid && parsed.jidType !== "lid_jid") {
          patch.primary_jid = parsed.normalizedJid;
        }
        if (Object.keys(patch).length > 0) {
          contact = await updateContactRow(contact.id, patch);
        }
      }
    }

    for (const identity of identityCandidates) {
      await upsertContactIdentity(contact.id, identity.type, identity.value);
    }
    if (phoneNumberIfKnown) {
      await upsertContactIdentity(contact.id, "phone", phoneNumberIfKnown);
    }

    const identities = await getContactIdentities(contact.id);
    const preferred = await getBestOutgoingJidForContact(contact.id);
    console.log(`[identity] contact_id=${contact.id}`);
    console.log(`[identity] hasPnJid=${preferred.hasSafeOutgoingJid}`);
    return {
      contact_id: contact.id,
      contact,
      identities,
      preferredOutgoingJid: preferred.targetJid || null,
    };
  }

  if (phoneNumberIfKnown) {
    const { data, error } = await supabase
      .from("contacts")
      .select("id, display_name, phone_number, primary_jid")
      .eq("business_id", businessId)
      .eq("phone_number", phoneNumberIfKnown)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (data) {
      let contact =
        parsed.jidType === "pn_jid"
          ? await updateContactRow(data.id, {
              display_name: data.display_name ?? pushName,
              phone_number: phoneNumberIfKnown,
              primary_jid: parsed.normalizedJid,
            })
          : await promoteContactPhoneIdentity(
              data.id,
              phoneNumberIfKnown,
              data.display_name ?? pushName
            );
      for (const identity of identityCandidates) {
        await upsertContactIdentity(contact.id, identity.type, identity.value);
      }
      await upsertContactIdentity(contact.id, "phone", phoneNumberIfKnown);
      const identities = await getContactIdentities(contact.id);
      const preferred = await getBestOutgoingJidForContact(contact.id);
      console.log(`[identity] contact_id=${contact.id}`);
      console.log(`[identity] hasPnJid=${preferred.hasSafeOutgoingJid}`);
      return {
        contact_id: contact.id,
        contact,
        identities,
        preferredOutgoingJid: preferred.targetJid || null,
      };
    }
  }

  if (pushName) {
    const { data, error } = await supabase
      .from("contacts")
      .select("id, display_name, phone_number, primary_jid")
      .eq("business_id", businessId)
      .eq("display_name", pushName);
    if (error) throw error;

    const candidates = (data ?? []) as ContactRow[];
    const matchingContacts: ContactRow[] = [];
    for (const candidate of candidates) {
      const best = await getBestOutgoingJidForContact(candidate.id);
      if (best.targetType === "pn_jid" || best.targetType === "primary_jid" || best.targetType === "other_phone_jid") {
        matchingContacts.push(candidate);
      }
    }

    if (matchingContacts.length === 1) {
      let contact = matchingContacts[0]!;
      if (phoneNumberIfKnown) {
        contact = await promoteContactPhoneIdentity(contact.id, phoneNumberIfKnown, pushName);
      }
      for (const identity of identityCandidates) {
        await upsertContactIdentity(contact.id, identity.type, identity.value);
      }
      if (phoneNumberIfKnown) {
        await upsertContactIdentity(contact.id, "phone", phoneNumberIfKnown);
      }
      const identities = await getContactIdentities(contact.id);
      const preferred = await getBestOutgoingJidForContact(contact.id);
      console.log(`[identity] contact_id=${contact.id}`);
      console.log(`[identity] hasPnJid=${preferred.hasSafeOutgoingJid}`);
      return {
        contact_id: contact.id,
        contact,
        identities,
        preferredOutgoingJid: preferred.targetJid || null,
      };
    }
  }

  let contact = await createContact({
    displayName: pushName,
    phoneNumber: phoneNumberIfKnown,
    primaryJid:
      parsed.jidType === "pn_jid"
        ? parsed.normalizedJid
        : phoneNumberIfKnown
          ? `${phoneNumberIfKnown}@s.whatsapp.net`
          : null,
  });

  for (const identity of identityCandidates) {
    await upsertContactIdentity(contact.id, identity.type, identity.value);
  }
  if (phoneNumberIfKnown) {
    await upsertContactIdentity(contact.id, "phone", phoneNumberIfKnown);
  }
  if (parsed.jidType === "pn_jid") {
    contact = await updateContactRow(contact.id, {
      phone_number: phoneNumberIfKnown,
      primary_jid: parsed.normalizedJid,
    });
    if (phoneNumberIfKnown) {
      await upsertContactIdentity(contact.id, "pn_jid", parsed.normalizedJid);
    }
  } else if (phoneNumberIfKnown) {
    contact = await promoteContactPhoneIdentity(contact.id, phoneNumberIfKnown, pushName);
  }

  const identities = await getContactIdentities(contact.id);
  const preferred = await getBestOutgoingJidForContact(contact.id);
  console.log(`[identity] contact_id=${contact.id}`);
  console.log(`[identity] hasPnJid=${preferred.hasSafeOutgoingJid}`);
  return {
    contact_id: contact.id,
    contact,
    identities,
    preferredOutgoingJid: preferred.targetJid || null,
  };
}

export async function canUseAssistant(): Promise<boolean> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("status, monthly_message_limit, monthly_ai_reply_limit")
    .eq("business_id", getBusinessId())
    .single();
  if (error || !data) throw error ?? new Error("subscriptions missing");

  const subscription = data as SubscriptionRow;
  if (!["active", "trial"].includes(subscription.status)) return false;

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
  if (businessError || settingsError || productsError) {
    throw businessError ?? settingsError ?? productsError;
  }

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
    updated_at: Math.max(
      toUnixSeconds(business?.updated_at) ?? 0,
      toUnixSeconds(settings?.updated_at) ?? 0
    ),
  };
}

export async function setBusinessProfile(patch: {
  name: string;
  description: string;
  products: ProductItem[];
  extra: string;
}): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const businessId = getBusinessId();
  const now = new Date().toISOString();

  await supabase.from("businesses").update({
    display_name: patch.name,
    updated_at: now,
  }).eq("id", businessId);

  await supabase.from("business_settings").update({
    description: patch.description,
    extra: patch.extra,
    updated_at: now,
  }).eq("business_id", businessId);

  await supabase.from("products").delete().eq("business_id", businessId);

  if (patch.products.length > 0) {
    const { error } = await supabase.from("products").insert(
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
    if (error) throw error;
  }
}

export async function getOrCreateConversation(input: {
  rawJid: string;
  pushName?: string;
  phoneNumberIfKnown?: string | null;
}): Promise<Conversation> {
  const resolved = await resolveContactIdentity({
    rawJid: input.rawJid,
    pushName: input.pushName,
    phoneNumberIfKnown: input.phoneNumberIfKnown,
  });

  const supabase = getSupabaseAdminClient();
  const businessId = getBusinessId();
  const best = await getBestOutgoingJidForContact(resolved.contact_id);
  const preferredPhoneJid = best.targetJid || normalizeWhatsAppJid(input.rawJid);

  const { data: existing, error } = await supabase
    .from("conversations")
    .select(
      "id, business_id, contact_id, phone_jid, display_name, mode, last_message_at, created_at, contact:contacts!conversations_contact_id_fkey(id, display_name, phone_number, primary_jid)"
    )
    .eq("business_id", businessId)
    .eq("contact_id", resolved.contact_id)
    .maybeSingle();
  if (error) throw error;

  if (existing) {
    const nextPhoneJid =
      preferredPhoneJid.endsWith("@s.whatsapp.net") || !existing.phone_jid
        ? preferredPhoneJid
        : existing.phone_jid;
    await supabase.from("conversations").update({
      phone_jid: nextPhoneJid,
      display_name: resolved.contact.display_name ?? input.pushName ?? existing.display_name,
      updated_at: new Date().toISOString(),
    }).eq("id", existing.id);
    console.log(`[conversation] reused=${existing.id}`);
    return enrichConversationDeliveryState(mapConversationRow({
      ...(existing as ConversationRow),
      phone_jid: nextPhoneJid,
      display_name:
        resolved.contact.display_name ?? input.pushName ?? existing.display_name,
      contact: resolved.contact,
    }));
  }

  const { data: created, error: createError } = await supabase
    .from("conversations")
    .insert({
      business_id: businessId,
      contact_id: resolved.contact_id,
      phone_jid: preferredPhoneJid,
      display_name: resolved.contact.display_name ?? input.pushName ?? null,
      mode: "AI",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select(
      "id, business_id, contact_id, phone_jid, display_name, mode, last_message_at, created_at, contact:contacts!conversations_contact_id_fkey(id, display_name, phone_number, primary_jid)"
    )
    .single();
  if (createError || !created) throw createError ?? new Error("conversation insert failed");
  console.log(`[conversation] created=${created.id}`);
  return enrichConversationDeliveryState(mapConversationRow(created as ConversationRow));
}

export async function getConversationById(conversationId: string): Promise<Conversation | null> {
  const row = await getConversationRowById(conversationId);
  return row ? enrichConversationDeliveryState(mapConversationRow(row)) : null;
}

export async function setMode(
  conversationId: string,
  mode: "AI" | "HUMAN"
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("conversations").update({
    mode,
    updated_at: new Date().toISOString(),
  }).eq("business_id", getBusinessId()).eq("id", conversationId);
  if (error) throw error;
}

export async function listConversations(): Promise<ConversationWithPreview[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("conversations")
    .select(
      "id, business_id, contact_id, phone_jid, display_name, mode, last_message_at, created_at, contact:contacts!conversations_contact_id_fkey(id, display_name, phone_number, primary_jid)"
    )
    .eq("business_id", getBusinessId())
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;

  const grouped = new Map<string, ConversationRow[]>();
  for (const row of (data ?? []) as ConversationRow[]) {
    grouped.set(row.contact_id, [...(grouped.get(row.contact_id) ?? []), row]);
  }

  const selected = Array.from(grouped.values()).map((rows) =>
    [...rows].sort((a, b) => {
      const aPhone = a.phone_jid?.endsWith("@s.whatsapp.net") ? 1 : 0;
      const bPhone = b.phone_jid?.endsWith("@s.whatsapp.net") ? 1 : 0;
      if (bPhone !== aPhone) return bPhone - aPhone;
      if (a.mode !== b.mode) {
        if (a.mode === "HUMAN") return -1;
        if (b.mode === "HUMAN") return 1;
      }
      const aTime = toUnixSeconds(a.last_message_at) ?? toUnixSeconds(a.created_at) ?? 0;
      const bTime = toUnixSeconds(b.last_message_at) ?? toUnixSeconds(b.created_at) ?? 0;
      return bTime - aTime;
    })[0]!
  );

  const conversations = await Promise.all(
    selected.map(async (row) => {
      const { data: preview, error: previewError } = await supabase
        .from("messages")
        .select("content")
        .eq("conversation_id", row.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (previewError) throw previewError;
      const conversation = await enrichConversationDeliveryState(mapConversationRow(row));
      return {
        ...conversation,
        last_message_preview: preview?.content ?? null,
      };
    })
  );

  return conversations.sort((a, b) => {
    const aTime = a.last_message_at ?? a.created_at;
    const bTime = b.last_message_at ?? b.created_at;
    return bTime - aTime;
  });
}

export async function deleteConversation(conversationId: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("conversations")
    .delete()
    .eq("business_id", getBusinessId())
    .eq("id", conversationId);
  if (error) throw error;
}

export async function insertMessage(
  conversationId: string,
  role: "user" | "assistant" | "human",
  content: string
): Promise<Message> {
  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("messages")
    .insert({
      business_id: getBusinessId(),
      conversation_id: conversationId,
      role,
      content,
      created_at: now,
    })
    .select("id, conversation_id, role, content, created_at")
    .single();
  if (error || !data) throw error ?? new Error("message insert failed");

  const { error: conversationError } = await supabase.from("conversations").update({
    last_message_at: now,
    updated_at: now,
  }).eq("business_id", getBusinessId()).eq("id", conversationId);
  if (conversationError) throw conversationError;

  return mapMessageRow(data);
}

export async function getMessages(conversationId: string, limit = 50): Promise<Message[]> {
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

export async function getRecentHistory(conversationId: string, limit = 20): Promise<Message[]> {
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
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("whatsapp_sessions")
    .select("status, qr_string, phone, auth_path, last_seen_at, updated_at")
    .eq("business_id", getBusinessId())
    .eq("instance_name", getWorkerInstanceName())
    .single();
  if (error || !data) throw error ?? new Error("whatsapp_sessions missing");

  const lastSeenAt = toUnixSeconds(data.last_seen_at);
  return {
    id: 1,
    status: data.status,
    qr_string: data.qr_string,
    phone: data.phone,
    auth_path: data.auth_path,
    last_seen_at: lastSeenAt,
    updated_at: toUnixSeconds(data.updated_at) ?? 0,
    worker_online: typeof lastSeenAt === "number" ? Math.floor(Date.now() / 1000) - lastSeenAt <= 15 : false,
  };
}

export async function setConnectionState(patch: {
  status: "disconnected" | "qr" | "connecting" | "connected";
  qr_string?: string | null;
  phone?: string | null;
  auth_path?: string | null;
}): Promise<void> {
  const current = await getConnectionState().catch(() => ({
    qr_string: null,
    phone: null,
    auth_path: null,
  }));
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("whatsapp_sessions")
    .update({
      status: patch.status,
      qr_string: patch.qr_string !== undefined ? patch.qr_string : current.qr_string,
      phone: patch.phone !== undefined ? patch.phone : current.phone,
      auth_path: patch.auth_path !== undefined ? patch.auth_path : current.auth_path,
      updated_at: new Date().toISOString(),
    })
    .eq("business_id", getBusinessId())
    .eq("instance_name", getWorkerInstanceName());
  if (error) throw error;
}

export async function updateWorkerHeartbeat(authPath?: string): Promise<void> {
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

export async function enqueueOutbox(conversationId: string, content: string): Promise<void> {
  const conversation = await getConversationRowById(conversationId);
  if (!conversation) throw new Error("Conversación no encontrada");

  const best = await getBestOutgoingJidForConversation(conversationId);
  if (!best.targetJid) {
    throw new Error("No hay JID telefónico disponible para enviar de forma segura.");
  }

  console.log(`[dashboard-send] conversation_id=${conversationId}`);
  console.log(`[dashboard-send] contact_id=${conversation.contact_id}`);
  console.log(`[dashboard-send] selected targetJid=${best.targetJid}`);
  console.log(`[dashboard-send] target type=${best.targetType}`);

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("outbox_messages").insert({
    business_id: getBusinessId(),
    conversation_id: conversationId,
    contact_id: conversation.contact_id,
    target_jid: best.targetJid,
    content,
  });
  if (error) throw error;
}

export async function linkPhoneToContact(
  contactId: string,
  phoneNumber: string
): Promise<{
  contact: ContactRow;
  identities: ContactIdentityRow[];
  safe_outgoing_jid: string;
  has_safe_outgoing_jid: true;
  needsPhoneMapping: boolean;
}> {
  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  if (!normalizedPhone) {
    throw new Error("Número de WhatsApp inválido.");
  }

  const pnJid = `${normalizedPhone}@s.whatsapp.net`;
  let contact = await getContactById(contactId);
  if (!contact) {
    throw new Error("Contacto no encontrado.");
  }

  contact = await updateContactRow(contactId, {
    phone_number: normalizedPhone,
    primary_jid: pnJid,
  });

  await upsertContactIdentity(contactId, "phone", normalizedPhone);
  await upsertContactIdentity(contactId, "pn_jid", pnJid);

  const supabase = getSupabaseAdminClient();
  await supabase
    .from("conversations")
    .update({
      phone_jid: pnJid,
      updated_at: new Date().toISOString(),
    })
    .eq("business_id", getBusinessId())
    .eq("contact_id", contactId);

  const identities = await getContactIdentities(contactId);
  return {
    contact,
    identities,
    safe_outgoing_jid: pnJid,
    has_safe_outgoing_jid: true,
    needsPhoneMapping: false,
  };
}

export async function getPendingOutbox(limit = 20): Promise<OutboxItem[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("outbox_messages")
    .select("id, conversation_id, contact_id, target_jid, content, sent, created_at")
    .eq("business_id", getBusinessId())
    .eq("sent", false)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    conversation_id: row.conversation_id,
    contact_id: row.contact_id,
    target_jid: row.target_jid,
    content: row.content,
    sent: row.sent ? 1 : 0,
    created_at: toUnixSeconds(row.created_at) ?? 0,
  }));
}

export async function markOutboxSent(id: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("outbox_messages")
    .update({
      sent: true,
      sent_at: new Date().toISOString(),
      error: null,
    })
    .eq("business_id", getBusinessId())
    .eq("id", id);
  if (error) throw error;
}

export async function setOutboxError(id: string, errorMessage: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("outbox_messages")
    .update({
      error: errorMessage,
      sent: false,
    })
    .eq("business_id", getBusinessId())
    .eq("id", id);
  if (error) throw error;
}

export async function requestWhatsappDisconnect(): Promise<void> {
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
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("whatsapp_sessions")
    .select("desired_action")
    .eq("business_id", getBusinessId())
    .eq("instance_name", getWorkerInstanceName())
    .single();
  if (error || !data) throw error ?? new Error("desired_action missing");
  return data.desired_action ?? "none";
}

export async function clearRequestedSessionAction(): Promise<void> {
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
    msg.key?.id,
    msg.participant,
    msg.sender,
    msg.senderPn,
    msg.verifiedBizName,
    msg.message?.senderKeyDistributionMessage?.groupId,
    msg.message?.messageContextInfo?.participant,
    msg.message?.messageContextInfo?.remoteJid,
    msg.message?.messageContextInfo?.deviceListMetadata?.senderKeyHash,
    msg.message?.messageContextInfo?.stanzaId,
    msg.message?.extendedTextMessage?.contextInfo?.participant,
    msg.message?.extendedTextMessage?.contextInfo?.remoteJid,
    msg.message?.contactMessage?.vcard,
    msg.message?.contactsArrayMessage?.contacts?.[0]?.vcard,
    msg.message?.documentWithCaptionMessage?.message?.extendedTextMessage?.contextInfo?.participant,
    msg.message?.documentWithCaptionMessage?.message?.extendedTextMessage?.contextInfo?.remoteJid,
    msg.pushName,
  ];

  for (const candidate of candidates) {
    const phone = extractPhoneNumberIfKnown(candidate);
    if (phone) return phone;
  }
  return null;
}

export function getDisplayLabelForConversation(conversation: Conversation): string {
  return conversation.name?.trim() || extractPhoneFromJid(conversation.phone) || conversation.phone;
}
