import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { createAppSessionToken, getSessionCookieOptions } from "@/lib/app-session";
import { APP_SESSION_COOKIE } from "@/lib/app-session-shared";
import { getBusinessInvitationByToken } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const token = typeof body.token === "string" ? body.token.trim() : "";
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!token || !fullName || !password) {
    return NextResponse.json({ error: "Todos los campos son obligatorios." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres." }, { status: 400 });
  }

  const invitation = await getBusinessInvitationByToken(token);
  if (!invitation) {
    return NextResponse.json(
      { error: "La invitación no existe o ya no está disponible." },
      { status: 404 }
    );
  }
  if (invitation.status !== "pending") {
    return NextResponse.json(
      { error: invitation.status === "expired" ? "Esta invitación venció." : "La invitación ya no está disponible." },
      { status: 409 }
    );
  }

  const email = invitation.email;
  const supabase = getSupabaseAdminClient();

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
    console.error("[signup-invite] auth error:", authError);
    return NextResponse.json({ error: "No se pudo crear la cuenta." }, { status: 500 });
  }

  try {
    await supabase.from("profiles").upsert({
      id: authData.user.id,
      email,
      full_name: fullName,
    });
  } catch (error) {
    await supabase.auth.admin.deleteUser(authData.user.id).catch(() => undefined);
    console.error("[signup-invite] profile error:", error);
    return NextResponse.json({ error: "No se pudo configurar la cuenta." }, { status: 500 });
  }

  const tokenValue = createAppSessionToken({
    sub: authData.user.id,
    email,
    fullName,
  });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(APP_SESSION_COOKIE, tokenValue, getSessionCookieOptions());
  return response;
}
