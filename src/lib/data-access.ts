import { randomBytes, randomUUID } from "node:crypto";
import { getBusinessId, getWorkerInstanceName } from "./env";
import { getSupabaseAdminClient } from "./supabase";
import {
  getAvailableSlots,
  getZonedParts,
  zonedWallTimeToUTC,
  parseHHMM,
  minutesToHHMM,
  type DayException,
  type BusyRange,
  type TimeInterval,
} from "./availability";
import {
  extractPhoneFromJid,
  extractPhoneNumberIfKnown,
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
  quick_replies: string[];
  /** Base de conocimiento (FAQ, políticas, info que la IA usa para responder). */
  knowledge_base: string;
  /** Si la IA puede tomar turnos / citas en la conversación. */
  booking_enabled: boolean;
  /** Reglas de agenda: horarios, duración, servicios, cómo confirmar. */
  booking_config: string;
  /** Avisos internos al encargado activados. */
  notify_enabled: boolean;
  /** Número del encargado (solo dígitos, formato internacional). */
  notify_phone: string;
  /** Eventos a avisar: new_appointment, human_handoff, etc. */
  notify_events: string[];
  /** Tono de respuesta del asistente (código corto: cercano | profesional | divertido | directo | ''). */
  response_tone: string;
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
  needs_attention: boolean;
  hot_lead: boolean;
  last_message_at: number | null;
  created_at: number;
  assigned_to: string | null;
  human_last_activity: number | null;
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
  sent_by_user_id: string | null;
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
  /** Número solicitado para vincular por código (null si no se pidió). */
  pairing_phone: string | null;
  /** Código de vinculación de 8 caracteres generado por WhatsApp. */
  pairing_code: string | null;
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
  needs_attention: boolean;
  hot_lead?: boolean;
  last_message_at: string | null;
  created_at: string;
  assigned_to: string | null;
  human_last_activity: string | null;
  contact?: ContactRow | ContactRow[] | null;
}

interface SubscriptionRow {
  plan_code?: string | null;
  status: "trial" | "active" | "past_due" | "canceled" | "pending_payment";
  monthly_message_limit: number | null;
  monthly_ai_reply_limit: number | null;
  current_period_start?: string | null;
  current_period_end?: string | null;
  trial_started_at?: string | null;
  trial_ends_at?: string | null;
  paid_at?: string | null;
  subscription_started_at?: string | null;
  subscription_ends_at?: string | null;
  mercado_pago_preapproval_id?: string | null;
  mercado_pago_preapproval_status?: string | null;
  mercado_pago_payment_id?: string | null;
  mercado_pago_preference_id?: string | null;
  cancel_at_period_end?: boolean | null;
  cancelled_at?: string | null;
}

interface UsageRow {
  id: string;
  inbound_messages_count: number;
  ai_replies_count: number;
  human_messages_count: number;
}

type CachedValue<T> = {
  value: T;
  expiresAt: number;
};

const SUBSCRIPTION_CACHE_TTL_MS = 60_000;
// Reducido a 60s: el worker tiene su propio cache en memoria. Si el usuario
// cambia notify_enabled/notify_phone en el dashboard, el worker debe reflejarlo
// rápidamente sin tener que esperar 5 minutos.
const BUSINESS_PROFILE_CACHE_TTL_MS = 60_000;
const SUBSCRIPTION_SELECT =
  "plan_code, status, monthly_message_limit, monthly_ai_reply_limit, current_period_start, current_period_end, trial_started_at, trial_ends_at, paid_at, subscription_started_at, subscription_ends_at, mercado_pago_preapproval_id, mercado_pago_preapproval_status, cancel_at_period_end, cancelled_at";
const subscriptionCache = new Map<string, CachedValue<SubscriptionRow | null>>();
const businessProfileCache = new Map<string, CachedValue<BusinessProfile>>();

