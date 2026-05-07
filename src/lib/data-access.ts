import { randomBytes, randomUUID } from "node:crypto";
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
  retry_count: number;
  created_at: number;
}

export interface BestOutgoingJidResult {
  targetJid: string;
  hasSafeOutgoingJid: boolean;
  reason: "needs_phone_mapping" | "contact_not_found" | "self_target" | "unavailable" | null;
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
  last_inbound_jid: string | null;
  display_name: string | null;
  mode: "AI" | "HUMAN";
  last_message_at: string | null;
  created_at: string;
  contact?: ContactRow | ContactRow[] | null;
}

interface SubscriptionRow {
  plan_code?: string | null;
  status: "trial" | "active" | "past_due" | "canceled" | "pending_payment";
  monthly_message_limit: number | null;
  monthly_ai_reply_limit: number | null;
  current_period_start?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean | null;
  cancelled_at?: string | null;
}

interface UsageRow {
  id: string;
  inbound_messages_count: number;
  ai_replies_count: number;
  human_messages_count: number;
}

export interface UpgradeOption {
  code: string;
  name: string;
  price_monthly: number;
  currency: string;
}

export interface PlanSummary {
  plan_code: string;
  plan_name: string;
  status: SubscriptionRow["status"];
  current_period_start: number | null;
  current_period_end: number | null;
  monthly_message_limit: number | null;
  monthly_ai_reply_limit: number | null;
  inbound_messages_count: number;
  ai_replies_count: number;
  human_messages_count: number;
  conversation_limit: number | null;
  product_limit: number | null;
  users_limit: number | null;
  whatsapp_numbers_limit: number | null;
  price_monthly: number | null;
  currency: string;
  features: Record<string, unknown> | null;
  template_tiers_allowed: string[];
  upgrade_options: UpgradeOption[];
  cancel_at_period_end: boolean;
  cancelled_at: number | null;
}

export type BusinessMemberRole = "owner" | "admin" | "agent";

export interface BusinessMember {
  id: string;
  business_id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  role: BusinessMemberRole;
  status: "active" | "unavailable";
  created_at: number | null;
}

export interface BusinessTeamInviteStatus {
  allowed: boolean;
  used_active: number;
  used_pending: number;
  used_total: number;
  limit: number | null;
  reason?: string;
}

export type BusinessInvitationStatus = "pending" | "accepted" | "expired" | "revoked";

export interface BusinessInvitation {
  id: string;
  business_id: string;
  email: string;
  role: Extract<BusinessMemberRole, "admin" | "agent">;
  token: string;
  status: BusinessInvitationStatus;
  invited_by: string | null;
  accepted_by: string | null;
  expires_at: number | null;
  accepted_at: number | null;
  created_at: number | null;
  updated_at: number | null;
}

export interface TeamCapacitySummary {
  used_active: number;
  used_pending: number;
  used_total: number;
  limit: number | null;
  can_invite: boolean;
  invite_block_reason: string | null;
}

export interface AvailableBusiness {
  business_id: string;
  business_name: string;
  role: BusinessMemberRole;
}

export class TeamManagementError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

// ── Plan hierarchy ───────────────────────────────────────────────────────────
export const PLAN_HIERARCHY: Record<string, number> = {
  starter: 1,
  growth: 2,
  pro: 3,
  premium: 3, // legacy — same rank as pro
};

export const ACTIVE_PLAN_CODES = ["starter", "growth", "pro"] as const;

export function canUpgradeTo(
  currentPlan: string,
  targetPlan: string
): { allowed: boolean; reason?: string } {
  if (!(ACTIVE_PLAN_CODES as readonly string[]).includes(targetPlan)) {
    return { allowed: false, reason: "Plan de destino inválido." };
  }
  if (currentPlan === targetPlan) {
    return { allowed: false, reason: "Ya estás en este plan." };
  }
  const currentRank = PLAN_HIERARCHY[currentPlan] ?? 0;
  const targetRank = PLAN_HIERARCHY[targetPlan] ?? 0;
  if (targetRank <= currentRank) {
    return { allowed: false, reason: "No se permite downgrade de plan." };
  }
  return { allowed: true };
}

export async function getPlanFeatures(
  businessId = getBusinessId()
): Promise<Record<string, unknown>> {
  const supabase = getSupabaseAdminClient();
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan_code")
    .eq("business_id", businessId)
    .maybeSingle();
  if (!sub?.plan_code) return {};
  const { data: plan } = await supabase
    .from("plans")
    .select("features, users_limit")
    .eq("code", sub.plan_code)
    .maybeSingle();
  const features = (plan?.features as Record<string, unknown> | null) ?? {};
  return {
    ...features,
    max_users: typeof plan?.users_limit === "number" ? plan.users_limit : null,
  };
}

export async function canUseTemplate(
  businessId: string,
  templateTier: string
): Promise<{ allowed: boolean; requiredPlan?: string }> {
  const features = await getPlanFeatures(businessId);
  const allowedTiers = Array.isArray(features.template_tiers)
    ? (features.template_tiers as string[])
    : [];
  if (allowedTiers.includes(templateTier)) return { allowed: true };
  if (templateTier === "premium") return { allowed: false, requiredPlan: "pro" };
  return { allowed: false, requiredPlan: "growth" };
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

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function isValidBusinessMemberRole(value: string): value is BusinessMemberRole {
  return value === "owner" || value === "admin" || value === "agent";
}

function isValidInvitationRole(value: string): value is Extract<BusinessMemberRole, "admin" | "agent"> {
  return value === "admin" || value === "agent";
}

function generateInvitationToken(): string {
  return randomBytes(32).toString("base64url");
}

function invitationExpiresAt(days = 7): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function resolveInvitationStatus(status: string, expiresAt: string | null | undefined): BusinessInvitationStatus {
  if (status === "accepted" || status === "revoked" || status === "expired") {
    return status;
  }

  if (expiresAt && Date.parse(expiresAt) <= Date.now()) {
    return "expired";
  }

  return "pending";
}

function assertCanManageTeam(role: BusinessMemberRole): void {
  if (role === "agent") {
    throw new TeamManagementError("No tenés permisos para gestionar el equipo.", 403);
  }
}

async function findAuthUserByEmail(email: string) {
  const supabase = getSupabaseAdminClient();
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });

    if (error) throw error;

    const user = data.users.find((entry) => entry.email?.toLowerCase() === email);
    if (user) return user;

    if (data.users.length < 200) return null;
    page += 1;
  }
}

