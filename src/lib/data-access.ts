import { randomUUID } from "node:crypto";
import { getBusinessId, getWorkerInstanceName } from "./env";
import { getSupabaseAdminClient } from "./supabase";
import { normalizeWhatsAppJid } from "./whatsapp-jid";

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

function mapConversationRow(row: {
  id: string;
  phone_jid: string;
  display_name: string | null;
  mode: "AI" | "HUMAN";
  last_message_at: string | null;
  created_at: string;
}): Conversation {
  return {
    id: row.id,
    phone: row.phone_jid,
    name: row.display_name,
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

  const [{ data: business, error: businessError }, { data: settings, error: settingsError }, { data: products, error: productsError }] =
    await Promise.all([
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

export async function getOrCreateConversation(
  phone: string,
  name?: string
): Promise<Conversation> {
  await ensureBusinessBootstrap();

  // Normalización defensiva: garantiza JID canónico sin sufijo de dispositivo (:N)
  const phoneJid = normalizeWhatsAppJid(phone);

  const supabase = getSupabaseAdminClient();
  const businessId = getBusinessId();
  const now = new Date().toISOString();

  // Intentar INSERT directo. Si hay violación de unique constraint (código 23505)
  // significa que la conversación ya existe (race condition entre dos mensajes
  // simultáneos) — en ese caso hacemos SELECT.
  const { data: created, error: insertError } = await supabase
    .from("conversations")
    .insert({
      business_id: businessId,
      phone_jid: phoneJid,
      display_name: name ?? null,
      mode: "AI",
      created_at: now,
      updated_at: now,
    })
    .select("id, phone_jid, display_name, mode, last_message_at, created_at")
    .maybeSingle();

  if (!insertError && created) {
    console.log(`[db] conversación CREADA: ${phoneJid} → ${created.id}`);
    return mapConversationRow(created);
  }

  // Fila ya existe (unique constraint) o cualquier otro error — buscar por JID
  const { data: existing, error: fetchError } = await supabase
    .from("conversations")
    .select("id, phone_jid, display_name, mode, last_message_at, created_at")
    .eq("business_id", businessId)
    .eq("phone_jid", phoneJid)
    .maybeSingle();

  if (fetchError) throw fetchError;

  if (existing) {
    console.log(`[db] conversación EXISTENTE: ${phoneJid} → ${existing.id}`);
    // Actualizar display_name si cambió
    if (name && name !== existing.display_name) {
      await supabase
        .from("conversations")
        .update({ display_name: name, updated_at: now })
        .eq("id", existing.id);
      existing.display_name = name;
    }
    return mapConversationRow(existing);
  }

  // Si llegamos aquí con un error de insert y no encontramos la fila, propagar
  if (insertError) throw insertError;
  throw new Error(`getOrCreateConversation: no se pudo crear ni encontrar conversación para ${phoneJid}`);
}

export async function getConversationById(id: string): Promise<Conversation | null> {
  await ensureBusinessBootstrap();

  const supabase = getSupabaseAdminClient();
  const businessId = getBusinessId();

  const { data, error } = await supabase
    .from("conversations")
    .select("id, phone_jid, display_name, mode, last_message_at, created_at")
    .eq("business_id", businessId)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data ? mapConversationRow(data) : null;
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
    .select("id, phone_jid, display_name, mode, last_message_at, created_at")
    .eq("business_id", businessId)
    .not("phone_jid", "is", null)       // ignorar filas sin JID (datos huérfanos)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (conversationsError) throw conversationsError;

  const mapped = (conversations ?? []).map(mapConversationRow);
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

  // Deduplicar por número canónico: si hay dos conversaciones del mismo contacto
  // (ej: una con :5@s.whatsapp.net y otra sin sufijo), conservar la más reciente.
  const deduped = new Map<string, ConversationWithPreview>();
  for (const conv of previews) {
    const canonical = normalizeWhatsAppJid(conv.phone);
    const existing = deduped.get(canonical);
    const convTime = conv.last_message_at ?? conv.created_at ?? 0;
    const existingTime = existing
      ? existing.last_message_at ?? existing.created_at ?? 0
      : -1;
    if (!existing || convTime > existingTime) {
      deduped.set(canonical, conv);
    }
  }

  return [...deduped.values()].sort((a, b) => {
    const ta = a.last_message_at ?? a.created_at ?? 0;
    const tb = b.last_message_at ?? b.created_at ?? 0;
    return tb > ta ? 1 : tb < ta ? -1 : 0;
  });
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
  phone: string,
  content: string
): Promise<void> {
  await ensureBusinessBootstrap();

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("outbox_messages").insert({
    business_id: getBusinessId(),
    conversation_id: conversationId,
    phone_jid: phone,
    content,
  });

  if (error) throw error;
}

export async function getPendingOutbox(limit = 20): Promise<OutboxItem[]> {
  await ensureBusinessBootstrap();

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("outbox_messages")
    .select("id, conversation_id, phone_jid, content, sent, created_at")
    .eq("business_id", getBusinessId())
    .eq("sent", false)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    conversation_id: row.conversation_id,
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
