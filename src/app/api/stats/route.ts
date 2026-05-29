import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { toDashboardAuthResponse, withDashboardBusinessContext } from "@/lib/route-auth";
import { checkAccountAccess } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return await withDashboardBusinessContext(async ({ businessId }) => {
      const access = await checkAccountAccess(businessId);
      if (!access.canUseApp) {
        return NextResponse.json({ error: "Sin acceso." }, { status: 403 });
      }

      const supabase = getSupabaseAdminClient();
      const now = new Date();
      const monthStart = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;

      // Total conversations
      const { count: totalConversations } = await supabase
        .from("conversations")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId);

      // AI vs human mode conversations
      const { count: aiConversations } = await supabase
        .from("conversations")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId)
        .eq("mode", "AI");

      const { count: humanConversations } = await supabase
        .from("conversations")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId)
        .eq("mode", "HUMAN");

      // Messages this month from usage table
      const { data: usage } = await supabase
        .from("monthly_usage")
        .select("inbound_messages_count, ai_replies_count, human_messages_count")
        .eq("business_id", businessId)
        .eq("month_start", monthStart)
        .maybeSingle();

      // Recent conversations (last 7 days with message count)
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: recentConvs } = await supabase
        .from("conversations")
        .select("id, display_name, mode, last_message_at, created_at")
        .eq("business_id", businessId)
        .gte("last_message_at", Math.floor(new Date(sevenDaysAgo).getTime() / 1000))
        .order("last_message_at", { ascending: false })
        .limit(10);

      // New conversations per day last 7 days
      const dailyMap: Record<string, number> = {};
      const today = new Date();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setUTCDate(d.getUTCDate() - i);
        const key = d.toISOString().slice(0, 10);
        dailyMap[key] = 0;
      }
      for (const conv of recentConvs ?? []) {
        if (!conv.created_at) continue;
        const d = new Date(
          typeof conv.created_at === "number" ? conv.created_at * 1000 : conv.created_at
        )
          .toISOString()
          .slice(0, 10);
        if (d in dailyMap) dailyMap[d]++;
      }
      const dailyActivity = Object.entries(dailyMap).map(([date, count]) => ({ date, count }));

      return NextResponse.json({
        total_conversations: totalConversations ?? 0,
        ai_conversations: aiConversations ?? 0,
        human_conversations: humanConversations ?? 0,
        inbound_messages_this_month: usage?.inbound_messages_count ?? 0,
        ai_replies_this_month: usage?.ai_replies_count ?? 0,
        human_messages_this_month: usage?.human_messages_count ?? 0,
        daily_activity: dailyActivity,
        recent_conversations: (recentConvs ?? []).slice(0, 5).map((c) => ({
          id: c.id,
          name: c.display_name ?? "Sin nombre",
          mode: c.mode,
          last_message_at: c.last_message_at,
        })),
      });
    });
  } catch (error) {
    return toDashboardAuthResponse(error);
  }
}
