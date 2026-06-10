import { NextResponse } from "next/server";
import { resendBusinessInvitation, revokeBusinessInvitation } from "@/lib/db";
import { toDashboardAuthResponse, withVerifiedActiveRoleDashboardBusinessContext } from "@/lib/route-auth";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ invitationId: string }> }
) {
  try {
    return await withVerifiedActiveRoleDashboardBusinessContext(["owner", "admin"], async ({ businessId, role, user }) => {
      const { invitationId } = await params;
      await revokeBusinessInvitation(businessId, role, invitationId, user.sub);
      return NextResponse.json({
        ok: true,
        message: "Invitación revocada correctamente.",
      });
    });
  } catch (error) {
    return toDashboardAuthResponse(error);
  }
}

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ invitationId: string }> }
) {
  try {
    return await withVerifiedActiveRoleDashboardBusinessContext(["owner", "admin"], async ({ businessId, role, user }) => {
      const { invitationId } = await params;
      const invitation = await resendBusinessInvitation(businessId, role, invitationId, user.sub);
      return NextResponse.json({
        ok: true,
        invitation,
        message: "Invitación reenviada. Copiá el nuevo link y enviáselo a la persona.",
      });
    });
  } catch (error) {
    return toDashboardAuthResponse(error);
  }
}
