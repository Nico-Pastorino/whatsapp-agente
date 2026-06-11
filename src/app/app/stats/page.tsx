import { requireDashboardBusinessContext } from "@/lib/dashboard-auth";
import ConnectionGate from "@/components/ConnectionGate";

export default async function StatsPage() {
  // El gate de cuenta/rol vive en el layout de /app.
  const ctx = await requireDashboardBusinessContext().catch(() => null);
  return <ConnectionGate currentView="stats" role={ctx?.role} />;
}
