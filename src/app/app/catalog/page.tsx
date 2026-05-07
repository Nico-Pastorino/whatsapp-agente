import { redirect } from "next/navigation";
import { requireDashboardBusinessContext } from "@/lib/dashboard-auth";
import { getBusinessSubscriptionStatus } from "@/lib/db";
import ConnectionGate from "@/components/ConnectionGate";

const BLOCKED_STATUSES = new Set(["pending_payment", "canceled", "past_due"]);

export default async function CatalogPage() {
  const ctx = await requireDashboardBusinessContext().catch(() => null);
  if (ctx) {
    const status = await getBusinessSubscriptionStatus(ctx.businessId).catch(() => "none");
    if (BLOCKED_STATUSES.has(status)) {
      redirect("/app/plan");
    }
  }
  return <ConnectionGate currentView="catalog" />;
}
