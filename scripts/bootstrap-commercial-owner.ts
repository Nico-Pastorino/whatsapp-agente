import "./env-loader";

import { createClient, type User } from "@supabase/supabase-js";

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function normalizeUrl(raw: string): string {
  try {
    const url = new URL(raw);
    return `${url.protocol}//${url.host}`;
  } catch {
    return raw;
  }
}

function requireEnv(name: string): string {
  const value = readEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  if (local.length <= 2) return `${local[0] ?? "*"}***@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
}

async function findUserByEmail(email: string): Promise<User | null> {
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

const supabaseUrl = normalizeUrl(requireEnv("NEXT_PUBLIC_SUPABASE_URL"));
const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const ownerEmail = requireEnv("OWNER_EMAIL").toLowerCase();
const ownerPassword = requireEnv("OWNER_PASSWORD");
const businessName = requireEnv("BUSINESS_NAME");
const businessSlug = requireEnv("BUSINESS_SLUG");
const loginUrl = `${readEnv("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3000"}/login`;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function ensureUser(): Promise<User> {
  const existing = await findUserByEmail(ownerEmail);
  if (existing) {
    const { data, error } = await supabase.auth.admin.updateUserById(existing.id, {
      email: ownerEmail,
      password: ownerPassword,
      email_confirm: true,
      user_metadata: {
        full_name: businessName,
      },
    });
    if (error || !data.user) throw error ?? new Error("No se pudo actualizar el owner.");
    return data.user;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: ownerEmail,
    password: ownerPassword,
    email_confirm: true,
    user_metadata: {
      full_name: businessName,
    },
  });

  if (error || !data.user) throw error ?? new Error("No se pudo crear el owner.");
  return data.user;
}

async function ensureBusiness() {
  const { data: existing, error: selectError } = await supabase
    .from("businesses")
    .select("id")
    .eq("slug", businessSlug)
    .maybeSingle();

  if (selectError) throw selectError;

  if (existing?.id) {
    const { data, error } = await supabase
      .from("businesses")
      .update({
        display_name: businessName,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("id, slug, display_name")
      .single();
    if (error || !data) throw error ?? new Error("No se pudo actualizar el negocio.");
    return data;
  }

  const { data, error } = await supabase
    .from("businesses")
    .insert({
      slug: businessSlug,
      display_name: businessName,
    })
    .select("id, slug, display_name")
    .single();

  if (error || !data) throw error ?? new Error("No se pudo crear el negocio.");
  return data;
}

async function run() {
  console.log("\n[bootstrap:owner] Iniciando bootstrap comercial\n");
  console.log(`[bootstrap:owner] Supabase URL: ${supabaseUrl}`);
  console.log(`[bootstrap:owner] Owner email: ${maskEmail(ownerEmail)}`);
  console.log(`[bootstrap:owner] Business slug: ${businessSlug}`);

  const { error: pingError } = await supabase.from("businesses").select("id").limit(1);
  if (pingError) {
    throw new Error(
      `No se pudo consultar Supabase. Verificá que ya corriste supabase/schema.sql. Detalle: ${pingError.message}`
    );
  }

  const user = await ensureUser();
  console.log(`[bootstrap:owner] Owner listo: ${user.id}`);

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      email: ownerEmail,
      full_name: businessName,
    },
    { onConflict: "id", ignoreDuplicates: false }
  );
  if (profileError) throw profileError;
  console.log("[bootstrap:owner] Profile listo");

  const business = await ensureBusiness();
  console.log(`[bootstrap:owner] Business listo: ${business.id}`);

  const { error: settingsError } = await supabase.from("business_settings").upsert(
    {
      business_id: business.id,
      description: "",
      extra: "",
      system_prompt_override: "",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "business_id", ignoreDuplicates: false }
  );
  if (settingsError) throw settingsError;

  const { error: memberError } = await supabase.from("business_members").upsert(
    {
      business_id: business.id,
      user_id: user.id,
      role: "owner",
    },
    { onConflict: "business_id,user_id", ignoreDuplicates: false }
  );
  if (memberError) throw memberError;
  console.log("[bootstrap:owner] Membership owner listo");

  const periodStart = new Date();
  const periodEnd = new Date(periodStart);
  periodEnd.setDate(periodEnd.getDate() + 14);

  const { error: subscriptionError } = await supabase.from("subscriptions").upsert(
    {
      business_id: business.id,
      plan_code: "growth",
      status: "trial",
      trial_started_at: periodStart.toISOString(),
      trial_ends_at: periodEnd.toISOString(),
      current_period_start: periodStart.toISOString(),
      current_period_end: periodEnd.toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "business_id", ignoreDuplicates: false }
  );
  if (subscriptionError) throw subscriptionError;
  console.log("[bootstrap:owner] Subscription inicial lista");

  const { error: sessionError } = await supabase.from("whatsapp_sessions").upsert(
    {
      business_id: business.id,
      instance_name: "main",
      status: "disconnected",
      desired_action: "none",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "business_id,instance_name", ignoreDuplicates: false }
  );
  if (sessionError) throw sessionError;
  console.log("[bootstrap:owner] WhatsApp session lista");

  console.log("\n✅ Bootstrap comercial completo\n");
  console.log(`user_id: ${user.id}`);
  console.log(`business_id: ${business.id}`);
  console.log(`email: ${ownerEmail}`);
  console.log(`login_url: ${loginUrl}`);
  console.log("");
}

run().catch((error) => {
  console.error("\n❌ Error en bootstrap:owner");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
