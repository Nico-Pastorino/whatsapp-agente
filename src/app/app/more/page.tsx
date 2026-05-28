import { redirect } from "next/navigation";
import { requireDashboardBusinessContext } from "@/lib/dashboard-auth";
import { checkAccountAccess } from "@/lib/db";
import ConnectionGate from "@/components/ConnectionGate";

export default async function MorePage() {
  const ctx = await requireDashboardBusinessContext().catch(() => null);
  if (ctx) {
    const access = await checkAccountAccess(ctx.businessId).catch(() => null);
    if (access && !access.canUseApp) {
      redirect("/app/plan");
    }
  }
  return <ConnectionGate currentView="more" />;
}
