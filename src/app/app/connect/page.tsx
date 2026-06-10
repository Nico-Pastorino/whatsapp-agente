import { redirect } from "next/navigation";
import { requireDashboardBusinessContext } from "@/lib/dashboard-auth";
import { isEmailVerified } from "@/lib/email-verification";
import { checkAccountAccess } from "@/lib/db";
import ConnectionGate from "@/components/ConnectionGate";

export default async function ConnectPage() {
  const ctx = await requireDashboardBusinessContext().catch(() => null);
  if (ctx) {
    // Conectar WhatsApp es la puerta al uso operativo: requiere email verificado.
    const verified = await isEmailVerified(ctx.user.sub).catch(() => true);
    if (!verified) {
      redirect("/app/verify-email");
    }
    const access = await checkAccountAccess(ctx.businessId).catch(() => null);
    if (access && !access.canUseApp) {
      redirect("/app/plan");
    }
  }
  return <ConnectionGate currentView="connect" />;
}
