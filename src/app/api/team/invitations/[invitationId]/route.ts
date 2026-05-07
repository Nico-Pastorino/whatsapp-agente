import { NextResponse } from "next/server";
import { revokeBusinessInvitation } from "@/lib/db";
import { toDashboardAuthResponse, withDashboardBusinessContext } from "@/lib/route-auth";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ invitationId: string }> }
) {
  try {
    return await withDashboardBusinessContext(async ({ businessId, role }) => {
      const { invitationId } = await params;
      await revokeBusinessInvitation(businessId, role, invitationId);
      return NextResponse.json({
        ok: true,
        message: "Invitación revocada correctamente.",
      });
    });
  } catch (error) {
    return toDashboardAuthResponse(error);
  }
}
