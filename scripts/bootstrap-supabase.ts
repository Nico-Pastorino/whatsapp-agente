/**
 * Bootstrap inicial de Supabase.
 * Uso: npm run bootstrap:supabase
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

function maskKey(val: string): string {
  if (val.length <= 12) return "***";
  return val.slice(0, 6) + "..." + val.slice(-4);
}

function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    return `${u.protocol}//${u.host}`;
  } catch {
    return raw;
  }
}

// ---- validación de entorno ----

function validateEnv(): {
  supabaseUrl: string;
  serviceRoleKey: string;
  instanceName: string;
} {
  console.log("\n🔍 Verificando variables de entorno...\n");

  const errors: string[] = [];

  // NEXT_PUBLIC_SUPABASE_URL
  const rawUrl = readEnv("NEXT_PUBLIC_SUPABASE_URL");
  console.log(`  NEXT_PUBLIC_SUPABASE_URL`);
  if (!rawUrl) {
    console.log(`    ❌ No está definida`);
    errors.push("NEXT_PUBLIC_SUPABASE_URL no está definida");
  } else if (rawUrl.includes("TU_PROYECTO") || rawUrl.includes("placeholder")) {
    console.log(`    ❌ Tiene valor de placeholder: "${rawUrl}"`);
    errors.push("NEXT_PUBLIC_SUPABASE_URL tiene valor de placeholder");
  } else if (!rawUrl.startsWith("https://")) {
    console.log(`    ❌ No empieza con https://: "${rawUrl}"`);
    errors.push("NEXT_PUBLIC_SUPABASE_URL debe empezar con https://");
  } else if (!rawUrl.includes("supabase.co")) {
    console.log(`    ❌ No contiene supabase.co: "${rawUrl}"`);
    errors.push("NEXT_PUBLIC_SUPABASE_URL no parece una URL de Supabase");
  } else {
    const normalized = normalizeUrl(rawUrl);
    if (rawUrl !== normalized) {
      console.log(`    ⚠️  Tenía path extra — usando solo el dominio: "${normalized}"`);
    } else {
      console.log(`    ✓ ${normalized}`);
    }
  }

  // SUPABASE_SERVICE_ROLE_KEY
  const serviceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  console.log(`  SUPABASE_SERVICE_ROLE_KEY`);
  if (!serviceRoleKey) {
    console.log(`    ❌ No está definida`);
    errors.push("SUPABASE_SERVICE_ROLE_KEY no está definida");
  } else if (serviceRoleKey.includes("TU_SERVICE") || serviceRoleKey.includes("placeholder")) {
    console.log(`    ❌ Tiene valor de placeholder`);
    errors.push("SUPABASE_SERVICE_ROLE_KEY tiene valor de placeholder");
  } else {
    const parts = serviceRoleKey.split(".");
    if (parts.length !== 3) {
      console.log(
        `    ❌ Formato de JWT inválido (tiene ${parts.length} partes, debe tener 3)\n` +
        `       Verificá que no tenga texto extra pegado al final (ej: "SERVICE_ROLE_KEY")`
      );
      errors.push(
        `SUPABASE_SERVICE_ROLE_KEY tiene formato inválido (${parts.length} partes). ` +
        `Copiá la key desde Supabase → Settings → API → service_role y pegala sin texto extra.`
      );
    } else {
      console.log(`    ✓ JWT válido (${maskKey(serviceRoleKey)})`);
    }
  }

  // BUSINESS_ID
  const businessId = readEnv("BUSINESS_ID");
  console.log(`  BUSINESS_ID`);
  if (businessId) {
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRe.test(businessId)) {
      console.log(`    ❌ No es un UUID válido: "${businessId}"`);
      errors.push("BUSINESS_ID no tiene formato UUID válido");
    } else {
      console.log(`    ✓ ${businessId}`);
    }
  } else {
    console.log(`    ℹ️  No definido — se generará uno nuevo`);
  }

  // WORKER_INSTANCE_NAME
  const instanceName = readEnv("WORKER_INSTANCE_NAME") ?? "main";
  console.log(`  WORKER_INSTANCE_NAME`);
  console.log(`    ✓ ${instanceName}`);

  if (errors.length > 0) {
    console.log("\n❌ Errores encontrados:\n");
    errors.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
    console.log("\n  Corregí los errores en .env.local y volvé a correr este script.\n");
    process.exit(1);
  }

  console.log("\n✓ Variables de entorno OK\n");

  return {
    supabaseUrl: normalizeUrl(rawUrl!),
    serviceRoleKey: serviceRoleKey!,
    instanceName,
  };
}

// ---- main ----

const { supabaseUrl, serviceRoleKey, instanceName } = validateEnv();

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log(`  Conectando a: ${supabaseUrl}`);

// ---- BUSINESS_ID ----

const envPath = path.resolve(process.cwd(), ".env.local");

function ensureBusinessId(): string {
  const existing = readEnv("BUSINESS_ID");
  if (existing) return existing;

  const newId = randomUUID();
  const content = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : "";
  fs.writeFileSync(
    envPath,
    content.trimEnd() + (content.trim() ? "\n" : "") + `BUSINESS_ID=${newId}\n`
  );
  process.env.BUSINESS_ID = newId;
  console.log(`  ✅ BUSINESS_ID generado: ${newId} (guardado en .env.local)`);
  return newId;
}

const businessId = ensureBusinessId();

// ---- bootstrap ----

async function run(): Promise<void> {
  const now = new Date().toISOString();
  const slug = `business-${businessId.slice(0, 8)}`;

  console.log(`\n🚀 Bootstrap — BUSINESS_ID=${businessId}, instance=${instanceName}\n`);

  // Verificar conexión con un ping simple
  const { error: pingErr } = await supabase
    .from("businesses")
    .select("id")
    .limit(1);

  if (pingErr) {
    // Distinguir entre tabla inexistente vs error de conexión
    if (pingErr.message?.includes("relation") || pingErr.code === "42P01") {
      console.error(
        "\n❌ La tabla 'businesses' no existe en Supabase.\n" +
        "   Ejecutá el schema primero:\n" +
        "   → Supabase Dashboard → SQL Editor → pegá supabase/schema.sql → Run\n"
      );
    } else {
      console.error(
        "\n❌ Error de conexión con Supabase:\n" +
        `   ${pingErr.message}\n\n` +
        `   URL usada: ${supabaseUrl}\n` +
        `   Verificá que la URL y la service role key sean correctas.\n`
      );
    }
    process.exit(1);
  }

  // 1. businesses
  const { error: bizErr } = await supabase.from("businesses").upsert(
    { id: businessId, slug, display_name: "", updated_at: now },
    { onConflict: "id", ignoreDuplicates: true }
  );
  if (bizErr) throw new Error(`businesses: ${bizErr.message}`);
  console.log("  ✓ businesses");

  // 2. business_settings
  const { error: settingsErr } = await supabase.from("business_settings").upsert(
    { business_id: businessId, description: "", extra: "", system_prompt_override: "", updated_at: now },
    { onConflict: "business_id", ignoreDuplicates: true }
  );
  if (settingsErr) throw new Error(`business_settings: ${settingsErr.message}`);
  console.log("  ✓ business_settings");

  // 3. subscriptions
  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const { error: subErr } = await supabase.from("subscriptions").upsert(
    {
      business_id: businessId,
      plan_code: "growth",
      status: "trial",
      trial_started_at: now,
      trial_ends_at: trialEndsAt,
      current_period_start: now,
      current_period_end: trialEndsAt,
      updated_at: now,
    },
    { onConflict: "business_id", ignoreDuplicates: true }
  );
  if (subErr) throw new Error(`subscriptions: ${subErr.message}`);
  console.log("  ✓ subscriptions (growth / trial 14 días)");

  // 4. whatsapp_sessions
  const { error: sessionErr } = await supabase.from("whatsapp_sessions").upsert(
    { business_id: businessId, instance_name: instanceName, status: "disconnected", desired_action: "none", updated_at: now },
    { onConflict: "business_id,instance_name", ignoreDuplicates: true }
  );
  if (sessionErr) throw new Error(`whatsapp_sessions: ${sessionErr.message}`);
  console.log(`  ✓ whatsapp_sessions (instance: ${instanceName})`);

  // Verificación final
  const { data: session, error: checkErr } = await supabase
    .from("whatsapp_sessions")
    .select("id, status, instance_name")
    .eq("business_id", businessId)
    .eq("instance_name", instanceName)
    .single();

  if (checkErr || !session) {
    throw new Error(`No se pudo verificar la sesión: ${checkErr?.message ?? "sin datos"}`);
  }

  console.log(`\n✅ Bootstrap completo.\n`);
  console.log(`   BUSINESS_ID     = ${businessId}`);
  console.log(`   INSTANCE        = ${session.instance_name}`);
  console.log(`   WhatsApp status = ${session.status}`);
  console.log(`\nPróximos pasos:`);
  console.log(`  1. npm run dev:worker   (en una terminal)`);
  console.log(`  2. npm run dev          (en otra terminal)`);
  console.log(`  3. Abrir http://localhost:3000 y escanear el QR\n`);
}

run().catch((err) => {
  console.error("\n❌ Error durante bootstrap:", err.message ?? err);
  process.exit(1);
});
