/**
 * Seed / actualizar los planes en Supabase.
 *
 * Idempotente: usa ON CONFLICT DO UPDATE, se puede correr varias veces.
 *
 * Uso:
 *   npm run seed:plans
 */

import "./env-loader";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const plans = [
  {
    code: "starter",
    name: "Starter",
    price_monthly: 49000,
    currency: "ARS",
    conversation_limit: 500,
    ai_reply_limit: 500,
    product_limit: 20,
    users_limit: 1,
    whatsapp_numbers_limit: 1,
    features: { shared_inbox: true, ai_assistant: true, human_handoff: true },
  },
  {
    code: "pro",
    name: "Pro",
    price_monthly: 99000,
    currency: "ARS",
    conversation_limit: 2000,
    ai_reply_limit: 2000,
    product_limit: 100,
    users_limit: 3,
    whatsapp_numbers_limit: 1,
    features: {
      shared_inbox: true,
      ai_assistant: true,
      human_handoff: true,
      usage_visibility: true,
    },
  },
  {
    code: "premium",
    name: "Premium",
    price_monthly: 199000,
    currency: "ARS",
    conversation_limit: 5000,
    ai_reply_limit: 5000,
    product_limit: 500,
    users_limit: 10,
    whatsapp_numbers_limit: 3,
    features: {
      shared_inbox: true,
      ai_assistant: true,
      human_handoff: true,
      usage_visibility: true,
      priority_support: true,
    },
  },
];

async function run() {
  console.log("Seeding plans...\n");
  for (const plan of plans) {
    const { error } = await supabase.from("plans").upsert(plan, { onConflict: "code" });
    if (error) {
      console.error(`❌ Error seeding plan "${plan.code}":`, error.message);
    } else {
      console.log(`✓ ${plan.name} — ARS ${plan.price_monthly.toLocaleString("es-AR")}`);
    }
  }
  console.log("\nDone.");
}

run().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
