import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { createAppSessionToken, getSessionCookieOptions } from "@/lib/app-session";
import { APP_SESSION_COOKIE } from "@/lib/app-session-shared";

const VALID_PLANS = new Set(["starter", "pro", "premium"]);

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
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
  const planCode: string = typeof body.planCode === "string" ? body.planCode.trim() : "";

  if (!fullName || !email || !password || !businessName || !planCode) {
    return NextResponse.json({ error: "Todos los campos son obligatorios." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres." }, { status: 400 });
  }
  if (!VALID_PLANS.has(planCode)) {
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
  const now = new Date().toISOString();

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

    // Business settings
    await supabase.from("business_settings").insert({
      business_id: businessId,
      description: "",
      extra: "",
      system_prompt_override: "",
      updated_at: now,
    });

    // Business member (owner)
    await supabase.from("business_members").insert({
      business_id: businessId,
      user_id: userId,
      role: "owner",
    });

    // Subscription (pending_payment — must pay before accessing app)
    await supabase.from("subscriptions").insert({
      business_id: businessId,
      plan_code: planCode,
      status: "pending_payment",
      current_period_start: null,
      current_period_end: null,
      updated_at: now,
    });

    // WhatsApp session placeholder
    await supabase.from("whatsapp_sessions").insert({
      business_id: businessId,
      instance_name: "primary",
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
  return response;
}
