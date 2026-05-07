import { NextResponse } from "next/server";
import { removeBusinessMember } from "@/lib/db";
import { toDashboardAuthResponse, withDashboardBusinessContext } from "@/lib/route-auth";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    return await withDashboardBusinessContext(async ({ businessId, role }) => {
      const { memberId } = await params;
      await removeBusinessMember(businessId, role, memberId);
      return NextResponse.json({
        ok: true,
        message: "Usuario removido del negocio.",
      });
    });
  } catch (error) {
    return toDashboardAuthResponse(error);
  }
}
