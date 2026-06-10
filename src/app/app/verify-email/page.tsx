import { redirect } from "next/navigation";
import { requireDashboardSession } from "@/lib/dashboard-auth";
import { isEmailVerified } from "@/lib/email-verification";
import VerifyEmailScreen from "@/components/VerifyEmailScreen";

export const dynamic = "force-dynamic";

export default async function VerifyEmailPage() {
  const session = await requireDashboardSession().catch(() => null);
  if (!session) redirect("/login");
  if (await isEmailVerified(session.sub)) redirect("/app/home");
  return <VerifyEmailScreen email={session.email} />;
}
