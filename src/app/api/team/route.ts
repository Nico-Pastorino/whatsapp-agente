import { NextResponse } from "next/server";
import { canInviteMember, getBusinessMembers, getPlanSummary, listBusinessInvitations } from "@/lib/db";
import { toDashboardAuthResponse, withDashboardBusinessContext } from "@/lib/route-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return await withDashboardBusinessContext(async ({ businessId, role }) => {
      const [plan, inviteStatus, members, invitations] = await Promise.all([
        getPlanSummary(businessId),
        canInviteMember(businessId),
        getBusinessMembers(businessId),
        listBusinessInvitations(businessId),
      ]);

      return NextResponse.json({
        current_role: role,
        plan: {
          code: plan.plan_code,
          name: plan.plan_name,
        },
        used_active: inviteStatus.used_active,
        used_pending: inviteStatus.used_pending,
        used_total: inviteStatus.used_total,
        limit: inviteStatus.limit,
        can_invite: inviteStatus.allowed,
        invite_block_reason: inviteStatus.reason ?? null,
        members,
        pending_invitations: invitations,
      });
    });
  } catch (error) {
    return toDashboardAuthResponse(error);
  }
}