async function ensureProfileForAuthUser(userId: string, email: string, fullName?: string | null): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const normalizedEmail = normalizeEmail(email);
  const { data: existing, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) throw profileError;

  if (!existing) {
    const { error } = await supabase.from("profiles").insert({
      id: userId,
      email: normalizedEmail,
      full_name: fullName?.trim() || null,
    });
    if (error) throw error;
    return;
  }

  if (existing.email !== normalizedEmail || (!existing.full_name && fullName?.trim())) {
    const { error } = await supabase
      .from("profiles")
      .update({
        email: normalizedEmail,
        full_name: existing.full_name ?? fullName?.trim() ?? null,
      })
      .eq("id", userId);
    if (error) throw error;
  }
}

async function countOwnersForBusiness(businessId: string): Promise<number> {
  const supabase = getSupabaseAdminClient();
  const { count, error } = await supabase
    .from("business_members")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("role", "owner");

  if (error) throw error;
  return count ?? 0;
}

function mapBusinessInvitationRow(row: {
  id: string;
  business_id: string;
  email: string;
  role: string;
  token: string;
  status: string;
  invited_by: string | null;
  accepted_by: string | null;
  expires_at: string | null;
  accepted_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}): BusinessInvitation {
  const effectiveStatus = resolveInvitationStatus(row.status, row.expires_at);
  return {
    id: row.id,
    business_id: row.business_id,
    email: row.email,
    role: row.role as Extract<BusinessMemberRole, "admin" | "agent">,
    token: row.token,
    status: effectiveStatus,
    invited_by: row.invited_by,
    accepted_by: row.accepted_by,
    expires_at: toUnixSeconds(row.expires_at),
    accepted_at: toUnixSeconds(row.accepted_at),
    created_at: toUnixSeconds(row.created_at),
    updated_at: toUnixSeconds(row.updated_at),
  };
}

