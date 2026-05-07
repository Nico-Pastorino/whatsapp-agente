import { NextRequest, NextResponse } from "next/server";
import { getBusinessInvitationByToken } from "@/lib/db";
import { getSupabaseAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")?.trim() ?? "";
  if (!token) {
    return NextResponse.json({ error: "Invitación inválida." }, { status: 400 });
  }

  const invitation = await getBusinessInvitationByToken(token);
  if (!invitation) {
    return NextResponse.json(
      { error: "La invitación no existe o ya no está disponible." },
      { status: 404 }
    );
  }

  const supabase = getSupabaseAdminClient();
  const { data: business } = await supabase
    .from("businesses")
    .select("display_name")
    .eq("id", invitation.business_id)
    .maybeSingle();

  return NextResponse.json({
    invitation: {
      ...invitation,
      business_name: business?.display_name ?? "Negocio",
    },
  });
}
