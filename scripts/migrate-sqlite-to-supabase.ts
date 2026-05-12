import "./env-loader";
import { getBusinessId, getWorkerInstanceName } from "../src/lib/env";
import {
  getLegacyDb,
  type LegacyBusinessProfileRow,
  type LegacyConnectionStateRow,
  type LegacyConversationRow,
  type LegacyMessageRow,
  type LegacyOutboxRow,
} from "../src/lib/sqlite-legacy";
import { getSupabaseAdminClient } from "../src/lib/supabase";

interface LegacyProductItem {
  name: string;
  price: string;
  description: string;
}

function stableUuidFromLegacyInt(value: number): string {
  return `00000000-0000-4000-8000-${value.toString(16).padStart(12, "0")}`;
}

function fromUnix(seconds: number | null | undefined): string | null {
  if (!seconds) return null;
  return new Date(seconds * 1000).toISOString();
}

async function main(): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const sqlite = getLegacyDb();
  const businessId = getBusinessId();
  const instanceName = getWorkerInstanceName();

  const conversations = sqlite
    .prepare("SELECT * FROM conversations ORDER BY id ASC")
    .all() as LegacyConversationRow[];
  const messages = sqlite
    .prepare("SELECT * FROM messages ORDER BY id ASC")
    .all() as LegacyMessageRow[];
  const outbox = sqlite
    .prepare("SELECT * FROM outbox ORDER BY id ASC")
    .all() as LegacyOutboxRow[];
  const connectionState = sqlite
    .prepare("SELECT * FROM connection_state WHERE id = 1")
    .get() as LegacyConnectionStateRow | undefined;
  const businessProfile = sqlite
    .prepare("SELECT * FROM business_profile WHERE id = 1")
    .get() as LegacyBusinessProfileRow | undefined;

  const conversationIdMap = new Map<number, string>();

  const { error: businessError } = await supabase.from("businesses").upsert(
    {
      id: businessId,
      slug: `business-${businessId.slice(0, 8)}`,
      display_name: businessProfile?.name ?? "",
      updated_at: fromUnix(businessProfile?.updated_at) ?? new Date().toISOString(),
    },
    { onConflict: "id", ignoreDuplicates: false }
  );
  if (businessError) throw businessError;

  const { error: settingsError } = await supabase.from("business_settings").upsert(
    {
      business_id: businessId,
      description: businessProfile?.description ?? "",
      extra: businessProfile?.extra ?? "",
      updated_at: fromUnix(businessProfile?.updated_at) ?? new Date().toISOString(),
    },
    { onConflict: "business_id", ignoreDuplicates: false }
  );
  if (settingsError) throw settingsError;

  const parsedProducts = (() => {
    if (!businessProfile?.products) return [] as LegacyProductItem[];
    try {
      const json = JSON.parse(businessProfile.products);
      return Array.isArray(json) ? (json as LegacyProductItem[]) : [];
    } catch {
      return [];
    }
  })();

  const { error: deleteProductsError } = await supabase
    .from("products")
    .delete()
    .eq("business_id", businessId);
  if (deleteProductsError) throw deleteProductsError;

  if (parsedProducts.length > 0) {
    const { error: productsError } = await supabase.from("products").insert(
      parsedProducts.map((product, index) => ({
        id: stableUuidFromLegacyInt(index + 1),
        business_id: businessId,
        name: product.name,
        price_text: product.price ?? "",
        description: product.description ?? "",
        sort_order: index,
        created_at: fromUnix(businessProfile?.updated_at) ?? new Date().toISOString(),
        updated_at: fromUnix(businessProfile?.updated_at) ?? new Date().toISOString(),
      }))
    );
    if (productsError) throw productsError;
  }

  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const { error: subscriptionError } = await supabase.from("subscriptions").upsert(
    {
      business_id: businessId,
      plan_code: "growth",
      status: "trial",
      trial_started_at: now.toISOString(),
      trial_ends_at: trialEndsAt,
      current_period_start: now.toISOString(),
      current_period_end: trialEndsAt,
      updated_at: now.toISOString(),
    },
    { onConflict: "business_id", ignoreDuplicates: false }
  );
  if (subscriptionError) throw subscriptionError;

  for (const legacyConversation of conversations) {
    const { data, error } = await supabase
      .from("conversations")
      .upsert(
        {
          business_id: businessId,
          phone_jid: legacyConversation.phone,
          display_name: legacyConversation.name,
          mode: legacyConversation.mode,
          last_message_at: fromUnix(legacyConversation.last_message_at),
          created_at: fromUnix(legacyConversation.created_at) ?? new Date().toISOString(),
          updated_at: fromUnix(legacyConversation.last_message_at ?? legacyConversation.created_at) ?? new Date().toISOString(),
        },
        {
          onConflict: "business_id,phone_jid",
          ignoreDuplicates: false,
        }
      )
      .select("id")
      .single();

    if (error) throw error;
    conversationIdMap.set(legacyConversation.id, data.id);
  }

  if (messages.length > 0) {
    const { error: messagesError } = await supabase.from("messages").upsert(
      messages
        .filter((message) => conversationIdMap.has(message.conversation_id))
        .map((message) => ({
          id: stableUuidFromLegacyInt(message.id),
          business_id: businessId,
          conversation_id: conversationIdMap.get(message.conversation_id)!,
          role: message.role,
          content: message.content,
          created_at: fromUnix(message.created_at) ?? new Date().toISOString(),
        })),
      {
        onConflict: "id",
        ignoreDuplicates: false,
      }
    );
    if (messagesError) throw messagesError;
  }

  if (outbox.length > 0) {
    const { error: outboxError } = await supabase.from("outbox_messages").upsert(
      outbox
        .filter((item) => conversationIdMap.has(item.conversation_id))
        .map((item) => ({
          id: stableUuidFromLegacyInt(item.id),
          business_id: businessId,
          conversation_id: conversationIdMap.get(item.conversation_id)!,
          phone_jid: item.phone,
          content: item.content,
          sent: item.sent === 1,
          sent_at: item.sent === 1 ? fromUnix(item.created_at) : null,
          created_at: fromUnix(item.created_at) ?? new Date().toISOString(),
        })),
      {
        onConflict: "id",
        ignoreDuplicates: false,
      }
    );
    if (outboxError) throw outboxError;
  }

  const { error: sessionError } = await supabase.from("whatsapp_sessions").upsert(
    {
      business_id: businessId,
      instance_name: instanceName,
      status: connectionState?.status ?? "disconnected",
      qr_string: connectionState?.qr_string ?? null,
      phone: connectionState?.phone ?? null,
      desired_action: "none",
      updated_at: fromUnix(connectionState?.updated_at) ?? new Date().toISOString(),
      last_seen_at: null,
    },
    {
      onConflict: "business_id,instance_name",
      ignoreDuplicates: false,
    }
  );
  if (sessionError) throw sessionError;

  console.log(
    `[backfill] Migración completada: ${conversations.length} conversaciones, ${messages.length} mensajes, ${outbox.length} outbox`
  );
}

main().catch((error) => {
  console.error("[backfill] Error:", error);
  process.exit(1);
});