async function getAgentPhoneNumber(): Promise<string | null> {
  try {
    const state = await getConnectionState();
    return normalizePhoneNumber(state.phone);
  } catch {
    return null;
  }
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

async function ensureBusinessBootstrap(businessId = getBusinessId()): Promise<void> {
  const supabase = getSupabaseAdminClient();
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

async function getCurrentUsage(businessId = getBusinessId()): Promise<UsageRow> {
  await ensureBusinessBootstrap(businessId);
  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("usage_monthly")
    .upsert(
      {
        business_id: businessId,
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
  field: "inbound_messages_count" | "ai_replies_count" | "human_messages_count",
  businessId = getBusinessId()
): Promise<void> {
  const usage = await getCurrentUsage(businessId);
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

async function getContactById(
  contactId: string,
  businessId = getBusinessId()
): Promise<ContactRow | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("id, display_name, phone_number, primary_jid")
    .eq("business_id", businessId)
    .eq("id", contactId)
    .maybeSingle();
  if (error) throw error;
  return data as ContactRow | null;
}

async function getContactIdentities(
  contactId: string,
  businessId = getBusinessId()
): Promise<ContactIdentityRow[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("contact_identities")
    .select("id, contact_id, identity_type, identity_value")
    .eq("business_id", businessId)
    .eq("contact_id", contactId);
  if (error) throw error;
  return (data ?? []) as ContactIdentityRow[];
}

async function upsertContactIdentity(
  contactId: string,
  identityType: IdentityType,
  identityValue: string,
  businessId = getBusinessId()
): Promise<void> {
  const supabase = getSupabaseAdminClient();
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

async function updateContactRow(
  contactId: string,
  patch: Partial<ContactRow>,
  businessId = getBusinessId()
): Promise<ContactRow> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("contacts")
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq("business_id", businessId)
    .eq("id", contactId)
    .select("id, display_name, phone_number, primary_jid")
    .single();
  if (error || !data) throw error ?? new Error("contacts update failed");
  return data as ContactRow;
}

async function promoteContactPhoneIdentity(
  contactId: string,
  phoneNumber: string | null | undefined,
  fallbackDisplayName?: string | null,
  businessId = getBusinessId()
): Promise<ContactRow> {
  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  let contact = await getContactById(contactId, businessId);
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
    contact = await updateContactRow(contactId, patch, businessId);
  }

  if (normalizedPhone) {
    await upsertContactIdentity(contactId, "phone", normalizedPhone, businessId);
    await upsertContactIdentity(contactId, "pn_jid", `${normalizedPhone}@s.whatsapp.net`, businessId);
  }

  return contact;
}

async function createContact(params: {
  displayName?: string | null;
  phoneNumber?: string | null;
  primaryJid?: string | null;
}, businessId = getBusinessId()): Promise<ContactRow> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("contacts")
    .insert({
      business_id: businessId,
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

async function getConversationRowById(
  conversationId: string,
  businessId = getBusinessId()
): Promise<ConversationRow | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("conversations")
    .select(
      "id, business_id, contact_id, phone_jid, last_inbound_jid, display_name, mode, last_message_at, created_at, contact:contacts!conversations_contact_id_fkey(id, display_name, phone_number, primary_jid)"
    )
    .eq("business_id", businessId)
    .eq("id", conversationId)
    .maybeSingle();
  if (error) throw error;
  return data as ConversationRow | null;
}

async function enrichConversationDeliveryState(
  conversation: Conversation,
  businessId = getBusinessId()
): Promise<Conversation> {
  const best = await getBestOutgoingJidForContact(conversation.contact_id, businessId);
  const contact = await getContactById(conversation.contact_id, businessId);
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

export async function getBestOutgoingJidForContact(
  contactId: string,
  businessId = getBusinessId()
): Promise<BestOutgoingJidResult> {
  const contact = await getContactById(contactId, businessId);
  if (!contact) {
    return {
      targetJid: "",
      hasSafeOutgoingJid: false,
      reason: "contact_not_found",
      targetType: "unavailable",
    };
  }

  const identities = await getContactIdentities(contactId, businessId);
  const agentPhoneNumber = await getAgentPhoneNumber();

  if (contact.primary_jid?.endsWith("@s.whatsapp.net")) {
    const targetPhone = extractPhoneFromJid(contact.primary_jid);
    if (agentPhoneNumber && targetPhone === agentPhoneNumber) {
      return {
        targetJid: "",
        hasSafeOutgoingJid: false,
        reason: "self_target",
        targetType: "primary_jid",
      };
    }
    return {
      targetJid: contact.primary_jid,
      hasSafeOutgoingJid: true,
      reason: null,
      targetType: "primary_jid",
    };
  }

  const pnJid = identities.find((item) => item.identity_type === "pn_jid")?.identity_value;
  if (pnJid) {
    const targetPhone = extractPhoneFromJid(pnJid);
    if (agentPhoneNumber && targetPhone === agentPhoneNumber) {
      return {
        targetJid: "",
        hasSafeOutgoingJid: false,
        reason: "self_target",
        targetType: "pn_jid",
      };
    }
    return {
      targetJid: pnJid,
      hasSafeOutgoingJid: true,
      reason: null,
      targetType: "pn_jid",
    };
  }

  const anyPhoneJid = identities.find((item) => item.identity_value.endsWith("@s.whatsapp.net"))?.identity_value;
  if (anyPhoneJid) {
    const targetPhone = extractPhoneFromJid(anyPhoneJid);
    if (agentPhoneNumber && targetPhone === agentPhoneNumber) {
      return {
        targetJid: "",
        hasSafeOutgoingJid: false,
        reason: "self_target",
        targetType: "other_phone_jid",
      };
    }
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
    const targetPhone = extractPhoneFromJid(rawJid);
    if (agentPhoneNumber && targetPhone === agentPhoneNumber) {
      return {
        targetJid: "",
        hasSafeOutgoingJid: false,
        reason: "self_target",
        targetType: "raw_jid",
      };
    }
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
  conversationId: string,
  businessId = getBusinessId()
): Promise<BestOutgoingJidResult> {
  const conversation = await getConversationRowById(conversationId, businessId);
  if (!conversation) {
    return {
      targetJid: "",
      hasSafeOutgoingJid: false,
      reason: "unavailable",
      targetType: "unavailable",
    };
  }

  const agentPhoneNumber = await getAgentPhoneNumber();

  // Priority 1: last_inbound_jid — the JID from which the customer last sent a message.
  // This is the most reliable reply address because it was verified by Baileys as a real
  // active JID (the customer used it to reach us).
  if (conversation.last_inbound_jid) {
    const jid = conversation.last_inbound_jid;
    const phone = extractPhoneFromJid(jid);
    if (agentPhoneNumber && phone && phone === agentPhoneNumber) {
      // Safety: never reply to own number
    } else {
      return {
        targetJid: jid,
        hasSafeOutgoingJid: true,
        reason: null,
        targetType: "raw_jid",
      };
    }
  }

  // Priority 2: Legacy conversations (pre-contacts migration) have contact_id = null.
  // Fall back to phone_jid directly so human replies still work.
  if (!conversation.contact_id) {
    const phoneJid = conversation.phone_jid;
    if (phoneJid?.endsWith("@s.whatsapp.net")) {
      const targetPhone = extractPhoneFromJid(phoneJid);
      if (agentPhoneNumber && targetPhone === agentPhoneNumber) {
        return {
          targetJid: "",
          hasSafeOutgoingJid: false,
          reason: "self_target",
          targetType: "raw_jid",
        };
      }
      return {
        targetJid: phoneJid,
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

  // Priority 3: fall back to contact identity system
  return getBestOutgoingJidForContact(conversation.contact_id, businessId);
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

      let contact = await getContactById(data.contact_id, businessId);
    if (!contact) break;

    if (parsed.jidType === "pn_jid") {
        contact = await updateContactRow(contact.id, {
          phone_number: phoneNumberIfKnown ?? contact.phone_number,
          primary_jid: parsed.normalizedJid,
          display_name: contact.display_name ?? pushName,
        }, businessId);
      } else {
        if (phoneNumberIfKnown) {
          contact = await promoteContactPhoneIdentity(contact.id, phoneNumberIfKnown, pushName, businessId);
        } else {
          const patch: Partial<ContactRow> = {};
          if (!contact.display_name && pushName) patch.display_name = pushName;
          if (!contact.primary_jid && parsed.jidType !== "lid_jid") {
            patch.primary_jid = parsed.normalizedJid;
          }
          if (Object.keys(patch).length > 0) {
            contact = await updateContactRow(contact.id, patch, businessId);
          }
        }
      }

      for (const identity of identityCandidates) {
        await upsertContactIdentity(contact.id, identity.type, identity.value, businessId);
      }
      if (phoneNumberIfKnown) {
        await upsertContactIdentity(contact.id, "phone", phoneNumberIfKnown, businessId);
      }

      const identities = await getContactIdentities(contact.id, businessId);
      const preferred = await getBestOutgoingJidForContact(contact.id, businessId);
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
            }, businessId)
          : await promoteContactPhoneIdentity(
              data.id,
              phoneNumberIfKnown,
              data.display_name ?? pushName,
              businessId
            );
      for (const identity of identityCandidates) {
        await upsertContactIdentity(contact.id, identity.type, identity.value, businessId);
      }
      await upsertContactIdentity(contact.id, "phone", phoneNumberIfKnown, businessId);
      const identities = await getContactIdentities(contact.id, businessId);
      const preferred = await getBestOutgoingJidForContact(contact.id, businessId);
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
      const best = await getBestOutgoingJidForContact(candidate.id, businessId);
      if (
        best.targetType === "pn_jid" ||
        best.targetType === "primary_jid" ||
        best.targetType === "other_phone_jid" ||
        // @lid-only contact: include it if the current message provides a phone
        // so we can promote the @lid contact to a full phone contact instead of
        // creating a duplicate.
        (best.reason === "needs_phone_mapping" && !!phoneNumberIfKnown)
      ) {
        matchingContacts.push(candidate);
      }
    }

    if (matchingContacts.length === 1) {
      let contact = matchingContacts[0]!;
      if (phoneNumberIfKnown) {
        contact = await promoteContactPhoneIdentity(contact.id, phoneNumberIfKnown, pushName, businessId);
      }
      for (const identity of identityCandidates) {
        await upsertContactIdentity(contact.id, identity.type, identity.value, businessId);
      }
      if (phoneNumberIfKnown) {
        await upsertContactIdentity(contact.id, "phone", phoneNumberIfKnown, businessId);
      }
      const identities = await getContactIdentities(contact.id, businessId);
      const preferred = await getBestOutgoingJidForContact(contact.id, businessId);
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
  }, businessId);

  for (const identity of identityCandidates) {
    await upsertContactIdentity(contact.id, identity.type, identity.value, businessId);
  }
  if (phoneNumberIfKnown) {
    await upsertContactIdentity(contact.id, "phone", phoneNumberIfKnown, businessId);
  }
  if (parsed.jidType === "pn_jid") {
    contact = await updateContactRow(contact.id, {
      phone_number: phoneNumberIfKnown,
      primary_jid: parsed.normalizedJid,
    }, businessId);
    if (phoneNumberIfKnown) {
      await upsertContactIdentity(contact.id, "pn_jid", parsed.normalizedJid, businessId);
    }
  } else if (phoneNumberIfKnown) {
    contact = await promoteContactPhoneIdentity(contact.id, phoneNumberIfKnown, pushName, businessId);
  }

  const identities = await getContactIdentities(contact.id, businessId);
  const preferred = await getBestOutgoingJidForContact(contact.id, businessId);
  console.log(`[identity] contact_id=${contact.id}`);
  console.log(`[identity] hasPnJid=${preferred.hasSafeOutgoingJid}`);
  return {
    contact_id: contact.id,
    contact,
    identities,
    preferredOutgoingJid: preferred.targetJid || null,
  };
}

export async function canUseAssistant(businessId = getBusinessId()): Promise<boolean> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("status, monthly_message_limit, monthly_ai_reply_limit")
    .eq("business_id", businessId)
    .single();
  if (error || !data) throw error ?? new Error("subscriptions missing");

  const subscription = data as SubscriptionRow;
  if (!["active", "trial"].includes(subscription.status)) return false;

  const usage = await getCurrentUsage(businessId);
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

export async function recordInboundMessageUsage(businessId = getBusinessId()): Promise<void> {
  await incrementUsage("inbound_messages_count", businessId);
}

export async function recordAiReplyUsage(businessId = getBusinessId()): Promise<void> {
  await incrementUsage("ai_replies_count", businessId);
}

export async function recordHumanMessageUsage(businessId = getBusinessId()): Promise<void> {
  await incrementUsage("human_messages_count", businessId);
}

export async function getPlanSummary(
  businessId = getBusinessId()
): Promise<PlanSummary> {
  await ensureBusinessBootstrap(businessId);
  const supabase = getSupabaseAdminClient();
  const [{ data: subscription, error: subscriptionError }, usage] = await Promise.all([
    supabase
      .from("subscriptions")
      .select(
        "plan_code, status, monthly_message_limit, monthly_ai_reply_limit, current_period_start, current_period_end, cancel_at_period_end, cancelled_at"
      )
      .eq("business_id", businessId)
      .single(),
    getCurrentUsage(businessId),
  ]);

  if (subscriptionError || !subscription) {
    throw subscriptionError ?? new Error("subscriptions missing");
  }

  const { data: plan, error: planError } = await supabase
    .from("plans")
    .select(
      "code, name, price_monthly, currency, conversation_limit, ai_reply_limit, product_limit, users_limit, whatsapp_numbers_limit, features"
    )
    .eq("code", subscription.plan_code ?? "starter")
    .maybeSingle();

  if (planError) throw planError;

  const currentPlanCode = subscription.plan_code ?? "starter";
  const currentRank = PLAN_HIERARCHY[currentPlanCode] ?? 0;
  const featuresObj =
    plan?.features && typeof plan.features === "object"
      ? (plan.features as Record<string, unknown>)
      : null;
  const templateTiersAllowed = Array.isArray(featuresObj?.template_tiers)
    ? (featuresObj!.template_tiers as string[])
    : [];

  // Fetch upgrade options (plans with higher rank)
  const { data: allPlans } = await supabase
    .from("plans")
    .select("code, name, price_monthly, currency")
    .in("code", ["starter", "growth", "pro"]);

  const upgradeOptions: UpgradeOption[] = (allPlans ?? [])
    .filter(
      (p) =>
        (PLAN_HIERARCHY[p.code] ?? 0) > currentRank &&
        typeof p.price_monthly === "number"
    )
    .sort((a, b) => (PLAN_HIERARCHY[a.code] ?? 0) - (PLAN_HIERARCHY[b.code] ?? 0))
    .map((p) => ({
      code: p.code,
      name: p.name,
      price_monthly: p.price_monthly as number,
      currency: p.currency ?? "ARS",
    }));

  return {
    plan_code: currentPlanCode,
    plan_name: plan?.name ?? "Starter",
    status: subscription.status,
    current_period_start: toUnixSeconds(subscription.current_period_start),
    current_period_end: toUnixSeconds(subscription.current_period_end),
    monthly_message_limit: subscription.monthly_message_limit,
    monthly_ai_reply_limit: subscription.monthly_ai_reply_limit,
    inbound_messages_count: usage.inbound_messages_count,
    ai_replies_count: usage.ai_replies_count,
    human_messages_count: usage.human_messages_count,
    conversation_limit: plan?.conversation_limit ?? null,
    product_limit: plan?.product_limit ?? null,
    users_limit: plan?.users_limit ?? null,
    whatsapp_numbers_limit: plan?.whatsapp_numbers_limit ?? null,
    price_monthly: plan?.price_monthly ?? null,
    currency: plan?.currency ?? "ARS",
    features: featuresObj,
    template_tiers_allowed: templateTiersAllowed,
    upgrade_options: upgradeOptions,
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    cancelled_at: toUnixSeconds(subscription.cancelled_at),
  };
}

export async function countBusinessMembers(businessId: string): Promise<number> {
  const supabase = getSupabaseAdminClient();
  const { count, error } = await supabase
    .from("business_members")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId);

  if (error) throw error;
  return count ?? 0;
}

export async function countPendingBusinessInvitations(businessId: string): Promise<number> {
  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const { count, error } = await supabase
    .from("business_invitations")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("status", "pending")
    .gt("expires_at", now);

  if (error) throw error;
  return count ?? 0;
}

export async function canInviteMember(
  businessId: string
): Promise<BusinessTeamInviteStatus> {
  const [usedActive, usedPending, plan] = await Promise.all([
    countBusinessMembers(businessId),
    countPendingBusinessInvitations(businessId),
    getPlanSummary(businessId),
  ]);
  const limit = plan.users_limit;
  const usedTotal = usedActive + usedPending;

  if (typeof limit !== "number") {
    return {
      allowed: true,
      used_active: usedActive,
      used_pending: usedPending,
      used_total: usedTotal,
      limit: null,
    };
  }

  if (usedTotal >= limit) {
    return {
      allowed: false,
      used_active: usedActive,
      used_pending: usedPending,
      used_total: usedTotal,
      limit,
      reason: "Alcanzaste el límite de usuarios de tu plan.",
    };
  }

  return {
    allowed: true,
    used_active: usedActive,
    used_pending: usedPending,
    used_total: usedTotal,
    limit,
  };
}

export async function getBusinessMembers(businessId: string): Promise<BusinessMember[]> {
  const supabase = getSupabaseAdminClient();
  const { data: members, error } = await supabase
    .from("business_members")
    .select("id, business_id, user_id, role, created_at")
    .eq("business_id", businessId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  const memberRows = (members ?? []) as Array<{
    id: string;
    business_id: string;
    user_id: string;
    role: BusinessMemberRole;
    created_at: string | null;
  }>;

  if (memberRows.length === 0) return [];

  const userIds = memberRows.map((member) => member.user_id);
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .in("id", userIds);

  if (profilesError) throw profilesError;

  const profilesByUserId = new Map(
    (profiles ?? []).map((profile) => [
      profile.id,
      {
        email: profile.email,
        full_name: profile.full_name,
      },
    ])
  );

  const authUsers = new Map<string, { status: BusinessMember["status"] }>();
  await Promise.all(
    userIds.map(async (userId) => {
      const { data } = await supabase.auth.admin.getUserById(userId);
      authUsers.set(userId, { status: data.user ? "active" : "unavailable" });
    })
  );

  return memberRows.map((member) => {
    const profile = profilesByUserId.get(member.user_id);
    return {
      id: member.id,
      business_id: member.business_id,
      user_id: member.user_id,
      email: profile?.email ?? "",
      full_name: profile?.full_name ?? null,
      role: member.role,
      status: authUsers.get(member.user_id)?.status ?? "unavailable",
      created_at: toUnixSeconds(member.created_at),
    };
  });
}

export async function listBusinessInvitations(businessId: string): Promise<BusinessInvitation[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("business_invitations")
    .select(
      "id, business_id, email, role, token, status, invited_by, accepted_by, expires_at, accepted_at, created_at, updated_at"
    )
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;

  return (data ?? []).map((row) =>
    mapBusinessInvitationRow(
      row as {
        id: string;
        business_id: string;
        email: string;
        role: string;
        token: string;
        status: string;
        invited_by: string | null;
        accepted_by: string | null;
        expires_at: string | null;
        accepted_at: string | null;
        created_at: string | null;
        updated_at: string | null;
      }
    )
  );
}

export async function getBusinessInvitationByToken(token: string): Promise<BusinessInvitation | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("business_invitations")
    .select(
      "id, business_id, email, role, token, status, invited_by, accepted_by, expires_at, accepted_at, created_at, updated_at"
    )
    .eq("token", token)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapBusinessInvitationRow(
    data as {
      id: string;
      business_id: string;
      email: string;
      role: string;
      token: string;
      status: string;
      invited_by: string | null;
      accepted_by: string | null;
      expires_at: string | null;
      accepted_at: string | null;
      created_at: string | null;
      updated_at: string | null;
    }
  );
}

export async function createBusinessInvitation(
  businessId: string,
  invitedByUserId: string,
  actorRole: BusinessMemberRole,
  email: string,
  role: Extract<BusinessMemberRole, "admin" | "agent">
): Promise<BusinessInvitation> {
  assertCanManageTeam(actorRole);

  if (!isValidInvitationRole(role)) {
    throw new TeamManagementError("Rol inválido.", 400);
  }

  if (actorRole === "admin" && role !== "agent") {
    throw new TeamManagementError("Un admin solo puede invitar agentes.", 403);
  }

  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    throw new TeamManagementError("Ingresá un email válido.", 400);
  }

  const inviteStatus = await canInviteMember(businessId);
  if (!inviteStatus.allowed) {
    throw new TeamManagementError(
      inviteStatus.reason ?? "No se puede invitar otro usuario.",
      409
    );
  }

  const supabase = getSupabaseAdminClient();
  const [{ data: matchingProfiles, error: profilesError }, { data: existingInvite, error: inviteError }] =
    await Promise.all([
      supabase.from("profiles").select("id").eq("email", normalizedEmail),
      supabase
        .from("business_invitations")
        .select(
          "id, business_id, email, role, token, status, invited_by, accepted_by, expires_at, accepted_at, created_at, updated_at"
        )
        .eq("business_id", businessId)
        .eq("email", normalizedEmail)
        .eq("status", "pending")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  if (profilesError) throw profilesError;
  if (inviteError) throw inviteError;

  const matchingProfileIds = (matchingProfiles ?? []).map((profile) => profile.id);
  if (matchingProfileIds.length > 0) {
    const { data: existingMember, error: existingMemberError } = await supabase
      .from("business_members")
      .select("id")
      .eq("business_id", businessId)
      .in("user_id", matchingProfileIds)
      .limit(1)
      .maybeSingle();

    if (existingMemberError) throw existingMemberError;
    if (existingMember?.id) {
      throw new TeamManagementError("Ese usuario ya forma parte del negocio.", 409);
    }
  }

  if (existingInvite) {
    return mapBusinessInvitationRow(
      existingInvite as {
        id: string;
        business_id: string;
        email: string;
        role: string;
        token: string;
        status: string;
        invited_by: string | null;
        accepted_by: string | null;
        expires_at: string | null;
        accepted_at: string | null;
        created_at: string | null;
        updated_at: string | null;
      }
    );
  }

  const { data: createdInvite, error: createError } = await supabase
    .from("business_invitations")
    .insert({
      business_id: businessId,
      email: normalizedEmail,
      role,
      token: generateInvitationToken(),
      status: "pending",
      invited_by: invitedByUserId,
      expires_at: invitationExpiresAt(),
      updated_at: new Date().toISOString(),
    })
    .select(
      "id, business_id, email, role, token, status, invited_by, accepted_by, expires_at, accepted_at, created_at, updated_at"
    )
    .single();

  if (createError || !createdInvite) throw createError ?? new TeamManagementError("No se pudo crear la invitación.", 500);

  return mapBusinessInvitationRow(
    createdInvite as {
      id: string;
      business_id: string;
      email: string;
      role: string;
      token: string;
      status: string;
      invited_by: string | null;
      accepted_by: string | null;
      expires_at: string | null;
      accepted_at: string | null;
      created_at: string | null;
      updated_at: string | null;
    }
  );
}

export async function revokeBusinessInvitation(
  businessId: string,
  actorRole: BusinessMemberRole,
  invitationId: string
): Promise<void> {
  assertCanManageTeam(actorRole);
  const supabase = getSupabaseAdminClient();
  const { data: invitation, error } = await supabase
    .from("business_invitations")
    .select("id, status")
    .eq("id", invitationId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (error) throw error;
  if (!invitation?.id) throw new TeamManagementError("Invitación no encontrada.", 404);
  if (invitation.status !== "pending") {
    throw new TeamManagementError("Solo podés revocar invitaciones pendientes.", 409);
  }

  const { error: updateError } = await supabase
    .from("business_invitations")
    .update({
      status: "revoked",
      updated_at: new Date().toISOString(),
    })
    .eq("id", invitationId)
    .eq("business_id", businessId);

  if (updateError) throw updateError;
}

export async function acceptBusinessInvitation(
  token: string,
  userId: string,
  userEmail: string
): Promise<{ businessId: string; alreadyMember: boolean }> {
  const normalizedToken = token.trim();
  if (!normalizedToken) throw new TeamManagementError("Invitación inválida.", 400);

  const invitation = await getBusinessInvitationByToken(normalizedToken);
  if (!invitation) {
    throw new TeamManagementError("La invitación no existe o ya no está disponible.", 404);
  }

  if (invitation.status === "revoked") {
    throw new TeamManagementError("Esta invitación fue revocada.", 409);
  }
  if (invitation.status === "accepted") {
    throw new TeamManagementError("Esta invitación ya fue utilizada.", 409);
  }
  if (invitation.status === "expired") {
    throw new TeamManagementError("Esta invitación venció.", 409);
  }

  const normalizedEmail = normalizeEmail(userEmail);
  if (normalizedEmail !== invitation.email) {
    throw new TeamManagementError("Esta invitación fue enviada a otro email.", 403);
  }

  const supabase = getSupabaseAdminClient();
  const { data: existingMember, error: memberError } = await supabase
    .from("business_members")
    .select("id")
    .eq("business_id", invitation.business_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (memberError) throw memberError;

  let alreadyMember = false;
  if (!existingMember?.id) {
    const { error: insertError } = await supabase.from("business_members").insert({
      business_id: invitation.business_id,
      user_id: userId,
      role: invitation.role,
    });
    if (insertError) throw insertError;
  } else {
    alreadyMember = true;
  }

  const { error: updateError } = await supabase
    .from("business_invitations")
    .update({
      status: "accepted",
      accepted_by: userId,
      accepted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", invitation.id);

  if (updateError) throw updateError;

  return {
    businessId: invitation.business_id,
    alreadyMember,
  };
}

export async function updateBusinessMemberRole(
  businessId: string,
  actorRole: BusinessMemberRole,
  memberId: string,
  nextRole: BusinessMemberRole
): Promise<BusinessMember> {
  assertCanManageTeam(actorRole);

  if (!isValidBusinessMemberRole(nextRole)) {
    throw new TeamManagementError("Rol inválido.", 400);
  }

  const supabase = getSupabaseAdminClient();
  const { data: member, error } = await supabase
    .from("business_members")
    .select("id, business_id, user_id, role")
    .eq("id", memberId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (error) throw error;
  if (!member?.id) {
    throw new TeamManagementError("Miembro no encontrado.", 404);
  }

  const currentRole = member.role as BusinessMemberRole;
  if (currentRole === nextRole) {
    const members = await getBusinessMembers(businessId);
    const unchanged = members.find((entry) => entry.id === memberId);
    if (!unchanged) throw new TeamManagementError("Miembro no encontrado.", 404);
    return unchanged;
  }

  if (actorRole === "admin" && (currentRole === "owner" || nextRole === "owner")) {
    throw new TeamManagementError("Un admin no puede modificar owners.", 403);
  }

  if (currentRole === "owner" && nextRole !== "owner") {
    const ownersCount = await countOwnersForBusiness(businessId);
    if (ownersCount <= 1) {
      throw new TeamManagementError("No podés dejar al negocio sin owners.", 409);
    }
  }

  const { error: updateError } = await supabase
    .from("business_members")
    .update({ role: nextRole })
    .eq("id", memberId)
    .eq("business_id", businessId);

  if (updateError) throw updateError;

  const members = await getBusinessMembers(businessId);
  const updated = members.find((entry) => entry.id === memberId);
  if (!updated) throw new TeamManagementError("Miembro no encontrado.", 404);
  return updated;
}

export async function removeBusinessMember(
  businessId: string,
  actorRole: BusinessMemberRole,
  memberId: string
): Promise<void> {
  assertCanManageTeam(actorRole);

  const supabase = getSupabaseAdminClient();
  const { data: member, error } = await supabase
    .from("business_members")
    .select("id, business_id, role")
    .eq("id", memberId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (error) throw error;
  if (!member?.id) {
    throw new TeamManagementError("Miembro no encontrado.", 404);
  }

  const targetRole = member.role as BusinessMemberRole;

  if (actorRole === "admin" && targetRole === "owner") {
    throw new TeamManagementError("Un admin no puede remover owners.", 403);
  }

  if (targetRole === "owner") {
    const ownersCount = await countOwnersForBusiness(businessId);
    if (ownersCount <= 1) {
      throw new TeamManagementError("No podés eliminar al último owner.", 409);
    }
  }

  const { error: deleteError } = await supabase
    .from("business_members")
    .delete()
    .eq("id", memberId)
    .eq("business_id", businessId);

  if (deleteError) throw deleteError;
}

export async function listAvailableBusinessesForUser(userId: string): Promise<AvailableBusiness[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("business_members")
    .select("business_id, role, businesses!inner(display_name)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    business_id: row.business_id,
    role: row.role as BusinessMemberRole,
    business_name:
      typeof row.businesses === "object" && row.businesses && "display_name" in row.businesses
        ? String(row.businesses.display_name ?? "")
        : "",
  }));
}

export async function userBelongsToBusiness(userId: string, businessId: string): Promise<boolean> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("business_members")
    .select("id")
    .eq("user_id", userId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data?.id);
}

export async function cancelPlanAtPeriodEnd(businessId: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data: sub, error: fetchError } = await supabase
    .from("subscriptions")
    .select("status")
    .eq("business_id", businessId)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!sub?.status || (sub.status !== "active" && sub.status !== "trial")) {
    throw new TeamManagementError("Solo podés cancelar un plan activo.", 409);
  }

  const { error } = await supabase
    .from("subscriptions")
    .update({
      cancel_at_period_end: true,
      cancelled_at: now,
      updated_at: now,
    })
    .eq("business_id", businessId);

  if (error) throw error;
}

export async function reactivatePlan(businessId: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("subscriptions")
    .update({
      cancel_at_period_end: false,
      cancelled_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("business_id", businessId);

  if (error) throw error;
}

export async function getBusinessSubscriptionStatus(
  businessId: string
): Promise<SubscriptionRow["status"] | "none"> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("status")
    .eq("business_id", businessId)
    .maybeSingle();
  if (error) throw error;
  return (data?.status as SubscriptionRow["status"]) ?? "none";
}

export async function getBusinessProfile(businessId = getBusinessId()): Promise<BusinessProfile> {
  await ensureBusinessBootstrap(businessId);
  const supabase = getSupabaseAdminClient();
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
}, businessId = getBusinessId()): Promise<void> {
  const supabase = getSupabaseAdminClient();
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
  businessId?: string;
  /**
   * JID from which a customer message arrived. When set, updates
   * conversations.last_inbound_jid so replies always go back to the right chat.
   * Must be undefined/null for outgoing (fromMe=true) messages so we don't
   * accidentally overwrite the real inbound JID with a sender's own JID.
   */
  inboundJid?: string | null;
}): Promise<Conversation> {
  const resolved = await resolveContactIdentity({
    businessId: input.businessId,
    rawJid: input.rawJid,
    pushName: input.pushName,
    phoneNumberIfKnown: input.phoneNumberIfKnown,
  });

  const supabase = getSupabaseAdminClient();
  const businessId = input.businessId ?? getBusinessId();
  const normalizedInboundJid = input.inboundJid
    ? normalizeWhatsAppJid(input.inboundJid)
    : null;

  // Use the raw inbound JID as the canonical phone_jid when it's a real phone address.
  // Only fall back to best.targetJid when there's no direct inbound JID available
  // (e.g., outbox / dashboard sends).
  const best = await getBestOutgoingJidForContact(resolved.contact_id, businessId);
  const preferredPhoneJid = normalizedInboundJid || best.targetJid || normalizeWhatsAppJid(input.rawJid);

  const { data: existing, error } = await supabase
    .from("conversations")
    .select(
      "id, business_id, contact_id, phone_jid, last_inbound_jid, display_name, mode, last_message_at, created_at, contact:contacts!conversations_contact_id_fkey(id, display_name, phone_number, primary_jid)"
    )
    .eq("business_id", businessId)
    .eq("contact_id", resolved.contact_id)
    .maybeSingle();
  if (error) throw error;

  if (existing) {
    // Only upgrade phone_jid if the incoming JID is a real @s.whatsapp.net address
    // (avoids overwriting a correct phone with an @lid-derived fake phone).
    const nextPhoneJid =
      normalizedInboundJid?.endsWith("@s.whatsapp.net")
        ? normalizedInboundJid
        : (existing.phone_jid?.endsWith("@s.whatsapp.net") ? existing.phone_jid : preferredPhoneJid);

    const patch: Record<string, unknown> = {
      phone_jid: nextPhoneJid,
      display_name: resolved.contact.display_name ?? input.pushName ?? existing.display_name,
      updated_at: new Date().toISOString(),
    };
    if (normalizedInboundJid) patch.last_inbound_jid = normalizedInboundJid;

    await supabase.from("conversations").update(patch).eq("id", existing.id);
    console.log(`[conversation] reused=${existing.id} last_inbound_jid=${normalizedInboundJid ?? "(unchanged)"}`);
    return enrichConversationDeliveryState(mapConversationRow({
      ...(existing as ConversationRow),
      phone_jid: nextPhoneJid,
      last_inbound_jid: normalizedInboundJid ?? existing.last_inbound_jid,
      display_name:
        resolved.contact.display_name ?? input.pushName ?? existing.display_name,
      contact: resolved.contact,
    }), businessId);
  }

  // Fallback: find a legacy conversation (contact_id IS NULL) by phone_jid
  // and backfill its contact_id instead of creating a new conversation.
  const legacyJids = [...new Set(
    [preferredPhoneJid, normalizeWhatsAppJid(input.rawJid)].filter(Boolean)
  )];
  for (const jid of legacyJids) {
    const { data: legacy } = await supabase
      .from("conversations")
      .select(
        "id, business_id, contact_id, phone_jid, last_inbound_jid, display_name, mode, last_message_at, created_at, contact:contacts!conversations_contact_id_fkey(id, display_name, phone_number, primary_jid)"
      )
      .eq("business_id", businessId)
      .eq("phone_jid", jid)
      .is("contact_id", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (legacy) {
      const nextPhoneJid = preferredPhoneJid || legacy.phone_jid;
      const legacyPatch: Record<string, unknown> = {
        contact_id: resolved.contact_id,
        phone_jid: nextPhoneJid,
        display_name: resolved.contact.display_name ?? input.pushName ?? legacy.display_name,
        updated_at: new Date().toISOString(),
      };
      if (normalizedInboundJid) legacyPatch.last_inbound_jid = normalizedInboundJid;

      const { error: backfillErr } = await supabase
        .from("conversations")
        .update(legacyPatch)
        .eq("id", legacy.id);

      if (!backfillErr) {
        console.log(`[conversation] backfilled legacy=${legacy.id} contact_id=${resolved.contact_id}`);
        console.log(`[wa/identity] prevented duplicate conversation — merged into legacy=${legacy.id}`);
        return enrichConversationDeliveryState(mapConversationRow({
          ...(legacy as ConversationRow),
          contact_id: resolved.contact_id,
          phone_jid: nextPhoneJid,
          last_inbound_jid: normalizedInboundJid ?? legacy.last_inbound_jid,
          display_name: resolved.contact.display_name ?? input.pushName ?? legacy.display_name,
          contact: resolved.contact,
        }), businessId);
      }
      console.warn(`[conversation] backfill failed for legacy=${legacy.id}, will create new`);
    }
  }

  const { data: created, error: createError } = await supabase
    .from("conversations")
    .insert({
      business_id: businessId,
      contact_id: resolved.contact_id,
      phone_jid: preferredPhoneJid,
      last_inbound_jid: normalizedInboundJid ?? null,
      display_name: resolved.contact.display_name ?? input.pushName ?? null,
      mode: "AI",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select(
      "id, business_id, contact_id, phone_jid, last_inbound_jid, display_name, mode, last_message_at, created_at, contact:contacts!conversations_contact_id_fkey(id, display_name, phone_number, primary_jid)"
    )
    .single();
  if (createError || !created) throw createError ?? new Error("conversation insert failed");
  console.log(`[conversation] created=${created.id}`);
  return enrichConversationDeliveryState(mapConversationRow(created as ConversationRow), businessId);
}

export async function getConversationById(
  conversationId: string,
  businessId = getBusinessId()
): Promise<Conversation | null> {
  const row = await getConversationRowById(conversationId, businessId);
  return row ? enrichConversationDeliveryState(mapConversationRow(row), businessId) : null;
}

export async function setMode(
  conversationId: string,
  mode: "AI" | "HUMAN",
  businessId = getBusinessId()
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("conversations").update({
    mode,
    updated_at: new Date().toISOString(),
  }).eq("business_id", businessId).eq("id", conversationId);
  if (error) throw error;
}

export async function listConversations(
  businessId = getBusinessId()
): Promise<ConversationWithPreview[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("conversations")
    .select(
      "id, business_id, contact_id, phone_jid, last_inbound_jid, display_name, mode, last_message_at, created_at, contact:contacts!conversations_contact_id_fkey(id, display_name, phone_number, primary_jid)"
    )
    .eq("business_id", businessId)
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
      const conversation = await enrichConversationDeliveryState(mapConversationRow(row), businessId);
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

export async function deleteConversation(
  conversationId: string,
  businessId = getBusinessId()
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("conversations")
    .delete()
    .eq("business_id", businessId)
    .eq("id", conversationId);
  if (error) throw error;
}

export async function insertMessage(
  conversationId: string,
  role: "user" | "assistant" | "human",
  content: string,
  externalMessageId?: string | null,
  businessId = getBusinessId()
): Promise<Message> {
  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("messages")
    .insert({
      business_id: businessId,
      conversation_id: conversationId,
      role,
      content,
      external_message_id: externalMessageId ?? null,
      created_at: now,
    })
    .select("id, conversation_id, role, content, created_at")
    .single();
  if (error || !data) throw error ?? new Error("message insert failed");

  const { error: conversationError } = await supabase.from("conversations").update({
    last_message_at: now,
    updated_at: now,
  }).eq("business_id", businessId).eq("id", conversationId);
  if (conversationError) throw conversationError;

  return mapMessageRow(data);
}

export async function isExternalMessageDuplicate(externalMessageId: string): Promise<boolean> {
  const supabase = getSupabaseAdminClient();
  const [msgResult, outboxResult] = await Promise.all([
    supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("business_id", getBusinessId())
      .eq("external_message_id", externalMessageId),
    supabase
      .from("outbox_messages")
      .select("id", { count: "exact", head: true })
      .eq("business_id", getBusinessId())
      .eq("external_message_id", externalMessageId),
  ]);
  return (msgResult.count ?? 0) > 0 || (outboxResult.count ?? 0) > 0;
}

export async function setMessageExternalId(
  messageId: string,
  externalMessageId: string
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  await supabase
    .from("messages")
    .update({ external_message_id: externalMessageId })
    .eq("business_id", getBusinessId())
    .eq("id", messageId);
}

export async function setOutboxExternalId(
  outboxId: string,
  externalMessageId: string
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  await supabase
    .from("outbox_messages")
    .update({ external_message_id: externalMessageId })
    .eq("business_id", getBusinessId())
    .eq("id", outboxId);
}

export async function getMessages(
  conversationId: string,
  limit = 50,
  businessId = getBusinessId()
): Promise<Message[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("messages")
    .select("id, conversation_id, role, content, created_at")
    .eq("business_id", businessId)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(mapMessageRow);
}

export async function getRecentHistory(
  conversationId: string,
  limit = 20,
  businessId = getBusinessId()
): Promise<Message[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("messages")
    .select("id, conversation_id, role, content, created_at")
    .eq("business_id", businessId)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(mapMessageRow).reverse();
}

export async function getConnectionState(
  businessId = getBusinessId()
): Promise<ConnectionState> {
  await ensureBusinessBootstrap(businessId);
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("whatsapp_sessions")
    .select("status, qr_string, phone, auth_path, last_seen_at, updated_at")
    .eq("business_id", businessId)
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
}, businessId = getBusinessId()): Promise<void> {
  const current = await getConnectionState(businessId).catch(() => ({
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
    .eq("business_id", businessId)
    .eq("instance_name", getWorkerInstanceName());
  if (error) throw error;
}

export async function updateWorkerHeartbeat(
  authPath?: string,
  businessId = getBusinessId()
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("whatsapp_sessions")
    .update({
      last_seen_at: new Date().toISOString(),
      auth_path: authPath,
      updated_at: new Date().toISOString(),
    })
    .eq("business_id", businessId)
    .eq("instance_name", getWorkerInstanceName());
  if (error) throw error;
}

export async function enqueueOutbox(
  conversationId: string,
  content: string,
  businessId = getBusinessId()
): Promise<void> {
  const conversation = await getConversationRowById(conversationId, businessId);
  if (!conversation) throw new Error("Conversación no encontrada");

  const best = await getBestOutgoingJidForConversation(conversationId, businessId);
  if (!best.targetJid) {
    throw new Error("No hay JID telefónico disponible para enviar de forma segura.");
  }

  console.log(`[dashboard-send] conversation_id=${conversationId}`);
  console.log(`[dashboard-send] contact_id=${conversation.contact_id}`);
  console.log(`[dashboard-send] selected targetJid=${best.targetJid}`);
  console.log(`[dashboard-send] target type=${best.targetType}`);

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("outbox_messages").insert({
    business_id: businessId,
    conversation_id: conversationId,
    contact_id: conversation.contact_id,
    target_jid: best.targetJid,
    content,
  });
  if (error) throw error;
}

export async function linkPhoneToContact(
  contactId: string,
  phoneNumber: string,
  businessId = getBusinessId()
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

  const agentPhoneNumber = await getAgentPhoneNumber();
  if (agentPhoneNumber && normalizedPhone === agentPhoneNumber) {
    throw new Error("No podés asociar el mismo número del agente a un contacto.");
  }

  const pnJid = `${normalizedPhone}@s.whatsapp.net`;
  let contact = await getContactById(contactId, businessId);
  if (!contact) {
    throw new Error("Contacto no encontrado.");
  }

  contact = await updateContactRow(contactId, {
    phone_number: normalizedPhone,
    primary_jid: pnJid,
  }, businessId);

  const supabase = getSupabaseAdminClient();
  const { error: deletePhoneIdentityError } = await supabase
    .from("contact_identities")
    .delete()
    .eq("business_id", businessId)
    .eq("contact_id", contactId)
    .eq("identity_type", "phone")
    .neq("identity_value", normalizedPhone);
  if (deletePhoneIdentityError) throw deletePhoneIdentityError;

  const { error: deletePnIdentityError } = await supabase
    .from("contact_identities")
    .delete()
    .eq("business_id", businessId)
    .eq("contact_id", contactId)
    .eq("identity_type", "pn_jid")
    .neq("identity_value", pnJid);
  if (deletePnIdentityError) throw deletePnIdentityError;

  await upsertContactIdentity(contactId, "phone", normalizedPhone, businessId);
  await upsertContactIdentity(contactId, "pn_jid", pnJid, businessId);

  await supabase
    .from("conversations")
    .update({
      phone_jid: pnJid,
      updated_at: new Date().toISOString(),
    })
    .eq("business_id", businessId)
    .eq("contact_id", contactId);

  await supabase
    .from("outbox_messages")
    .update({
      target_jid: pnJid,
      error: null,
    })
    .eq("business_id", businessId)
    .eq("contact_id", contactId)
    .eq("sent", false);

  const identities = await getContactIdentities(contactId, businessId);
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
    .select("id, conversation_id, contact_id, target_jid, content, sent, retry_count, created_at")
    .eq("business_id", getBusinessId())
    .eq("sent", false)
    .lt("retry_count", 3)
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
    retry_count: row.retry_count ?? 0,
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

export async function setOutboxError(
  id: string,
  errorMessage: string,
  newRetryCount?: number
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const patch: Record<string, unknown> = { error: errorMessage, sent: false };
  if (typeof newRetryCount === "number") {
    patch.retry_count = newRetryCount;
  }
  const { error } = await supabase
    .from("outbox_messages")
    .update(patch)
    .eq("business_id", getBusinessId())
    .eq("id", id);
  if (error) throw error;
}

export async function requestWhatsappDisconnect(
  businessId = getBusinessId()
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("whatsapp_sessions")
    .update({
      desired_action: "disconnect",
      updated_at: new Date().toISOString(),
    })
    .eq("business_id", businessId)
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