function getCachedValue<T>(cache: Map<string, CachedValue<T>>, key: string): T | null {
  const cached = cache.get(key);
  if (!cached || cached.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return cached.value;
}

function setCachedValue<T>(
  cache: Map<string, CachedValue<T>>,
  key: string,
  value: T,
  ttlMs: number
): void {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
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
  access_status: AccountAccessStatus;
  can_use_app: boolean;
  access_reason: string;
  days_left_trial: number | null;
  trial_started_at: number | null;
  trial_ends_at: number | null;
  paid_at: number | null;
  subscription_started_at: number | null;
  subscription_ends_at: number | null;
  mercado_pago_preapproval_id: string | null;
  mercado_pago_preapproval_status: string | null;
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
  downgrade_options: UpgradeOption[];
  cancel_at_period_end: boolean;
  cancelled_at: number | null;
  product_count: number;
}

export type AccountAccessStatus = "trial" | "active" | "pending_payment" | "past_due" | "canceled" | "blocked" | "none";

export interface AccountAccessResult {
  canUseApp: boolean;
  status: AccountAccessStatus;
  subscriptionStatus: SubscriptionRow["status"] | "none";
  daysLeftTrial: number | null;
  reason: string;
  planCode: string | null;
  trialEndsAt: number | null;
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
  updated_at: number | null;
  last_active_at: number | null;
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
  revoked_at: number | null;
  resent_at: number | null;
  created_at: number | null;
  updated_at: number | null;
}

export interface AuditLog {
  id: string;
  business_id: string;
  actor_user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: number | null;
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

export function canDowngradeTo(
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
  if (targetRank >= currentRank) {
    return { allowed: false, reason: "El plan elegido no es un downgrade." };
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
  return { allowed: false, requiredPlan: "pro" };
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

function normalizePhoneNumber(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value.replace(/[^\d]/g, "");
  return cleaned.length >= 7 ? cleaned : null;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
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

export async function recordAuditLog(input: {
  businessId: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("audit_logs").insert({
    business_id: input.businessId,
    actor_user_id: input.actorUserId,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    metadata: input.metadata ?? {},
  });
  if (error) {
    console.warn("[audit] could not write audit log:", error.message);
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
  revoked_at?: string | null;
  resent_at?: string | null;
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
    revoked_at: toUnixSeconds(row.revoked_at ?? null),
    resent_at: toUnixSeconds(row.resent_at ?? null),
    created_at: toUnixSeconds(row.created_at),
    updated_at: toUnixSeconds(row.updated_at),
  };
}

const BUSINESS_INVITATION_SELECT =
  "id, business_id, email, role, token, status, invited_by, accepted_by, expires_at, accepted_at, created_at, updated_at";

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
    needs_attention: row.needs_attention ?? false,
    hot_lead: row.hot_lead ?? false,
    last_message_at: toUnixSeconds(row.last_message_at),
    created_at: toUnixSeconds(row.created_at) ?? 0,
    assigned_to: row.assigned_to ?? null,
    human_last_activity: toUnixSeconds(row.human_last_activity),
  };
}

function mapMessageRow(row: {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "human";
  content: string;
  created_at: string;
  sent_by_user_id?: string | null;
}): Message {
  return {
    id: row.id,
    conversation_id: row.conversation_id,
    role: row.role,
    content: row.content,
    created_at: toUnixSeconds(row.created_at) ?? 0,
    sent_by_user_id: row.sent_by_user_id ?? null,
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

async function getCurrentUsage(businessId = getBusinessId()): Promise<UsageRow> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("usage_monthly")
    .select("id, inbound_messages_count, ai_replies_count, human_messages_count")
    .eq("business_id", businessId)
    .eq("month_start", monthStartIso())
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    return {
      id: "",
      inbound_messages_count: 0,
      ai_replies_count: 0,
      human_messages_count: 0,
    };
  }
  return data as UsageRow;
}

async function ensureCurrentUsageRow(businessId = getBusinessId()): Promise<UsageRow> {
  const existing = await getCurrentUsage(businessId);
  if (existing.id) return existing;

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

async function getCachedSubscription(
  businessId = getBusinessId()
): Promise<SubscriptionRow | null> {
  const cached = getCachedValue(subscriptionCache, businessId);
  if (cached !== null) return cached;

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select(SUBSCRIPTION_SELECT)
    .eq("business_id", businessId)
    .maybeSingle();

  if (error) throw error;
  const subscription = (data as SubscriptionRow | null) ?? null;
  setCachedValue(subscriptionCache, businessId, subscription, SUBSCRIPTION_CACHE_TTL_MS);
  console.log(`[subscription/cache] loaded business_id=${businessId}`);
  return subscription;
}

function evaluateAccountAccess(
  subscription: SubscriptionRow | null
): AccountAccessResult {
  if (!subscription) {
    return {
      canUseApp: false,
      status: "none",
      subscriptionStatus: "none",
      daysLeftTrial: null,
      reason: "missing_subscription",
      planCode: null,
      trialEndsAt: null,
    };
  }

  const status = subscription.status;
  const trialEndsAt = toUnixSeconds(subscription.trial_ends_at);

  if (status === "active") {
    return {
      canUseApp: true,
      status: "active",
      subscriptionStatus: status,
      daysLeftTrial: null,
      reason: "active_subscription",
      planCode: subscription.plan_code ?? null,
      trialEndsAt,
    };
  }

  if (status === "trial") {
    if (!subscription.trial_ends_at) {
      return {
        canUseApp: false,
        status: "blocked",
        subscriptionStatus: status,
        daysLeftTrial: null,
        reason: "missing_trial_end",
        planCode: subscription.plan_code ?? null,
        trialEndsAt,
      };
    }

    const now = Date.now();
    const trialEndMs = new Date(subscription.trial_ends_at).getTime();
    if (Number.isFinite(trialEndMs) && trialEndMs >= now) {
      return {
        canUseApp: true,
        status: "trial",
        subscriptionStatus: status,
        daysLeftTrial: Math.max(0, Math.ceil((trialEndMs - now) / (24 * 60 * 60 * 1000))),
        reason: "trial_active",
        planCode: subscription.plan_code ?? null,
        trialEndsAt,
      };
    }

    return {
      canUseApp: false,
      status: "blocked",
      subscriptionStatus: status,
      daysLeftTrial: 0,
      reason: "trial_expired",
      planCode: subscription.plan_code ?? null,
      trialEndsAt,
    };
  }

  return {
    canUseApp: false,
    status,
    subscriptionStatus: status,
    daysLeftTrial: null,
    reason: status,
    planCode: subscription.plan_code ?? null,
    trialEndsAt,
  };
}

async function incrementUsage(
  field: "inbound_messages_count" | "ai_replies_count" | "human_messages_count",
  businessId = getBusinessId()
): Promise<void> {
  const usage = await ensureCurrentUsageRow(businessId);
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("usage_monthly")
    .update({
      [field]: usage[field] + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", usage.id);
  if (error) throw error;
  subscriptionCache.delete(businessId);
  console.log(`[subscription/update] cancel_at_period_end business_id=${businessId}`);
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
  subscriptionCache.delete(businessId);
  console.log(`[subscription/update] reactivated business_id=${businessId}`);
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
      "id, business_id, contact_id, phone_jid, last_inbound_jid, display_name, mode, needs_attention, hot_lead, last_message_at, created_at, assigned_to, human_last_activity, contact:contacts!conversations_contact_id_fkey(id, display_name, phone_number, primary_jid)"
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
      const contact =
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
  const subscription = await getCachedSubscription(businessId);
  if (!subscription) throw new Error("subscriptions missing");

  const access = evaluateAccountAccess(subscription);
  if (!access.canUseApp) return false;

  // Límites efectivos: el override por negocio (subscription.monthly_*) tiene
  // prioridad; si no hay, usamos el del plan (plans.*). Con límites en NULL la IA
  // queda ilimitada (comportamiento actual), pero el enforcement ya está listo.
  let planMsgLimit: number | null = null;
  let planAiLimit: number | null = null;
  try {
    const supabase = getSupabaseAdminClient();
    const { data: plan } = await supabase
      .from("plans")
      .select("conversation_limit, ai_reply_limit")
      .eq("code", subscription.plan_code)
      .maybeSingle();
    planMsgLimit = (plan?.conversation_limit as number | null) ?? null;
    planAiLimit = (plan?.ai_reply_limit as number | null) ?? null;
  } catch {
    // Fail-open: si no podemos leer el plan, no bloqueamos al cliente.
  }

  const msgLimit =
    typeof subscription.monthly_message_limit === "number" ? subscription.monthly_message_limit : planMsgLimit;
  const aiLimit =
    typeof subscription.monthly_ai_reply_limit === "number" ? subscription.monthly_ai_reply_limit : planAiLimit;

  const usage = await getCurrentUsage(businessId);
  if (typeof msgLimit === "number" && usage.inbound_messages_count >= msgLimit) return false;
  if (typeof aiLimit === "number" && usage.ai_replies_count >= aiLimit) return false;
  return true;
}

export async function checkAccountAccess(
  businessId = getBusinessId()
): Promise<AccountAccessResult> {
  return evaluateAccountAccess(await getCachedSubscription(businessId));
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
  const supabase = getSupabaseAdminClient();
  const [subscription, usage, productCount] = await Promise.all([
    getCachedSubscription(businessId),
    getCurrentUsage(businessId),
    countBusinessItems(businessId),
  ]);

  if (!subscription) {
    throw new Error("subscriptions missing");
  }
  const access = evaluateAccountAccess(subscription);

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

  // Fetch upgrade options (plans with higher rank). Incluimos growth para que un
  // usuario en Starter vea Growth ("Más popular") como opción de upgrade.
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

  // Downgrade deshabilitado por decisión de producto (no se baja de plan ni hay
  // prorrateo). Devolvemos siempre vacío para que la UI no ofrezca bajar de plan.
  const downgradeOptions: UpgradeOption[] = [];

  return {
    plan_code: currentPlanCode,
    plan_name: plan?.name ?? "Starter",
    status: subscription.status,
    access_status: access.status,
    can_use_app: access.canUseApp,
    access_reason: access.reason,
    days_left_trial: access.daysLeftTrial,
    trial_started_at: toUnixSeconds(subscription.trial_started_at),
    trial_ends_at: toUnixSeconds(subscription.trial_ends_at),
    paid_at: toUnixSeconds(subscription.paid_at),
    subscription_started_at: toUnixSeconds(subscription.subscription_started_at),
    subscription_ends_at: toUnixSeconds(subscription.subscription_ends_at),
    mercado_pago_preapproval_id: subscription.mercado_pago_preapproval_id ?? null,
    mercado_pago_preapproval_status: subscription.mercado_pago_preapproval_status ?? null,
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
    downgrade_options: downgradeOptions,
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    cancelled_at: toUnixSeconds(subscription.cancelled_at),
    product_count: productCount,
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

export async function countBusinessWhatsappNumbers(businessId: string): Promise<number> {
  const supabase = getSupabaseAdminClient();
  const { count, error } = await supabase
    .from("whatsapp_sessions")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId);

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
      updated_at: toUnixSeconds(member.created_at),
      last_active_at: null,
    };
  });
}

export async function listBusinessInvitations(businessId: string): Promise<BusinessInvitation[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("business_invitations")
    .select(BUSINESS_INVITATION_SELECT)
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
        revoked_at: string | null;
        resent_at: string | null;
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
    .select(BUSINESS_INVITATION_SELECT)
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
      revoked_at: string | null;
      resent_at: string | null;
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
  if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
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
        .select(BUSINESS_INVITATION_SELECT)
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
        revoked_at: string | null;
        resent_at: string | null;
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
    .select(BUSINESS_INVITATION_SELECT)
    .single();

  if (createError || !createdInvite) throw createError ?? new TeamManagementError("No se pudo crear la invitación.", 500);

  await recordAuditLog({
    businessId,
    actorUserId: invitedByUserId,
    action: "team.invitation.created",
    entityType: "business_invitation",
    entityId: createdInvite.id,
    metadata: { email: normalizedEmail, role },
  });

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
      revoked_at: string | null;
      resent_at: string | null;
      created_at: string | null;
      updated_at: string | null;
    }
  );
}

export async function revokeBusinessInvitation(
  businessId: string,
  actorRole: BusinessMemberRole,
  invitationId: string,
  actorUserId: string | null = null
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

  await recordAuditLog({
    businessId,
    actorUserId,
    action: "team.invitation.revoked",
    entityType: "business_invitation",
    entityId: invitationId,
  });
}

export async function resendBusinessInvitation(
  businessId: string,
  actorRole: BusinessMemberRole,
  invitationId: string,
  actorUserId: string | null = null
): Promise<BusinessInvitation> {
  assertCanManageTeam(actorRole);
  const supabase = getSupabaseAdminClient();
  const { data: invitation, error } = await supabase
    .from("business_invitations")
    .select(BUSINESS_INVITATION_SELECT)
    .eq("id", invitationId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (error) throw error;
  if (!invitation?.id) throw new TeamManagementError("Invitación no encontrada.", 404);

  const current = mapBusinessInvitationRow(invitation as {
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
    revoked_at: string | null;
    resent_at: string | null;
    created_at: string | null;
    updated_at: string | null;
  });

  if (current.status !== "pending" && current.status !== "expired") {
    throw new TeamManagementError("Solo podés reenviar invitaciones pendientes o vencidas.", 409);
  }

  const now = new Date().toISOString();
  const { data: updated, error: updateError } = await supabase
    .from("business_invitations")
    .update({
      token: generateInvitationToken(),
      status: "pending",
      expires_at: invitationExpiresAt(),
      updated_at: now,
    })
    .eq("id", invitationId)
    .eq("business_id", businessId)
    .select(BUSINESS_INVITATION_SELECT)
    .single();

  if (updateError || !updated) {
    throw updateError ?? new TeamManagementError("No se pudo reenviar la invitación.", 500);
  }

  await recordAuditLog({
    businessId,
    actorUserId,
    action: "team.invitation.resent",
    entityType: "business_invitation",
    entityId: invitationId,
    metadata: { email: updated.email, role: updated.role },
  });

  return mapBusinessInvitationRow(updated as {
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
    revoked_at: string | null;
    resent_at: string | null;
    created_at: string | null;
    updated_at: string | null;
  });
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
    // Revalidar el límite de usuarios al ACEPTAR (no solo al invitar): si el plan
    // bajó o se emitieron invitaciones de más, esto evita superar el tope del plan.
    const [activeMembers, planSummary] = await Promise.all([
      countBusinessMembers(invitation.business_id),
      getPlanSummary(invitation.business_id),
    ]);
    if (typeof planSummary.users_limit === "number" && activeMembers >= planSummary.users_limit) {
      throw new TeamManagementError(
        "El equipo alcanzó el límite de usuarios del plan. Pedile al dueño que mejore el plan para sumarte.",
        409
      );
    }
    const { error: insertError } = await supabase.from("business_members").insert({
      business_id: invitation.business_id,
      user_id: userId,
      role: invitation.role,
    });
    if (insertError) throw insertError;
    await recordAuditLog({
      businessId: invitation.business_id,
      actorUserId: userId,
      action: "team.invitation.accepted",
      entityType: "business_invitation",
      entityId: invitation.id,
      metadata: { role: invitation.role, email: invitation.email },
    });
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
  nextRole: BusinessMemberRole,
  actorUserId: string | null = null
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

  await recordAuditLog({
    businessId,
    actorUserId,
    action: "team.member.role_updated",
    entityType: "business_member",
    entityId: memberId,
    metadata: { previous_role: currentRole, next_role: nextRole, user_id: member.user_id },
  });

  const members = await getBusinessMembers(businessId);
  const updated = members.find((entry) => entry.id === memberId);
  if (!updated) throw new TeamManagementError("Miembro no encontrado.", 404);
  return updated;
}

export async function removeBusinessMember(
  businessId: string,
  actorRole: BusinessMemberRole,
  memberId: string,
  actorUserId: string | null = null
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

  await recordAuditLog({
    businessId,
    actorUserId,
    action: "team.member.removed",
    entityType: "business_member",
    entityId: memberId,
    metadata: { previous_role: targetRole },
  });
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

export async function downgradePlan(
  businessId: string,
  targetPlanCode: string
): Promise<void> {
  const downgradeCheck = canDowngradeTo(
    (await getPlanSummary(businessId)).plan_code,
    targetPlanCode
  );
  if (!downgradeCheck.allowed) {
    throw new TeamManagementError(downgradeCheck.reason ?? "No se pudo bajar de plan.", 409);
  }

  const supabase = getSupabaseAdminClient();
  const { data: targetPlan, error: planError } = await supabase
    .from("plans")
    .select("code, name, product_limit, users_limit, whatsapp_numbers_limit")
    .eq("code", targetPlanCode)
    .maybeSingle();

  if (planError || !targetPlan) {
    throw planError ?? new TeamManagementError("Plan de destino inválido.", 400);
  }

  const [memberCount, pendingInvites, productCount, whatsappCount] = await Promise.all([
    countBusinessMembers(businessId),
    countPendingBusinessInvitations(businessId),
    countBusinessItems(businessId),
    countBusinessWhatsappNumbers(businessId),
  ]);

  const totalUsersReserved = memberCount + pendingInvites;
  if (
    typeof targetPlan.users_limit === "number" &&
    totalUsersReserved > targetPlan.users_limit
  ) {
    throw new TeamManagementError(
      `No podés bajar a ${targetPlan.name} porque usás ${totalUsersReserved} usuarios reservados y ese plan permite ${targetPlan.users_limit}.`,
      409
    );
  }

  if (
    typeof targetPlan.product_limit === "number" &&
    productCount > targetPlan.product_limit
  ) {
    throw new TeamManagementError(
      `No podés bajar a ${targetPlan.name} porque tenés ${productCount} productos y ese plan permite ${targetPlan.product_limit}.`,
      409
    );
  }

  if (
    typeof targetPlan.whatsapp_numbers_limit === "number" &&
    whatsappCount > targetPlan.whatsapp_numbers_limit
  ) {
    throw new TeamManagementError(
      `No podés bajar a ${targetPlan.name} porque tenés ${whatsappCount} números de WhatsApp y ese plan permite ${targetPlan.whatsapp_numbers_limit}.`,
      409
    );
  }

  const { error } = await supabase
    .from("subscriptions")
    .update({
      plan_code: targetPlanCode,
      cancel_at_period_end: false,
      cancelled_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("business_id", businessId);

  if (error) throw error;
  subscriptionCache.delete(businessId);
  console.log(`[subscription/update] downgraded business_id=${businessId} plan=${targetPlanCode}`);
}

export async function getBusinessSubscriptionStatus(
  businessId: string
): Promise<SubscriptionRow["status"] | "none"> {
  const subscription = await getCachedSubscription(businessId);
  return subscription?.status ?? "none";
}

export async function getBusinessProfile(businessId = getBusinessId()): Promise<BusinessProfile> {
  const cached = getCachedValue(businessProfileCache, businessId);
  if (cached) return cached;

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
      .select("description, extra, quick_replies, knowledge_base, booking_enabled, booking_config, notify_enabled, notify_phone, notify_events, response_tone, updated_at")
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

  const profile = {
    id: businessId,
    name: business?.display_name ?? "",
    description: settings?.description ?? "",
    extra: settings?.extra ?? "",
    quick_replies: Array.isArray(settings?.quick_replies) ? (settings.quick_replies as string[]) : [],
    knowledge_base: settings?.knowledge_base ?? "",
    booking_enabled: settings?.booking_enabled ?? false,
    booking_config: settings?.booking_config ?? "",
    notify_enabled: settings?.notify_enabled ?? false,
    notify_phone: settings?.notify_phone ?? "",
    notify_events: Array.isArray(settings?.notify_events) ? (settings.notify_events as string[]) : [],
    response_tone: settings?.response_tone ?? "",
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
  setCachedValue(businessProfileCache, businessId, profile, BUSINESS_PROFILE_CACHE_TTL_MS);
  console.log(`[business/cache] profile loaded business_id=${businessId}`);
  return profile;
}

export async function setBusinessProfile(patch: {
  name: string;
  description: string;
  products?: ProductItem[]; // optional — if omitted, products are not touched
  extra: string;
  quick_replies?: string[]; // optional — if omitted, not touched
  knowledge_base?: string; // optional — if omitted, not touched
  booking_enabled?: boolean; // optional — if omitted, not touched
  booking_config?: string; // optional — if omitted, not touched
  notify_enabled?: boolean; // optional — if omitted, not touched
  notify_phone?: string; // optional — if omitted, not touched
  notify_events?: string[]; // optional — if omitted, not touched
  response_tone?: string; // optional — if omitted, not touched
}, businessId = getBusinessId()): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();

  await supabase.from("businesses").update({
    display_name: patch.name,
    updated_at: now,
  }).eq("id", businessId);

  const settingsPatch: Record<string, unknown> = {
    description: patch.description,
    extra: patch.extra,
    updated_at: now,
  };
  if (patch.quick_replies !== undefined) {
    settingsPatch.quick_replies = patch.quick_replies;
  }
  if (patch.knowledge_base !== undefined) {
    settingsPatch.knowledge_base = patch.knowledge_base;
  }
  if (patch.booking_enabled !== undefined) {
    settingsPatch.booking_enabled = patch.booking_enabled;
  }
  if (patch.booking_config !== undefined) {
    settingsPatch.booking_config = patch.booking_config;
  }
  if (patch.notify_enabled !== undefined) {
    settingsPatch.notify_enabled = patch.notify_enabled;
  }
  if (patch.notify_phone !== undefined) {
    settingsPatch.notify_phone = patch.notify_phone;
  }
  if (patch.notify_events !== undefined) {
    settingsPatch.notify_events = patch.notify_events;
  }
  if (patch.response_tone !== undefined) {
    settingsPatch.response_tone = patch.response_tone;
  }
  await supabase.from("business_settings").update(settingsPatch).eq("business_id", businessId);
  console.log(`[business/update] settings updated business_id=${businessId}`);

  if (patch.products !== undefined) {
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
  businessProfileCache.delete(businessId);
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
      "id, business_id, contact_id, phone_jid, last_inbound_jid, display_name, mode, needs_attention, hot_lead, last_message_at, created_at, assigned_to, human_last_activity, contact:contacts!conversations_contact_id_fkey(id, display_name, phone_number, primary_jid)"
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
  businessId = getBusinessId(),
  options?: { assignedTo?: string | null }
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { mode, updated_at: now };
  if (mode === "HUMAN" && options?.assignedTo !== undefined) {
    patch.assigned_to = options.assignedTo;
    patch.human_last_activity = now;
  } else if (mode === "AI") {
    patch.assigned_to = null;
    patch.human_last_activity = null;
  }
  const { error } = await supabase.from("conversations").update(patch)
    .eq("business_id", businessId).eq("id", conversationId);
  if (error) throw error;
}

// Mark a conversation as needing human attention (set by the AI on handoff).
// Cleared automatically when a human sends a message from the dashboard.
export async function setNeedsAttention(
  conversationId: string,
  value: boolean,
  businessId = getBusinessId()
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("conversations")
    .update({ needs_attention: value, updated_at: new Date().toISOString() })
    .eq("business_id", businessId)
    .eq("id", conversationId);
  if (error) throw error;
}

// Marca/limpia el flag de "lead caliente" (intención clara de compra/reserva).
// Lo setea el worker al detectar el evento hot_lead; se limpia cuando alguien
// toma el chat, responde desde el panel o se genera una reserva.
export async function setHotLead(
  conversationId: string,
  value: boolean,
  businessId = getBusinessId()
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("conversations")
    .update({ hot_lead: value, updated_at: new Date().toISOString() })
    .eq("business_id", businessId)
    .eq("id", conversationId);
  if (error) throw error;
}

// Refresh the last human activity timestamp (call on every human message sent from dashboard).
export async function updateHumanActivity(
  conversationId: string,
  businessId = getBusinessId()
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const { error } = await supabase.from("conversations").update({
    human_last_activity: now,
    updated_at: now,
  }).eq("business_id", businessId).eq("id", conversationId);
  if (error) throw error;
}

/**
 * Memoria de conversación: guarda un resumen corto (interés, datos dados,
 * objeciones) por conversación. Best-effort: si falta la migración 032 o falla,
 * no rompe nada (el handler lo llama con .catch).
 */
export async function updateConversationSummary(
  conversationId: string,
  summary: string,
  businessId = getBusinessId()
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("conversations")
    .update({ ai_summary: summary.slice(0, 1000), ai_summary_updated_at: new Date().toISOString() })
    .eq("business_id", businessId)
    .eq("id", conversationId);
  if (error) throw error;
}

// How long (minutes) without human activity before a HUMAN-mode conversation auto-returns to AI.
export const HUMAN_INACTIVITY_MINUTES = 30;

// Auto-return conversations that have been in HUMAN mode without activity for too long.
// Returns the number of conversations switched back to AI.
export async function returnInactiveConversationsToAI(
  businessId: string
): Promise<number> {
  const supabase = getSupabaseAdminClient();
  const threshold = new Date(Date.now() - HUMAN_INACTIVITY_MINUTES * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("conversations")
    .update({
      mode: "AI",
      assigned_to: null,
      human_last_activity: null,
      updated_at: new Date().toISOString(),
    })
    .eq("business_id", businessId)
    .eq("mode", "HUMAN")
    .lt("human_last_activity", threshold)
    .not("human_last_activity", "is", null)
    .select("id");
  if (error) throw error;
  return (data ?? []).length;
}

export async function listConversations(
  businessId = getBusinessId()
): Promise<ConversationWithPreview[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("conversations")
    .select(
      "id, business_id, contact_id, phone_jid, last_inbound_jid, display_name, mode, needs_attention, hot_lead, last_message_at, created_at, assigned_to, human_last_activity, contact:contacts!conversations_contact_id_fkey(id, display_name, phone_number, primary_jid)"
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

export async function isExternalMessageDuplicate(
  externalMessageId: string,
  businessId = getBusinessId()
): Promise<boolean> {
  const supabase = getSupabaseAdminClient();
  const [msgResult, outboxResult] = await Promise.all([
    supabase
      .from("messages")
      .select("id")
      .eq("business_id", businessId)
      .eq("external_message_id", externalMessageId)
      .limit(1),
    supabase
      .from("outbox_messages")
      .select("id")
      .eq("business_id", businessId)
      .eq("external_message_id", externalMessageId)
      .limit(1),
  ]);
  if (msgResult.error) throw msgResult.error;
  if (outboxResult.error) throw outboxResult.error;
  return (msgResult.data?.length ?? 0) > 0 || (outboxResult.data?.length ?? 0) > 0;
}

export async function setMessageExternalId(
  messageId: string,
  externalMessageId: string,
  businessId = getBusinessId()
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  await supabase
    .from("messages")
    .update({ external_message_id: externalMessageId })
    .eq("business_id", businessId)
    .eq("id", messageId);
}

export async function setOutboxExternalId(
  outboxId: string,
  externalMessageId: string,
  businessId = getBusinessId()
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  await supabase
    .from("outbox_messages")
    .update({ external_message_id: externalMessageId })
    .eq("business_id", businessId)
    .eq("id", outboxId);
}

export async function getMessages(
  conversationId: string,
  limit = 50,
  businessId = getBusinessId()
): Promise<Message[]> {
  const supabase = getSupabaseAdminClient();
  // IMPORTANTE: traer los ÚLTIMOS `limit` mensajes (desc) y luego revertir a
  // orden cronológico. Con asc + limit se devolvían los PRIMEROS mensajes
  // históricos, y en conversaciones largas los mensajes nuevos (cliente, IA,
  // humano) nunca aparecían en el panel.
  const { data, error } = await supabase
    .from("messages")
    .select("id, conversation_id, role, content, created_at")
    .eq("business_id", businessId)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(mapMessageRow).reverse();
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
  businessId = getBusinessId(),
  instanceName = getWorkerInstanceName()
): Promise<ConnectionState> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("whatsapp_sessions")
    .select("status, qr_string, phone, auth_path, last_seen_at, updated_at, pairing_phone, pairing_code")
    .eq("business_id", businessId)
    .eq("instance_name", instanceName)
    .single();
  // PGRST116 = no rows found — treat as disconnected instead of throwing 500
  if (error && error.code !== "PGRST116") throw error;
  if (!data) {
    return {
      id: 1,
      status: "disconnected",
      qr_string: null,
      phone: null,
      auth_path: null,
      last_seen_at: null,
      updated_at: 0,
      worker_online: false,
      pairing_phone: null,
      pairing_code: null,
    };
  }

  const lastSeenAt = toUnixSeconds(data.last_seen_at);
  return {
    id: 1,
    status: data.status,
    qr_string: data.qr_string,
    phone: data.phone,
    auth_path: data.auth_path,
    last_seen_at: lastSeenAt,
    updated_at: toUnixSeconds(data.updated_at) ?? 0,
    worker_online: typeof lastSeenAt === "number" ? Math.floor(Date.now() / 1000) - lastSeenAt <= 30 : false,
    pairing_phone: data.pairing_phone ?? null,
    pairing_code: data.pairing_code ?? null,
  };
}

export async function setConnectionState(
  patch: {
    status: "disconnected" | "qr" | "connecting" | "connected";
    qr_string?: string | null;
    phone?: string | null;
    auth_path?: string | null;
    pairing_phone?: string | null;
    pairing_code?: string | null;
  },
  businessId = getBusinessId(),
  instanceName = getWorkerInstanceName()
): Promise<void> {
  const current = await getConnectionState(businessId, instanceName).catch(() => ({
    qr_string: null,
    phone: null,
    auth_path: null,
    pairing_phone: null,
    pairing_code: null,
  }));
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("whatsapp_sessions")
    .upsert(
      {
        business_id: businessId,
        instance_name: instanceName,
        status: patch.status,
        qr_string: patch.qr_string !== undefined ? patch.qr_string : current.qr_string,
        phone: patch.phone !== undefined ? patch.phone : current.phone,
        auth_path: patch.auth_path !== undefined ? patch.auth_path : current.auth_path,
        pairing_phone: patch.pairing_phone !== undefined ? patch.pairing_phone : current.pairing_phone,
        pairing_code: patch.pairing_code !== undefined ? patch.pairing_code : current.pairing_code,
        desired_action: "none",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "business_id,instance_name" }
    );
  if (error) throw error;
}

/**
 * El dashboard solicita vincular por código: guarda el número y limpia el
 * código anterior. El worker lo detecta y genera el código vía Baileys.
 */
export async function requestPairingCode(
  phone: string,
  businessId = getBusinessId(),
  instanceName = getWorkerInstanceName()
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("whatsapp_sessions")
    .update({
      pairing_phone: phone,
      pairing_code: null,
      pairing_requested_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("business_id", businessId)
    .eq("instance_name", instanceName);
  if (error) throw error;
}

export async function updateWorkerHeartbeat(
  authPath?: string,
  businessId = getBusinessId(),
  instanceName = getWorkerInstanceName()
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  // IMPORTANT: solo actualiza last_seen_at y auth_path — NO toca status ni qr_string.
  // Usar .update() (no upsert) para nunca pisar el estado de conexión/QR.
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { last_seen_at: now, updated_at: now };
  if (authPath !== undefined) patch.auth_path = authPath;
  const { error } = await supabase
    .from("whatsapp_sessions")
    .update(patch)
    .eq("business_id", businessId)
    .eq("instance_name", instanceName);
  if (error) throw error;
}

/**
 * Anti-ban — lock de sesión única. Evita que dos instancias del worker abran
 * sesión Baileys para el mismo número (lo que provoca conflicto 440 y baneo).
 *
 * Toma/renueva la propiedad de la fila whatsapp_sessions para `ownerId` con un
 * vencimiento de 90s. Devuelve true si este proceso es el dueño legítimo.
 *
 * FAIL-OPEN: si la migración 031 (columnas owned_by/owner_expires_at) todavía no
 * se aplicó o hay un error de DB, devolvemos true para NO bloquear al worker.
 * Solo devolvemos false cuando confirmamos que otra instancia viva es la dueña.
 */
export async function tryAdoptSessionOwnership(
  businessId: string,
  instanceName: string,
  ownerId: string,
  ttlMs = 90_000
): Promise<boolean> {
  try {
    const supabase = getSupabaseAdminClient();
    const nowIso = new Date().toISOString();
    const expiresIso = new Date(Date.now() + ttlMs).toISOString();
    const { data, error } = await supabase
      .from("whatsapp_sessions")
      .update({ owned_by: ownerId, owner_expires_at: expiresIso, updated_at: nowIso })
      .eq("business_id", businessId)
      .eq("instance_name", instanceName)
      .or(`owned_by.is.null,owned_by.eq.${ownerId},owner_expires_at.lt.${nowIso}`)
      .select("owned_by");
    if (error) {
      console.warn(`[session-lock/${businessId}] No se pudo evaluar el lock (¿falta migración 031?): ${error.message}. Continúo (fail-open).`);
      return true;
    }
    return (data?.length ?? 0) > 0;
  } catch (err) {
    console.warn(`[session-lock/${businessId}] Error en lock, continúo (fail-open):`, err);
    return true;
  }
}

/** Renueva el vencimiento del lock mientras este proceso siga siendo el dueño. */
export async function renewSessionOwnership(
  businessId: string,
  instanceName: string,
  ownerId: string,
  ttlMs = 90_000
): Promise<void> {
  try {
    const supabase = getSupabaseAdminClient();
    await supabase
      .from("whatsapp_sessions")
      .update({ owner_expires_at: new Date(Date.now() + ttlMs).toISOString() })
      .eq("business_id", businessId)
      .eq("instance_name", instanceName)
      .eq("owned_by", ownerId);
  } catch {
    // best-effort; el lock vencerá solo si dejamos de renovarlo.
  }
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

export async function getPendingOutbox(
  limit = 20,
  businessId = getBusinessId()
): Promise<OutboxItem[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("outbox_messages")
    .select("id, conversation_id, contact_id, target_jid, content, sent, retry_count, created_at")
    .eq("business_id", businessId)
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

export async function markOutboxSent(
  id: string,
  businessId = getBusinessId()
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("outbox_messages")
    .update({
      sent: true,
      sent_at: new Date().toISOString(),
      error: null,
    })
    .eq("business_id", businessId)
    .eq("id", id);
  if (error) throw error;
}

export async function setOutboxError(
  id: string,
  errorMessage: string,
  newRetryCount?: number,
  businessId = getBusinessId()
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const patch: Record<string, unknown> = { error: errorMessage, sent: false };
  if (typeof newRetryCount === "number") {
    patch.retry_count = newRetryCount;
  }
  const { error } = await supabase
    .from("outbox_messages")
    .update(patch)
    .eq("business_id", businessId)
    .eq("id", id);
  if (error) throw error;
}

export async function requestWhatsappDisconnect(
  businessId = getBusinessId(),
  instanceName = getWorkerInstanceName()
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("whatsapp_sessions")
    .update({
      desired_action: "disconnect",
      updated_at: new Date().toISOString(),
    })
    .eq("business_id", businessId)
    .eq("instance_name", instanceName);
  if (error) throw error;
}

export async function getRequestedSessionAction(
  businessId = getBusinessId(),
  instanceName = getWorkerInstanceName()
): Promise<string> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("whatsapp_sessions")
    .select("desired_action")
    .eq("business_id", businessId)
    .eq("instance_name", instanceName)
    .single();
  if (error || !data) throw error ?? new Error("desired_action missing");
  return data.desired_action ?? "none";
}

export async function clearRequestedSessionAction(
  businessId = getBusinessId(),
  instanceName = getWorkerInstanceName()
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("whatsapp_sessions")
    .update({
      desired_action: "none",
      updated_at: new Date().toISOString(),
    })
    .eq("business_id", businessId)
    .eq("instance_name", instanceName);
  if (error) throw error;
}

/**
 * Devuelve los IDs de todos los negocios que deben tener una sesión de WhatsApp activa.
 * Se incluyen los que tienen suscripción en trial o active y una fila en whatsapp_sessions.
 */
export async function getActiveBusinessIdsForWorker(): Promise<string[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("business_id")
    .in("status", ["trial", "active"]);
  if (error) throw error;
  const businessIds = (data ?? []).map((r) => r.business_id as string).filter(Boolean);
  if (businessIds.length === 0) return [];

  // Verificar cuáles tienen una fila en whatsapp_sessions
  const { data: sessions, error: sessionError } = await supabase
    .from("whatsapp_sessions")
    .select("business_id")
    .in("business_id", businessIds);
  if (sessionError) throw sessionError;

  const sessionSet = new Set((sessions ?? []).map((r) => r.business_id as string));
  return businessIds.filter((id) => sessionSet.has(id));
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

// ── Catalog: Productos y Servicios ───────────────────────────────────────────

export type CatalogItemType = "product" | "service";
export type StockStatus = "available" | "unavailable" | "on_demand";

export interface CatalogItem {
  id: string;
  business_id: string;
  item_type: CatalogItemType;
  name: string;
  category: string | null;
  description: string | null;
  price: string | null;           // maps to price_text column
  promo_price: string | null;
  stock_status: StockStatus | null;
  duration: string | null;
  requires_booking: boolean;
  payment_options: string | null;
  financing_options: string | null;
  internal_notes: string | null;
  is_active: boolean;
  is_featured: boolean;
  /** Etiqueta de promoción, ej: "Hot Sale", "12 cuotas sin interés" */
  promotion_label: string | null;
  /** Fecha de vencimiento de la promoción (ISO string). null = sin vencimiento. */
  promotion_ends_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type CatalogItemInput = Omit<CatalogItem, "id" | "business_id" | "sort_order" | "created_at" | "updated_at">;

/** Chequea si una promoción está actualmente activa (no vencida). */
export function isPromotionActive(item: CatalogItem): boolean {
  if (!item.promotion_label) return false;
  if (!item.promotion_ends_at) return true; // sin fecha = siempre activa
  return new Date(item.promotion_ends_at).getTime() > Date.now();
}

export interface CatalogCapacity {
  count: number;
  limit: number;
  canAdd: boolean;
}

const CATALOG_SELECT =
  "id, business_id, item_type, name, category, description, price_text, promo_price, stock_status, duration, requires_booking, payment_options, financing_options, internal_notes, is_active, is_featured, promotion_label, promotion_ends_at, sort_order, created_at, updated_at";

const CATALOG_PLACEHOLDER_PATTERNS = [
  /^\$?\s*x+\s*$/i,
  /^\$?\s*\?\s*$/i,
  /^\[.*\]$/i,
  /^-+$/i,
  /^(n\/a|na|no aplica|sin dato|sin datos|sin definir|pendiente|por confirmar|a confirmar|tbd)$/i,
  /^(completar|completar precio|precio|precio a consultar|consultar|consultar precio)$/i,
  /^(no tengo|no se|no sé|desconocido)$/i,
];

function isCatalogPlaceholder(value: string): boolean {
  const normalized = value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return CATALOG_PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(normalized));
}

function nullableCatalogText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && !isCatalogPlaceholder(trimmed) ? trimmed : null;
}

function requiredCatalogText(value: string | null | undefined): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed.length > 0 && !isCatalogPlaceholder(trimmed) ? trimmed : "";
}

function mapRowToCatalogItem(row: Record<string, unknown>): CatalogItem {
  return {
    id: row.id as string,
    business_id: row.business_id as string,
    item_type: (row.item_type as CatalogItemType) ?? "product",
    name: row.name as string,
    category: (row.category as string | null) ?? null,
    description: nullableCatalogText(row.description),
    price: nullableCatalogText(row.price_text),
    promo_price: nullableCatalogText(row.promo_price),
    stock_status: (row.stock_status as StockStatus | null) ?? null,
    duration: nullableCatalogText(row.duration),
    requires_booking: (row.requires_booking as boolean) ?? false,
    payment_options: nullableCatalogText(row.payment_options),
    financing_options: nullableCatalogText(row.financing_options),
    internal_notes: (row.internal_notes as string | null) ?? null,
    is_active: (row.is_active as boolean) ?? true,
    is_featured: (row.is_featured as boolean) ?? false,
    promotion_label: (row.promotion_label as string | null) ?? null,
    promotion_ends_at: (row.promotion_ends_at as string | null) ?? null,
    sort_order: (row.sort_order as number) ?? 0,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export async function countBusinessItems(businessId: string): Promise<number> {
  const supabase = getSupabaseAdminClient();
  const { count, error } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .is("deleted_at", null);
  if (error) throw error;
  return count ?? 0;
}

export async function getCatalogCapacity(
  businessId: string
): Promise<CatalogCapacity> {
  const supabase = getSupabaseAdminClient();
  const sub = await getCachedSubscription(businessId);
  const { data: plan } = await supabase
    .from("plans")
    .select("product_limit")
    .eq("code", sub?.plan_code ?? "starter")
    .maybeSingle();
  const limit = (plan?.product_limit as number | null) ?? 10;
  const count = await countBusinessItems(businessId);
  return { count, limit, canAdd: count < limit };
}

export async function listBusinessItems(businessId: string): Promise<CatalogItem[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("products")
    .select(CATALOG_SELECT)
    .eq("business_id", businessId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => mapRowToCatalogItem(row as Record<string, unknown>));
}

export async function createBusinessItem(
  businessId: string,
  input: CatalogItemInput
): Promise<CatalogItem> {
  const supabase = getSupabaseAdminClient();

  const capacity = await getCatalogCapacity(businessId);
  if (!capacity.canAdd) {
    const err = new Error(
      `Alcanzaste el límite de productos y servicios de tu plan (${capacity.limit}).`
    );
    (err as Error & { code: string }).code = "CATALOG_LIMIT_EXCEEDED";
    throw err;
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("products")
    .insert({
      id: randomUUID(),
      business_id: businessId,
      item_type: input.item_type ?? "product",
      name: input.name,
      category: input.category ?? null,
      description: requiredCatalogText(input.description),
      price_text: requiredCatalogText(input.price),
      promo_price: input.promo_price ?? null,
      stock_status: input.stock_status ?? "available",
      duration: input.duration ?? null,
      requires_booking: input.requires_booking ?? false,
      payment_options: input.payment_options ?? null,
      financing_options: input.financing_options ?? null,
      internal_notes: input.internal_notes ?? null,
      is_active: input.is_active ?? true,
      is_featured: input.is_featured ?? false,
      promotion_label: input.promotion_label ?? null,
      promotion_ends_at: input.promotion_ends_at ?? null,
      sort_order: capacity.count,
      created_at: now,
      updated_at: now,
    })
    .select(CATALOG_SELECT)
    .single();
  if (error) throw error;
  businessProfileCache.delete(businessId);
  return mapRowToCatalogItem(data as Record<string, unknown>);
}

export async function updateBusinessItem(
  businessId: string,
  itemId: string,
  input: Partial<CatalogItemInput>
): Promise<CatalogItem> {
  const supabase = getSupabaseAdminClient();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.item_type !== undefined) patch.item_type = input.item_type;
  if (input.name !== undefined) patch.name = input.name;
  if (input.category !== undefined) patch.category = input.category;
  if (input.description !== undefined) patch.description = requiredCatalogText(input.description);
  if (input.price !== undefined) patch.price_text = requiredCatalogText(input.price);
  if (input.promo_price !== undefined) patch.promo_price = input.promo_price;
  if (input.stock_status !== undefined) patch.stock_status = input.stock_status;
  if (input.duration !== undefined) patch.duration = input.duration;
  if (input.requires_booking !== undefined) patch.requires_booking = input.requires_booking;
  if (input.payment_options !== undefined) patch.payment_options = input.payment_options;
  if (input.financing_options !== undefined) patch.financing_options = input.financing_options;
  if (input.internal_notes !== undefined) patch.internal_notes = input.internal_notes;
  if (input.is_active !== undefined) patch.is_active = input.is_active;
  if (input.is_featured !== undefined) patch.is_featured = input.is_featured;
  if (input.promotion_label !== undefined) patch.promotion_label = input.promotion_label;
  if (input.promotion_ends_at !== undefined) patch.promotion_ends_at = input.promotion_ends_at;

  const { data, error } = await supabase
    .from("products")
    .update(patch)
    .eq("id", itemId)
    .eq("business_id", businessId) // ownership check
    .is("deleted_at", null)
    .select(CATALOG_SELECT)
    .single();
  if (error) throw error;
  businessProfileCache.delete(businessId);
  return mapRowToCatalogItem(data as Record<string, unknown>);
}

export async function deleteBusinessItem(
  businessId: string,
  itemId: string
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("products")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", itemId)
    .eq("business_id", businessId); // ownership check
  if (error) throw error;
  businessProfileCache.delete(businessId);
}

export async function toggleBusinessItemActive(
  businessId: string,
  itemId: string
): Promise<CatalogItem> {
  const supabase = getSupabaseAdminClient();
  const { data: current, error: fetchErr } = await supabase
    .from("products")
    .select("is_active")
    .eq("id", itemId)
    .eq("business_id", businessId)
    .is("deleted_at", null)
    .single();
  if (fetchErr) throw fetchErr;
  const next = !(current as { is_active: boolean }).is_active;
  return updateBusinessItem(businessId, itemId, { is_active: next });
}

// Items formatted for AI prompt — no internal_notes, active only.
// Featured items first, then by sort_order/created_at.
//
// El tope de cuántos ítems se TRAEN (no cuántos se mandan al modelo) es
// configurable. Antes estaba fijo en 50, lo que dejaba ciegos a los negocios
// con catálogos grandes (plan Pro: hasta 1000 productos): el modelo nunca veía
// del ítem 51 en adelante. Ahora se trae un universo más amplio y la selección
// fina por relevancia se hace en ai-context.ts (selectRelevantCatalogItems).
const CATALOG_PROMPT_FETCH_LIMIT = (() => {
  const raw = Number.parseInt(process.env.CATALOG_PROMPT_FETCH_LIMIT ?? "", 10);
  return Number.isFinite(raw) && raw > 0 ? Math.min(raw, 2000) : 400;
})();

export async function listActiveItemsForPrompt(
  businessId = getBusinessId()
): Promise<CatalogItem[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("products")
    .select(CATALOG_SELECT)
    .eq("business_id", businessId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("is_featured", { ascending: false }) // featured primero
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(CATALOG_PROMPT_FETCH_LIMIT);
  if (error) throw error;
  return (data ?? []).map((row) => mapRowToCatalogItem(row as Record<string, unknown>));
}

// ════════════════════════════════════════════════════════════════════════════
// AGENDA / TURNOS
// ════════════════════════════════════════════════════════════════════════════

export type AppointmentStatus = "pending" | "confirmed" | "cancelled" | "done";

export interface Appointment {
  id: string;
  business_id: string;
  conversation_id: string | null;
  contact_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  service: string | null;
  starts_at: string | null; // ISO timestamp
  duration_minutes: number | null;
  ends_at: string | null; // ISO timestamp
  notes: string | null;
  status: AppointmentStatus;
  source: "ai" | "human";
  created_at: string;
  updated_at: string;
}

export interface AppointmentInput {
  customer_name?: string | null;
  customer_phone?: string | null;
  service?: string | null;
  starts_at?: string | null;
  notes?: string | null;
  status?: AppointmentStatus;
  conversation_id?: string | null;
  contact_id?: string | null;
  source?: "ai" | "human";
  duration_minutes?: number | null;
  ends_at?: string | null;
}

const APPOINTMENT_STATUSES: AppointmentStatus[] = ["pending", "confirmed", "cancelled", "done"];

// Límite mensual de turnos por plan. null = sin límite.
const APPOINTMENT_MONTHLY_LIMIT: Record<string, number | null> = {
  starter: 30,
  growth: null,
  pro: null,
};

export class AppointmentLimitError extends Error {
  code = "APPOINTMENT_LIMIT_EXCEEDED" as const;
  status = 403;
  constructor(message: string) {
    super(message);
  }
}

function monthStartISO(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/** Cantidad de turnos creados este mes (para el límite de Starter). */
export async function getAppointmentMonthlyCount(businessId = getBusinessId()): Promise<number> {
  const supabase = getSupabaseAdminClient();
  const { count, error } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .gte("created_at", monthStartISO());
  if (error) throw error;
  return count ?? 0;
}

/** Lista turnos del negocio. Por defecto ordenados por fecha del turno. */
export async function listAppointments(
  businessId = getBusinessId(),
  opts: { includeCancelled?: boolean; limit?: number } = {}
): Promise<Appointment[]> {
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("appointments")
    .select("*")
    .eq("business_id", businessId);
  if (!opts.includeCancelled) {
    query = query.neq("status", "cancelled");
  }
  query = query
    .order("starts_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 200);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Appointment[];
}

export async function getAppointmentById(
  id: string,
  businessId = getBusinessId()
): Promise<Appointment | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .eq("id", id)
    .eq("business_id", businessId)
    .maybeSingle();
  if (error) throw error;
  return (data as Appointment) ?? null;
}

export async function createAppointment(
  input: AppointmentInput,
  businessId = getBusinessId()
): Promise<Appointment> {
  // Límite mensual por plan (Starter).
  const planCode = (await getCachedSubscription(businessId))?.plan_code ?? "starter";
  const limit = APPOINTMENT_MONTHLY_LIMIT[planCode] ?? null;
  if (limit !== null) {
    const used = await getAppointmentMonthlyCount(businessId);
    if (used >= limit) {
      throw new AppointmentLimitError(
        `Alcanzaste el límite de ${limit} reservas este mes en tu plan. Mejorá tu plan para reservas ilimitadas.`
      );
    }
  }

  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const status: AppointmentStatus = APPOINTMENT_STATUSES.includes(input.status as AppointmentStatus)
    ? (input.status as AppointmentStatus)
    : "pending";
  const { data, error } = await supabase
    .from("appointments")
    .insert({
      business_id: businessId,
      conversation_id: input.conversation_id ?? null,
      contact_id: input.contact_id ?? null,
      customer_name: input.customer_name ?? null,
      customer_phone: input.customer_phone ? normalizePhoneNumber(input.customer_phone) : null,
      service: input.service ?? null,
      starts_at: input.starts_at ?? null,
      duration_minutes: input.duration_minutes ?? null,
      ends_at: input.ends_at ?? null,
      notes: input.notes ?? null,
      status,
      source: input.source === "ai" ? "ai" : "human",
      updated_at: now,
    })
    .select("*")
    .single();
  if (error) throw error;
  const appointment = data as Appointment;

  // El lead se concretó en una reserva → limpiamos el flag de lead caliente.
  if (input.conversation_id) {
    await setHotLead(input.conversation_id, false, businessId).catch(() => undefined);
  }

  // Aviso interno (si el negocio lo configuró y el plan lo permite).
  const apptTz = await getBusinessTimezone(businessId).catch(() => DEFAULT_BUSINESS_TIMEZONE);
  await enqueueInternalNotification(
    {
      event_type: "new_appointment",
      dedup_key: `appt:${appointment.id}`,
      content: buildNewAppointmentMessage(appointment, apptTz),
    },
    businessId
  ).catch((err) => console.error(`[notify/${businessId}] enqueue new_appointment falló:`, err));

  return appointment;
}

// Zona horaria por defecto si el negocio no tiene una configurada.
const DEFAULT_BUSINESS_TIMEZONE = "America/Argentina/Buenos_Aires";

/** Zona horaria del negocio (de business_settings). Default: AR. */
export async function getBusinessTimezone(businessId = getBusinessId()): Promise<string> {
  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from("business_settings")
    .select("timezone")
    .eq("business_id", businessId)
    .maybeSingle();
  return (data?.timezone as string) || DEFAULT_BUSINESS_TIMEZONE;
}

/**
 * Formatea un instante (ISO/UTC) a la hora LOCAL del negocio. CRÍTICO para los
 * mensajes que arma el servidor: sin `timeZone` se imprime el UTC y aparece
 * corrido (ej: 14:30 en vez de 11:30 en Argentina).
 */
function formatApptDateTime(startsAt: string | null, timezone: string): string {
  if (!startsAt) return "";
  const d = new Date(startsAt);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("es-AR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  });
}

/** "para el vie 19 jun 16:00" (en hora del negocio) o "" si no hay fecha. */
function appointmentWhenSuffix(startsAt: string | null, timezone: string): string {
  const formatted = formatApptDateTime(startsAt, timezone);
  return formatted ? ` para el ${formatted}` : "";
}

export async function updateAppointment(
  id: string,
  patch: AppointmentInput,
  businessId = getBusinessId()
): Promise<Appointment> {
  const supabase = getSupabaseAdminClient();

  // Estado previo: para avisar al cliente SOLO en la transición (confirmar/cancelar),
  // se confirme desde el panel o por WhatsApp. Evita avisos repetidos.
  const { data: prev } = await supabase
    .from("appointments")
    .select("status")
    .eq("id", id)
    .eq("business_id", businessId)
    .maybeSingle();
  const prevStatus = (prev?.status as AppointmentStatus | undefined) ?? undefined;

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.customer_name !== undefined) update.customer_name = patch.customer_name;
  if (patch.customer_phone !== undefined)
    update.customer_phone = patch.customer_phone ? normalizePhoneNumber(patch.customer_phone) : null;
  if (patch.service !== undefined) update.service = patch.service;
  if (patch.starts_at !== undefined) update.starts_at = patch.starts_at;
  if (patch.notes !== undefined) update.notes = patch.notes;
  if (patch.status !== undefined && APPOINTMENT_STATUSES.includes(patch.status)) {
    update.status = patch.status;
  }

  const { data, error } = await supabase
    .from("appointments")
    .update(update)
    .eq("id", id)
    .eq("business_id", businessId)
    .select("*")
    .single();
  if (error) throw error;
  const appointment = data as Appointment;

  // Aviso automático al CLIENTE en la transición de estado (centralizado acá para
  // que funcione tanto desde el panel como desde el comando 1/2/3 del encargado).
  // Encola en outbox (lo envía el worker). Best-effort: nunca rompe la actualización.
  try {
    const newStatus = appointment.status;
    const transitioned = prevStatus !== newStatus;
    if (transitioned && appointment.conversation_id) {
      const tz = await getBusinessTimezone(businessId);
      let customerMsg: string | null = null;
      if (newStatus === "confirmed") {
        customerMsg = `¡Listo! Te confirmamos el turno${appointmentWhenSuffix(appointment.starts_at, tz)} ✅ Te esperamos 🙌`;
      } else if (newStatus === "cancelled") {
        customerMsg = `Tuvimos que cancelar el turno${appointmentWhenSuffix(appointment.starts_at, tz)} 🙏 Si querés, coordinamos otro horario y te lo dejamos.`;
      }
      if (customerMsg) {
        await enqueueOutbox(appointment.conversation_id, customerMsg, businessId).catch((err) =>
          console.error(`[appointments/${businessId}] aviso al cliente falló:`, err)
        );
      }
    }
  } catch (err) {
    console.error(`[appointments/${businessId}] notificacion de transicion falló:`, err);
  }

  return appointment;
}

/** Borra una reserva (hard delete). */
export async function deleteAppointment(
  id: string,
  businessId = getBusinessId()
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("appointments")
    .delete()
    .eq("id", id)
    .eq("business_id", businessId);
  if (error) throw error;
}

/** Borra todas las reservas completadas y canceladas. Devuelve cuántas borró. */
export async function deleteClosedAppointments(
  businessId = getBusinessId()
): Promise<number> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("appointments")
    .delete()
    .eq("business_id", businessId)
    .in("status", ["done", "cancelled"])
    .select("id");
  if (error) throw error;
  return (data ?? []).length;
}

// ════════════════════════════════════════════════════════════════════════════
// AVISOS INTERNOS AL ENCARGADO
// ════════════════════════════════════════════════════════════════════════════

/** Eventos de aviso interno soportados. */
export const INTERNAL_NOTIFICATION_EVENTS = [
  "new_appointment",
  "appointment_cancelled",
  "human_handoff",
  "hot_lead",
  "unanswered",
  "daily_summary",
] as const;
export type InternalNotificationEvent = (typeof INTERNAL_NOTIFICATION_EVENTS)[number];

const DEFAULT_INTERNAL_NOTIFICATION_EVENTS: InternalNotificationEvent[] = [
  "new_appointment",
  "human_handoff",
  "hot_lead",
  "unanswered",
];

function effectiveInternalNotificationEvents(events: string[]): string[] {
  // Compatibilidad: cuentas configuradas antes del selector de eventos suelen
  // tener solo human_handoff aunque esperan recibir todos los avisos importantes.
  if (events.length === 0) return DEFAULT_INTERNAL_NOTIFICATION_EVENTS;
  if (events.length === 1 && events[0] === "human_handoff") return DEFAULT_INTERNAL_NOTIFICATION_EVENTS;
  return events;
}

/** ¿El plan del negocio permite avisos internos? (Growth y Pro). */
export async function planAllowsInternalNotifications(
  businessId = getBusinessId()
): Promise<boolean> {
  // Notifications are allowed for any active or trial subscription.
  // We intentionally do NOT gate by plan features: the user-controlled
  // notify_enabled toggle and their notify_phone are sufficient guards.
  const sub = await getCachedSubscription(businessId);
  return sub?.status === "active" || sub?.status === "trial";
}

function buildNewAppointmentMessage(a: Appointment, timezone: string): string {
  const lines = ["📅 *Nueva reserva solicitada*"];
  if (a.customer_name) lines.push(`Cliente: ${a.customer_name}`);
  if (a.customer_phone) lines.push(`WhatsApp: ${a.customer_phone}`);
  if (a.service) lines.push(`Servicio: ${a.service}`);
  const when = formatApptDateTime(a.starts_at, timezone);
  if (when) lines.push(`Día/hora: ${when}`);
  if (a.notes) lines.push(`Mensaje: ${a.notes}`);
  // Gestión desde la app: el encargado confirma/cancela/reprograma en Reservas.
  lines.push("");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  lines.push(
    appUrl
      ? `Entrá a la app para confirmar el turno 👉 ${appUrl.replace(/\/$/, "")}/app/agenda`
      : "Entrá a la app y confirmá el turno en la sección Reservas."
  );
  return lines.join("\n");
}

/** Teléfono del encargado (notify_phone) normalizado, o null si no está cargado. */
export async function getNotifyPhone(businessId = getBusinessId()): Promise<string | null> {
  const profile = await getBusinessProfile(businessId).catch(() => null);
  if (!profile?.notify_phone) return null;
  return normalizePhoneNumber(profile.notify_phone) || null;
}

/** Última reserva en estado 'pending' del negocio (para confirmar/rechazar por WhatsApp). */
export async function getLatestPendingAppointment(
  businessId = getBusinessId()
): Promise<Appointment | null> {
  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from("appointments")
    .select("*")
    .eq("business_id", businessId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as Appointment) ?? null;
}

/**
 * Encola un aviso interno para que el WORKER lo envíe por WhatsApp al encargado.
 * Respeta: interruptor general, evento habilitado, plan, y deduplicación.
 * No envía nada por sí mismo (Baileys vive en el worker, fuera de Vercel).
 */
export async function enqueueInternalNotification(
  params: { event_type: string; content: string; dedup_key?: string },
  businessId = getBusinessId()
): Promise<{ enqueued: boolean; reason?: string }> {
  const profile = await getBusinessProfile(businessId).catch(() => null);
  if (!profile || !profile.notify_enabled) return { enqueued: false, reason: "disabled" };
  const notifyEvents = effectiveInternalNotificationEvents(profile.notify_events);
  if (!notifyEvents.includes(params.event_type)) {
    return { enqueued: false, reason: "event_off" };
  }
  const phone = normalizePhoneNumber(profile.notify_phone);
  if (!phone) return { enqueued: false, reason: "no_phone" };

  if (!(await planAllowsInternalNotifications(businessId))) {
    return { enqueued: false, reason: "plan" };
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("internal_notifications")
    .insert({
      business_id: businessId,
      event_type: params.event_type,
      content: params.content,
      target_jid: `${phone}@s.whatsapp.net`,
      dedup_key: params.dedup_key ?? null,
    });
  if (error) {
    // 23505 = unique_violation → ya estaba encolado, lo ignoramos (dedup).
    if ((error as { code?: string }).code === "23505") return { enqueued: false, reason: "duplicate" };
    throw error;
  }
  return { enqueued: true };
}

export interface PendingInternalNotification {
  id: string;
  business_id: string;
  event_type: string;
  content: string;
  target_jid: string;
  retry_count: number;
}

/** El worker lee los avisos pendientes de un negocio. */
export async function getPendingInternalNotifications(
  limit: number,
  businessId: string
): Promise<PendingInternalNotification[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("internal_notifications")
    .select("id, business_id, event_type, content, target_jid, retry_count")
    .eq("business_id", businessId)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as PendingInternalNotification[];
}

export async function markInternalNotificationSent(id: string, businessId: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  await supabase
    .from("internal_notifications")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", id)
    .eq("business_id", businessId);
}

export async function setInternalNotificationError(
  id: string,
  errorMsg: string,
  retryCount: number,
  businessId: string
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const status = retryCount >= 3 ? "failed" : "pending";
  await supabase
    .from("internal_notifications")
    .update({ status, error: errorMsg.slice(0, 500), retry_count: retryCount })
    .eq("id", id)
    .eq("business_id", businessId);
}

// ───────────────────────────────────────────────────────────────────────────
// Agenda profesional — horario estructurado + excepciones (Fase 1)
// Fuente de verdad de la disponibilidad. La validación de slots vive en
// src/lib/availability.ts (capa pura); acá sólo se lee/escribe en Supabase.
// ───────────────────────────────────────────────────────────────────────────

export interface BusinessHourRow {
  weekday: number; // 0=Domingo .. 6=Sábado
  open_time: string; // "HH:MM"
  close_time: string; // "HH:MM"
}

export interface ScheduleExceptionRow {
  id?: string;
  exception_date: string; // "YYYY-MM-DD"
  kind: "closed" | "block" | "special";
  start_time: string | null; // "HH:MM" | null
  end_time: string | null; // "HH:MM" | null
  reason: string;
}

export interface BusinessScheduleSettings {
  timezone: string;
  slot_interval_minutes: number;
  default_duration_minutes: number;
  booking_lead_minutes: number;
  booking_horizon_days: number;
}

export interface BusinessSchedule {
  hours: BusinessHourRow[];
  exceptions: ScheduleExceptionRow[];
  settings: BusinessScheduleSettings;
}

const DEFAULT_SCHEDULE_SETTINGS: BusinessScheduleSettings = {
  timezone: "America/Argentina/Buenos_Aires",
  slot_interval_minutes: 30,
  default_duration_minutes: 30,
  booking_lead_minutes: 0,
  booking_horizon_days: 30,
};

function hhmm(value: unknown): string {
  return typeof value === "string" ? value.slice(0, 5) : "";
}

export async function getBusinessSchedule(
  businessId = getBusinessId()
): Promise<BusinessSchedule> {
  const supabase = getSupabaseAdminClient();
  const [hoursRes, exceptionsRes, settingsRes] = await Promise.all([
    supabase
      .from("business_hours")
      .select("weekday, open_time, close_time")
      .eq("business_id", businessId)
      .order("weekday", { ascending: true })
      .order("open_time", { ascending: true }),
    supabase
      .from("schedule_exceptions")
      .select("id, exception_date, kind, start_time, end_time, reason")
      .eq("business_id", businessId)
      .order("exception_date", { ascending: true }),
    supabase
      .from("business_settings")
      .select("timezone, slot_interval_minutes, default_duration_minutes, booking_lead_minutes, booking_horizon_days")
      .eq("business_id", businessId)
      .maybeSingle(),
  ]);

  const s = settingsRes.data as Partial<BusinessScheduleSettings> | null;
  return {
    hours: (hoursRes.data ?? []).map((h) => ({
      weekday: Number(h.weekday),
      open_time: hhmm(h.open_time),
      close_time: hhmm(h.close_time),
    })),
    exceptions: (exceptionsRes.data ?? []).map((e) => ({
      id: e.id as string,
      exception_date: String(e.exception_date),
      kind: e.kind as ScheduleExceptionRow["kind"],
      start_time: e.start_time ? hhmm(e.start_time) : null,
      end_time: e.end_time ? hhmm(e.end_time) : null,
      reason: (e.reason as string) ?? "",
    })),
    settings: {
      timezone: s?.timezone ?? DEFAULT_SCHEDULE_SETTINGS.timezone,
      slot_interval_minutes: s?.slot_interval_minutes ?? DEFAULT_SCHEDULE_SETTINGS.slot_interval_minutes,
      default_duration_minutes: s?.default_duration_minutes ?? DEFAULT_SCHEDULE_SETTINGS.default_duration_minutes,
      booking_lead_minutes: s?.booking_lead_minutes ?? DEFAULT_SCHEDULE_SETTINGS.booking_lead_minutes,
      booking_horizon_days: s?.booking_horizon_days ?? DEFAULT_SCHEDULE_SETTINGS.booking_horizon_days,
    },
  };
}

/**
 * Reemplaza el horario semanal y las excepciones del negocio, y actualiza los
 * settings de agenda. Estrategia "replace-all" (borra + inserta) por simplicidad
 * y consistencia: el editor manda siempre el estado completo.
 */
export async function saveBusinessSchedule(
  input: { hours: BusinessHourRow[]; exceptions: ScheduleExceptionRow[]; settings: BusinessScheduleSettings },
  businessId = getBusinessId()
): Promise<void> {
  const supabase = getSupabaseAdminClient();

  // Settings (la fila de business_settings ya existe para el negocio).
  await supabase
    .from("business_settings")
    .update({
      timezone: input.settings.timezone,
      slot_interval_minutes: input.settings.slot_interval_minutes,
      default_duration_minutes: input.settings.default_duration_minutes,
      booking_lead_minutes: input.settings.booking_lead_minutes,
      booking_horizon_days: input.settings.booking_horizon_days,
      updated_at: new Date().toISOString(),
    })
    .eq("business_id", businessId);

  // Horario semanal: replace-all.
  await supabase.from("business_hours").delete().eq("business_id", businessId);
  if (input.hours.length > 0) {
    await supabase.from("business_hours").insert(
      input.hours.map((h) => ({
        business_id: businessId,
        weekday: h.weekday,
        open_time: h.open_time,
        close_time: h.close_time,
      }))
    );
  }

  // Excepciones: replace-all.
  await supabase.from("schedule_exceptions").delete().eq("business_id", businessId);
  if (input.exceptions.length > 0) {
    await supabase.from("schedule_exceptions").insert(
      input.exceptions.map((e) => ({
        business_id: businessId,
        exception_date: e.exception_date,
        kind: e.kind,
        start_time: e.start_time,
        end_time: e.end_time,
        reason: e.reason.slice(0, 200),
      }))
    );
  }
}

export interface SlotCheckResult {
  /** Hay horarios estructurados cargados (si no, no se valida y no se bloquea). */
  configured: boolean;
  /** El horario pedido está dentro de horario y libre. */
  available: boolean;
  durationMinutes: number;
  endsAtISO: string | null;
  /** Hasta 3 horarios libres alternativos del mismo día (ISO UTC). */
  alternativesISO: string[];
  /** Mismas alternativas como etiqueta local "HH:MM" (para mostrarle al cliente). */
  alternativesLabels: string[];
  reason: "ok" | "not_configured" | "closed" | "outside_hours" | "occupied" | "past";
}

/**
 * Valida un horario propuesto contra el horario estructurado del negocio, las
 * excepciones y los turnos ya tomados. FUENTE DE VERDAD de la disponibilidad
 * (la IA nunca asume). Fail-open: si el negocio no cargó horarios, devuelve
 * configured=false / available=true para no bloquear el flujo actual.
 */
export async function checkSlotAvailability(
  startsAtISO: string,
  businessId = getBusinessId()
): Promise<SlotCheckResult> {
  const startsAt = new Date(startsAtISO);
  const schedule = await getBusinessSchedule(businessId);
  const tz = schedule.settings.timezone;
  const duration = schedule.settings.default_duration_minutes;
  const interval = schedule.settings.slot_interval_minutes;
  const lead = schedule.settings.booking_lead_minutes;

  const endsAtISO = Number.isNaN(startsAt.getTime())
    ? null
    : new Date(startsAt.getTime() + duration * 60_000).toISOString();

  if (schedule.hours.length === 0 || Number.isNaN(startsAt.getTime())) {
    return { configured: false, available: true, durationMinutes: duration, endsAtISO, alternativesISO: [], alternativesLabels: [], reason: "not_configured" };
  }

  const local = getZonedParts(startsAt, tz);
  const reqMin = local.minutes;

  const weekdayIntervals: TimeInterval[] = schedule.hours
    .filter((h) => h.weekday === local.weekday)
    .map((h) => ({ open: h.open_time, close: h.close_time }));

  const dayExceptions: DayException[] = schedule.exceptions
    .filter((e) => e.exception_date === local.dateStr)
    .map((e) => ({
      kind: e.kind,
      startMin: e.start_time ? parseHHMM(e.start_time) : null,
      endMin: e.end_time ? parseHHMM(e.end_time) : null,
    }));

  const dayStartUTC = zonedWallTimeToUTC(local.year, local.month, local.day, 0, tz);
  const dayEndUTC = new Date(dayStartUTC.getTime() + 24 * 60 * 60_000);
  const supabase = getSupabaseAdminClient();
  const { data: dayAppts } = await supabase
    .from("appointments")
    .select("starts_at, duration_minutes")
    .eq("business_id", businessId)
    .in("status", ["pending", "confirmed"])
    .gte("starts_at", dayStartUTC.toISOString())
    .lt("starts_at", dayEndUTC.toISOString());

  const busy: BusyRange[] = (dayAppts ?? [])
    .filter((a) => a.starts_at)
    .map((a) => {
      const p = getZonedParts(new Date(a.starts_at as string), tz);
      const dur = (a.duration_minutes as number | null) ?? duration;
      return { startMin: p.minutes, endMin: p.minutes + dur };
    });

  const nowParts = getZonedParts(new Date(), tz);
  const nowMinutesIfToday = nowParts.dateStr === local.dateStr ? nowParts.minutes : null;

  const slots = getAvailableSlots({
    weekdayIntervals,
    exceptions: dayExceptions,
    busy,
    config: { slotIntervalMinutes: interval, defaultDurationMinutes: duration, leadMinutes: lead },
    nowMinutesIfToday,
  });

  const reqHHMM = minutesToHHMM(reqMin);
  const available = slots.includes(reqHHMM);

  let reason: SlotCheckResult["reason"] = available ? "ok" : "occupied";
  if (!available) {
    if (dayExceptions.some((e) => e.kind === "closed") || weekdayIntervals.length === 0) reason = "closed";
    else if (nowMinutesIfToday != null && reqMin < nowMinutesIfToday + lead) reason = "past";
    else {
      const insideInterval = weekdayIntervals.some((iv) => {
        const o = parseHHMM(iv.open);
        const c = parseHHMM(iv.close);
        return o != null && c != null && reqMin >= o && reqMin + duration <= c;
      });
      reason = insideInterval ? "occupied" : "outside_hours";
    }
  }

  const alternativesLabels = slots.filter((s) => s !== reqHHMM).slice(0, 3);
  const alternativesISO = alternativesLabels.map((s) =>
    zonedWallTimeToUTC(local.year, local.month, local.day, parseHHMM(s) ?? 0, tz).toISOString()
  );

  return { configured: true, available, durationMinutes: duration, endsAtISO, alternativesISO, alternativesLabels, reason };
}

export interface AvailableSlot {
  label: string; // "HH:MM" local
  iso: string; // instante UTC del inicio
}

/**
 * Lista los horarios LIBRES de una fecha (YYYY-MM-DD en hora del negocio).
 * Para el reprogramado en el dashboard: el encargado elige un slot real en vez
 * de tipear la fecha. Devuelve configured=false si no hay horarios cargados.
 */
export async function listAvailableSlotsForDate(
  dateStr: string,
  businessId = getBusinessId()
): Promise<{ configured: boolean; slots: AvailableSlot[] }> {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) return { configured: false, slots: [] };
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);

  const schedule = await getBusinessSchedule(businessId);
  if (schedule.hours.length === 0) return { configured: false, slots: [] };
  const tz = schedule.settings.timezone;
  const duration = schedule.settings.default_duration_minutes;

  // Weekday local de la fecha (usamos el mediodía local para evitar bordes).
  const noonUTC = zonedWallTimeToUTC(year, month, day, 12 * 60, tz);
  const weekday = getZonedParts(noonUTC, tz).weekday;

  const weekdayIntervals: TimeInterval[] = schedule.hours
    .filter((h) => h.weekday === weekday)
    .map((h) => ({ open: h.open_time, close: h.close_time }));

  const dayExceptions: DayException[] = schedule.exceptions
    .filter((e) => e.exception_date === dateStr)
    .map((e) => ({
      kind: e.kind,
      startMin: e.start_time ? parseHHMM(e.start_time) : null,
      endMin: e.end_time ? parseHHMM(e.end_time) : null,
    }));

  const dayStartUTC = zonedWallTimeToUTC(year, month, day, 0, tz);
  const dayEndUTC = new Date(dayStartUTC.getTime() + 24 * 60 * 60_000);
  const supabase = getSupabaseAdminClient();
  const { data: dayAppts } = await supabase
    .from("appointments")
    .select("starts_at, duration_minutes")
    .eq("business_id", businessId)
    .in("status", ["pending", "confirmed"])
    .gte("starts_at", dayStartUTC.toISOString())
    .lt("starts_at", dayEndUTC.toISOString());

  const busy: BusyRange[] = (dayAppts ?? [])
    .filter((a) => a.starts_at)
    .map((a) => {
      const p = getZonedParts(new Date(a.starts_at as string), tz);
      const dur = (a.duration_minutes as number | null) ?? duration;
      return { startMin: p.minutes, endMin: p.minutes + dur };
    });

  const nowParts = getZonedParts(new Date(), tz);
  const nowMinutesIfToday = nowParts.dateStr === dateStr ? nowParts.minutes : null;

  const labels = getAvailableSlots({
    weekdayIntervals,
    exceptions: dayExceptions,
    busy,
    config: {
      slotIntervalMinutes: schedule.settings.slot_interval_minutes,
      defaultDurationMinutes: duration,
      leadMinutes: schedule.settings.booking_lead_minutes,
    },
    nowMinutesIfToday,
  });

  return {
    configured: true,
    slots: labels.map((label) => ({
      label,
      iso: zonedWallTimeToUTC(year, month, day, parseHHMM(label) ?? 0, tz).toISOString(),
    })),
  };
}
