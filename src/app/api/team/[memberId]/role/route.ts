import { NextRequest, NextResponse } from "next/server";
import { updateBusinessMemberRole, type BusinessMemberRole } from "@/lib/db";
import { toDashboardAuthResponse, withVerifiedActiveRoleDashboardBusinessContext } from "@/lib/route-auth";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    return await withVerifiedActiveRoleDashboardBusinessContext(["owner", "admin"], async ({ businessId, role, user }) => {
      const body = await req.json().catch(() => ({}));
      const nextRole = typeof body.role === "string" ? (body.role as BusinessMemberRole) : "agent";
      const { memberId } = await params;
      const member = await updateBusinessMemberRole(businessId, role, memberId, nextRole, user.sub);

      return NextResponse.json({
        ok: true,
        member,
        message: "Rol actualizado correctamente.",
      });
    });
  } catch (error) {
    return toDashboardAuthResponse(error);
  }
}
