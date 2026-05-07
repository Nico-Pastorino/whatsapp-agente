import { NextRequest, NextResponse } from "next/server";
import { createBusinessInvitation, type BusinessMemberRole } from "@/lib/db";
import { toDashboardAuthResponse, withDashboardBusinessContext } from "@/lib/route-auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    return await withDashboardBusinessContext(async ({ businessId, role, user }) => {
      const body = await req.json().catch(() => ({}));
      const email = typeof body.email === "string" ? body.email : "";
      const nextRole =
        typeof body.role === "string" ? (body.role as Extract<BusinessMemberRole, "admin" | "agent">) : "agent";

      const invitation = await createBusinessInvitation(
        businessId,
        user.sub,
        role,
        email,
        nextRole
      );

      return NextResponse.json({
        ok: true,
        invitation,
        message:
          "Creamos una invitación para este email. Copiá el link y enviáselo a la persona para que se sume al equipo.",
      });
    });
  } catch (error) {
    return toDashboardAuthResponse(error);
  }
}
