import { requireDashboardBusinessContext } from "@/lib/dashboard-auth";
import ConnectionGate from "@/components/ConnectionGate";

export default async function PlanPage() {
  // El gate de cuenta/rol vive en el layout de /app. Acá solo resolvemos el rol
  // para que la navegación y PlanOverview rendericen lo que corresponde.
  const ctx = await requireDashboardBusinessContext().catch(() => null);
  return <ConnectionGate currentView="plan" role={ctx?.role} />;
}
