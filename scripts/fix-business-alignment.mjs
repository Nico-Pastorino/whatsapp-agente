/**
 * fix-business-alignment.mjs
 *
 * Arregla la alineación entre el worker de Railway y el dashboard.
 *
 * Qué hace:
 *  1. Encuentra el business_id real del usuario desde business_members
 *  2. Inserta/actualiza la fila de whatsapp_sessions con instance_name correcto
 *  3. Muestra el BUSINESS_ID que hay que poner en Railway
 *
 * Cómo correr:
 *   node scripts/fix-business-alignment.mjs
 *
 * (Desde la carpeta raíz del proyecto, donde está el .env.local)
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ── Leer .env.local manualmente ───────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env.local");

function parseEnv(filePath) {
  const env = {};
  try {
    const content = readFileSync(filePath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
      env[key] = val;
    }
  } catch (e) {
    console.error("No se pudo leer .env.local:", e.message);
    process.exit(1);
  }
  return env;
}

const env = parseEnv(envPath);

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const WORKER_INSTANCE = env.WORKER_INSTANCE_NAME ?? "primary";
const USER_EMAIL = "nicopastorino52@gmail.com";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("╔════════════════════════════════════════════╗");
  console.log("║   fix-business-alignment — diagnóstico     ║");
  console.log("╚════════════════════════════════════════════╝\n");

  console.log(`WORKER_INSTANCE_NAME en .env.local → "${WORKER_INSTANCE}"\n`);

  // ── 1. Buscar usuario por email ───────────────────────────────────────────
  const { data: authUsers, error: authErr } = await supabase.auth.admin.listUsers();
  if (authErr) {
    console.error("❌ Error listando usuarios de Auth:", authErr.message);
    process.exit(1);
  }

  const authUser = authUsers.users.find(
    (u) => u.email?.toLowerCase() === USER_EMAIL.toLowerCase()
  );
  if (!authUser) {
    console.error(`❌ No se encontró usuario con email: ${USER_EMAIL}`);
    console.log("Usuarios existentes:");
    authUsers.users.forEach((u) => console.log(" -", u.email));
    process.exit(1);
  }

  console.log(`✅ Usuario encontrado: ${authUser.email} (id: ${authUser.id})`);

  // ── 2. Buscar business_id en business_members ─────────────────────────────
  const { data: members, error: memberErr } = await supabase
    .from("business_members")
    .select("business_id, role")
    .eq("user_id", authUser.id);

  if (memberErr) {
    console.error("❌ Error consultando business_members:", memberErr.message);
    process.exit(1);
  }

  if (!members || members.length === 0) {
    console.error("❌ No se encontró business_member para este usuario.");
    process.exit(1);
  }

  const ownerMember = members.find((m) => m.role === "owner") ?? members[0];
  const realBusinessId = ownerMember.business_id;

  console.log(`✅ Business ID real del usuario: ${realBusinessId}`);

  // ── 3. Estado actual de whatsapp_sessions ─────────────────────────────────
  console.log("\n── whatsapp_sessions actuales ──");
  const { data: sessions } = await supabase
    .from("whatsapp_sessions")
    .select("business_id, instance_name, status, updated_at")
    .order("updated_at", { ascending: false });

  (sessions ?? []).forEach((s) => {
    const marker =
      s.business_id === realBusinessId
        ? " ← USUARIO"
        : s.business_id === "b5f59a94-c300-4197-b8f2-e0d0d1192399"
          ? " ← BOOTSTRAP"
          : "";
    console.log(
      `  business_id: ${s.business_id}  instance: "${s.instance_name}"  status: ${s.status}${marker}`
    );
  });

  // ── 4. Verificar si la fila correcta ya existe ────────────────────────────
  const correctRowExists = (sessions ?? []).some(
    (s) => s.business_id === realBusinessId && s.instance_name === WORKER_INSTANCE
  );

  console.log(
    `\nFila (${realBusinessId}, "${WORKER_INSTANCE}") ya existe: ${correctRowExists ? "SÍ" : "NO"}`
  );

  // ── 5. Insertar/actualizar la fila correcta ───────────────────────────────
  const { error: upsertErr } = await supabase
    .from("whatsapp_sessions")
    .upsert(
      {
        business_id: realBusinessId,
        instance_name: WORKER_INSTANCE,
        status: "disconnected",
        desired_action: "none",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "business_id,instance_name" }
    );

  if (upsertErr) {
    console.error("❌ Error insertando fila de whatsapp_sessions:", upsertErr.message);
    // Intentar solo insert si hay conflicto de constraint
    const { error: insertErr } = await supabase.from("whatsapp_sessions").insert({
      business_id: realBusinessId,
      instance_name: WORKER_INSTANCE,
      status: "disconnected",
      desired_action: "none",
      updated_at: new Date().toISOString(),
    });
    if (insertErr) {
      console.error("❌ Error en insert también:", insertErr.message);
    } else {
      console.log(`✅ Fila insertada correctamente.`);
    }
  } else {
    console.log(`✅ Fila (${realBusinessId}, "${WORKER_INSTANCE}") creada/actualizada en whatsapp_sessions.`);
  }

  // ── 6. Verificar suscripción ──────────────────────────────────────────────
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan_code, status, trial_ends_at")
    .eq("business_id", realBusinessId)
    .maybeSingle();

  console.log("\n── Suscripción del usuario ──");
  if (sub) {
    console.log(`  plan: ${sub.plan_code}  status: ${sub.status}  trial_ends: ${sub.trial_ends_at}`);
  } else {
    console.warn("  ⚠️  No se encontró suscripción para este business_id");
  }

  // ── 7. Verificar planes ───────────────────────────────────────────────────
  const { data: plans } = await supabase
    .from("plans")
    .select("code, name, price_monthly, currency");

  console.log("\n── Planes disponibles ──");
  (plans ?? []).forEach((p) => {
    console.log(
      `  ${p.code}: ${p.name} — ${p.price_monthly} ${p.currency}${
        !p.price_monthly ? "  ⚠️ price_monthly es NULL" : ""
      }`
    );
  });

  // ── 8. Resumen final ──────────────────────────────────────────────────────
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║                     PASOS SIGUIENTES                      ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  const alreadyCorrect = realBusinessId === "b5f59a94-c300-4197-b8f2-e0d0d1192399";

  if (alreadyCorrect) {
    console.log("✅ El BUSINESS_ID del .env.local ya coincide con el usuario.");
    console.log("   Solo faltaba la fila de whatsapp_sessions (ya creada).");
    console.log("   → Ahora redesplegá el worker en Railway y el QR debería aparecer.");
  } else {
    console.log(
      `⚠️  El worker de Railway tiene BUSINESS_ID=b5f59a94-c300-4197-b8f2-e0d0d1192399`
    );
    console.log(`   pero tu usuario pertenece al business: ${realBusinessId}\n`);
    console.log("ACCIÓN REQUERIDA en Railway:");
    console.log("─────────────────────────────");
    console.log(`  Variable: BUSINESS_ID`);
    console.log(`  Nuevo valor: ${realBusinessId}`);
    console.log("\n  1. Andá a railway.app → tu proyecto → Variables");
    console.log(`  2. Cambiá BUSINESS_ID a: ${realBusinessId}`);
    console.log("  3. Redesplegá (Deploy)");
    console.log("\nEl worker va a escribir el QR en la fila correcta y el dashboard lo va a mostrar.");
  }

  // MercadoPago
  console.log("\n── MercadoPago ──");
  const hasMPToken = !!env.MERCADOPAGO_ACCESS_TOKEN;
  const hasAppUrl = !!env.NEXT_PUBLIC_APP_URL;
  console.log(
    `  MERCADOPAGO_ACCESS_TOKEN en .env.local: ${hasMPToken ? "✅ configurado" : "❌ FALTA"}`
  );
  console.log(
    `  NEXT_PUBLIC_APP_URL en .env.local: ${hasAppUrl ? "✅ " + env.NEXT_PUBLIC_APP_URL : "❌ FALTA"}`
  );
  if (!hasMPToken) {
    console.log("\n  → Para que el botón de pago funcione en Vercel, necesitás agregar:");
    console.log("    MERCADOPAGO_ACCESS_TOKEN=<tu token de MP>");
    console.log("    NEXT_PUBLIC_APP_URL=https://<tu-dominio>.vercel.app");
    console.log("    (En Vercel → Settings → Environment Variables)");
  }

  console.log("\n✅ Script completado.\n");
}

main().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
