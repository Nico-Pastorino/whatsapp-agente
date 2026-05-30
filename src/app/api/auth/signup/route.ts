import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { createAppSessionToken, getSessionCookieOptions } from "@/lib/app-session";
import { ACTIVE_BUSINESS_COOKIE, APP_SESSION_COOKIE } from "@/lib/app-session-shared";

const VALID_PLANS = new Set(["starter", "growth", "pro"]);
// El trial de 14 días usa el plan Growth para que el usuario experimente el valor
// completo de la plataforma: agenda, base de conocimiento, avisos, plantillas
// comerciales y catálogo amplio. Al vencer el trial, elige el plan a pagar
// (Starter, Growth o Pro). Sin Growth trial → conversión más baja.
const TRIAL_PLAN_CODE = "growth";
const TRIAL_DAYS = 14;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  const fullName: string = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const email: string = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password: string = typeof body.password === "string" ? body.password : "";
  const businessName: string = typeof body.businessName === "string" ? body.businessName.trim() : "";
  const requestedPlanCode: string = typeof body.planCode === "string" ? body.planCode.trim() : "";
  const planCode = TRIAL_PLAN_CODE;

  if (!fullName || !email || !password || !businessName) {
    return NextResponse.json({ error: "Todos los campos son obligatorios." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres." }, { status: 400 });
  }
  if (requestedPlanCode && !VALID_PLANS.has(requestedPlanCode)) {
    return NextResponse.json({ error: "Plan no válido." }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();

  // Verify plan exists
  const { data: plan, error: planError } = await supabase
    .from("plans")
    .select("code, name, price_monthly, currency")
    .eq("code", planCode)
    .maybeSingle();
  if (planError || !plan) {
    return NextResponse.json({ error: "Plan no encontrado." }, { status: 400 });
  }

  // Create Supabase Auth user (email confirmed immediately, no verification email)
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (authError || !authData.user) {
    if (authError?.message?.includes("already registered") || authError?.code === "email_exists") {
      return NextResponse.json({ error: "Este email ya tiene una cuenta. Iniciá sesión." }, { status: 409 });
    }
    console.error("[signup] auth error:", authError);
    return NextResponse.json({ error: "No se pudo crear la cuenta." }, { status: 500 });
  }

  const userId = authData.user.id;
  const businessId = randomUUID();
  const slug = `${slugify(businessName)}-${businessId.slice(0, 8)}`;
  const nowDate = new Date();
  const trialEndDate = new Date(nowDate.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  const now = nowDate.toISOString();
  const trialEndsAt = trialEndDate.toISOString();

  try {
    // Profile
    await supabase.from("profiles").insert({ id: userId, email, full_name: fullName });

    // Business
    await supabase.from("businesses").insert({
      id: businessId,
      slug,
      display_name: businessName,
      updated_at: now,
    });
    console.log(`[signup] business created business_id=${businessId}`);

    // Business settings
    await supabase.from("business_settings").insert({
      business_id: businessId,
      description: "",
      extra: "",
      system_prompt_override: "",
      updated_at: now,
    });
    console.log(`[signup] business_settings created business_id=${businessId}`);

    // Business member (owner)
    await supabase.from("business_members").insert({
      business_id: businessId,
      user_id: userId,
      role: "owner",
    });

    // New businesses always start on a 14-day Starter trial. Paid activation
    // (incluyendo upgrades a Growth/Pro) ocurre únicamente vía webhooks de
    // Mercado Pago al aprobarse la suscripción.
    await supabase.from("subscriptions").insert({
      business_id: businessId,
      plan_code: planCode,
      status: "trial",
      trial_started_at: now,
      trial_ends_at: trialEndsAt,
      current_period_start: now,
      current_period_end: trialEndsAt,
      updated_at: now,
    });
    console.log(`[signup] subscription trial created business_id=${businessId} plan=${planCode} trial_ends_at=${trialEndsAt}`);

    // WhatsApp session placeholder
    // instance_name must match WORKER_INSTANCE_NAME so status/QR queries find the right row
    const workerInstanceName = process.env.WORKER_INSTANCE_NAME ?? "main";
    await supabase.from("whatsapp_sessions").insert({
      business_id: businessId,
      instance_name: workerInstanceName,
      status: "disconnected",
      desired_action: "none",
      updated_at: now,
    });
  } catch (err) {
    // Rollback auth user if anything fails
    await supabase.auth.admin.deleteUser(userId).catch(() => undefined);
    console.error("[signup] setup error:", err);
    return NextResponse.json({ error: "Error al configurar la cuenta. Intentá de nuevo." }, { status: 500 });
  }

  // Issue session cookie immediately so the user lands on /app/plan logged in
  const token = createAppSessionToken({ sub: userId, email, fullName });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(APP_SESSION_COOKIE, token, getSessionCookieOptions());
  response.cookies.set(ACTIVE_BUSINESS_COOKIE, businessId, getSessionCookieOptions());
  return response;
}
