/**
 * Bootstrap inicial de Supabase.
 *
 * Qué hace:
 *  1. Verifica que las variables de entorno mínimas estén seteadas.
 *  2. Si BUSINESS_ID no existe en .env.local, genera uno y lo agrega.
 *  3. Crea (o confirma) el negocio, settings, suscripción y sesión de WhatsApp.
 *  4. Imprime el BUSINESS_ID para que lo copies a tus variables de entorno.
 *
 * Uso:
 *  npm run bootstrap:supabase
 */

import "./env-loader";
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

// ---- helpers ----

function readEnv(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

function requireEnv(name: string): string {
  const val = readEnv(name);
  if (!val) {
    console.error(`\n❌ Falta variable de entorno: ${name}`);
    console.error(`   Completala en tu .env.local y volvé a correr este script.\n`);
    process.exit(1);
  }
  return val;
}

// ---- verificar entorno ----

const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const instanceName = readEnv("WORKER_INSTANCE_NAME") ?? "main";

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---- generar o leer BUSINESS_ID ----

const envPath = path.resolve(process.cwd(), ".env.local");

function ensureBusinessIdInEnv(): string {
  const existing = readEnv("BUSINESS_ID");
  if (existing) return existing;

  const newId = randomUUID();
  const envContent = fs.existsSync(envPath)
    ? fs.readFileSync(envPath, "utf-8")
    : "";
  const line = `BUSINESS_ID=${newId}`;
  fs.writeFileSync(
    envPath,
    envContent.trimEnd() + (envContent.trim() ? "\n" : "") + line + "\n"
  );
  process.env.BUSINESS_ID = newId;
  console.log(`\n✅ BUSINESS_ID generado: ${newId}`);
  console.log(`   Ya fue agregado a .env.local automáticamente.\n`);
  return newId;
}

const businessId = ensureBusinessIdInEnv();

// ---- bootstrap ----

async function run(): Promise<void> {
  const now = new Date().toISOString();
  const slug = `business-${businessId.slice(0, 8)}`;

  console.log(`\n🚀 Iniciando bootstrap para BUSINESS_ID=${businessId}`);
  console.log(`   WORKER_INSTANCE_NAME=${instanceName}\n`);

  // 1. businesses
  const { error: bizErr } = await supabase.from("businesses").upsert(
    { id: businessId, slug, display_name: "", updated_at: now },
    { onConflict: "id", ignoreDuplicates: true }
  );
  if (bizErr) throw new Error(`businesses: ${bizErr.message}`);
  console.log("  ✓ businesses");

  // 2. business_settings
  const { error: settingsErr } = await supabase.from("business_settings").upsert(
    {
      business_id: businessId,
      description: "",
      extra: "",
      system_prompt_override: "",
      updated_at: now,
    },
    { onConflict: "business_id", ignoreDuplicates: true }
  );
  if (settingsErr) throw new Error(`business_settings: ${settingsErr.message}`);
  console.log("  ✓ business_settings");

  // 3. subscriptions
  const { error: subErr } = await supabase.from("subscriptions").upsert(
    {
      business_id: businessId,
      plan_code: "starter",
      status: "active",
      updated_at: now,
    },
    { onConflict: "business_id", ignoreDuplicates: true }
  );
  if (subErr) throw new Error(`subscriptions: ${subErr.message}`);
  console.log("  ✓ subscriptions (plan: starter, status: active)");

  // 4. whatsapp_sessions
  const { error: sessionErr } = await supabase.from("whatsapp_sessions").upsert(
    {
      business_id: businessId,
      instance_name: instanceName,
      status: "disconnected",
      desired_action: "none",
      updated_at: now,
    },
    { onConflict: "business_id,instance_name", ignoreDuplicates: true }
  );
  if (sessionErr) throw new Error(`whatsapp_sessions: ${sessionErr.message}`);
  console.log(`  ✓ whatsapp_sessions (instance: ${instanceName})`);

  // 5. Verificar que todo se creó correctamente
  const { data: session, error: checkErr } = await supabase
    .from("whatsapp_sessions")
    .select("id, status, instance_name")
    .eq("business_id", businessId)
    .eq("instance_name", instanceName)
    .single();

  if (checkErr || !session) {
    throw new Error(
      `No se pudo verificar la sesión creada: ${checkErr?.message ?? "sin datos"}`
    );
  }

  console.log(`\n✅ Bootstrap completo.\n`);
  console.log(`   BUSINESS_ID       = ${businessId}`);
  console.log(`   WORKER_INSTANCE   = ${session.instance_name}`);
  console.log(`   WhatsApp status   = ${session.status}`);
  console.log(`\nPróximos pasos:`);
  console.log(`  1. Asegurate de que BUSINESS_ID esté en .env.local (ya está si lo generó este script)`);
  console.log(`  2. Corré: npm run dev:worker`);
  console.log(`  3. Corré: npm run dev`);
  console.log(`  4. Abrí http://localhost:3000 y escaneá el QR\n`);
}

run().catch((err) => {
  console.error("\n❌ Error durante bootstrap:", err.message ?? err);
  process.exit(1);
});
