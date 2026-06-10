import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { toDashboardAuthResponse, withRoleDashboardBusinessContext } from "@/lib/route-auth";
import { checkAccountAccess } from "@/lib/db";

export const dynamic = "force-dynamic";

// Returns the start-of-day ISO string in UTC for a given date offset from today.
function utcDayStart(offsetDays = 0): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

// Convert ISO string or unix timestamp to unix seconds.
function toUnix(val: string | number | null): number | null {
  if (!val) return null;
  if (typeof val === "number") return val;
  return Math.floor(new Date(val).getTime() / 1000);
}

export async function GET() {
  try {
    return await withRoleDashboardBusinessContext(["owner", "admin"], async ({ businessId }) => {
      const access = await checkAccountAccess(businessId);
      if (!access.canUseApp) {
        return NextResponse.json({ error: "Sin acceso." }, { status: 403 });
      }

      const supabase = getSupabaseAdminClient();
      const now = new Date();
      const monthStart = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;

      // ── Week boundaries ──────────────────────────────────────────────────
      const thisWeekStart = utcDayStart(-6); // last 7 days (rolling week)
      const lastWeekStart = utcDayStart(-13);
      const todayStart   = utcDayStart(0);

      // ── Parallel queries ─────────────────────────────────────────────────
      const [
        { count: totalConversations },
        { count: aiConversations },
        { count: humanConversations },
        { data: usage },
        { data: allConvs },
        { count: activeToday },
      ] = await Promise.all([
        supabase.from("conversations").select("id", { count: "exact", head: true }).eq("business_id", businessId),
        supabase.from("conversations").select("id", { count: "exact", head: true }).eq("business_id", businessId).eq("mode", "AI"),
        supabase.from("conversations").select("id", { count: "exact", head: true }).eq("business_id", businessId).eq("mode", "HUMAN"),
        supabase.from("monthly_usage").select("inbound_messages_count, ai_replies_count, human_messages_count").eq("business_id", businessId).eq("month_start", monthStart).maybeSingle(),
        // Fetch last 14 days to compute weekly trend + daily chart
        supabase.from("conversations").select("id, display_name, mode, needs_attention, last_message_at, created_at").eq("business_id", businessId).gte("created_at", lastWeekStart).order("last_message_at", { ascending: false }),
        // Conversations active (received a message) today
        supabase.from("conversations").select("id", { count: "exact", head: true }).eq("business_id", businessId).gte("last_message_at", Math.floor(new Date(todayStart).getTime() / 1000)),
      ]);

      // ── Weekly trend ──────────────────────────────────────────────────────
      let thisWeekCount = 0;
      let lastWeekCount = 0;
      const thisWeekStartTs = Math.floor(new Date(thisWeekStart).getTime() / 1000);
      const lastWeekStartTs = Math.floor(new Date(lastWeekStart).getTime() / 1000);

      for (const conv of allConvs ?? []) {
        const ts = toUnix(conv.created_at);
        if (!ts) continue;
        if (ts >= thisWeekStartTs) thisWeekCount++;
        else if (ts >= lastWeekStartTs) lastWeekCount++;
      }

      const weeklyTrend =
        lastWeekCount === 0
          ? null
          : Math.round(((thisWeekCount - lastWeekCount) / lastWeekCount) * 100);

      // ── Handoff rate ──────────────────────────────────────────────────────
      // conversations currently in HUMAN mode / total
      const total = totalConversations ?? 0;
      const handoffRate = total > 0 ? Math.round(((humanConversations ?? 0) / total) * 100) : 0;

      // ── Daily activity (last 7 days, rolling) ────────────────────────────
      const dailyMap: Record<string, number> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() - i);
        dailyMap[d.toISOString().slice(0, 10)] = 0;
      }
      for (const conv of allConvs ?? []) {
        const ts = toUnix(conv.created_at);
        if (!ts) continue;
        const key = new Date(ts * 1000).toISOString().slice(0, 10);
        if (key in dailyMap) dailyMap[key]++;
      }
      const dailyActivity = Object.entries(dailyMap).map(([date, count]) => ({ date, count }));

      // ── Recent conversations (last 7 days, sorted by last_message_at) ────
      const recentConvs = (allConvs ?? [])
        .filter((c) => (toUnix(c.last_message_at) ?? 0) >= thisWeekStartTs)
        .slice(0, 5);

      // ── AI response time: avg seconds between first user msg and first AI reply ──
      // Only compute for conversations in the last 7 days to keep it fast.
      let avgAiResponseSec: number | null = null;
      try {
        const recentIds = recentConvs.map((c) => c.id);
        if (recentIds.length > 0) {
          const { data: msgSample } = await supabase
            .from("messages")
            .select("conversation_id, role, created_at")
            .in("conversation_id", recentIds)
            .order("created_at", { ascending: true });

          const responseTimes: number[] = [];
          const byConv: Record<string, { firstUser: number | null; firstAI: number | null }> = {};

          for (const m of msgSample ?? []) {
            if (!byConv[m.conversation_id]) byConv[m.conversation_id] = { firstUser: null, firstAI: null };
            const ts = toUnix(m.created_at);
            if (!ts) continue;
            if (m.role === "user" && byConv[m.conversation_id].firstUser === null) {
              byConv[m.conversation_id].firstUser = ts;
            }
            if (m.role === "assistant" && byConv[m.conversation_id].firstAI === null) {
              byConv[m.conversation_id].firstAI = ts;
            }
          }

          for (const { firstUser, firstAI } of Object.values(byConv)) {
            if (firstUser !== null && firstAI !== null && firstAI > firstUser) {
              responseTimes.push(firstAI - firstUser);
            }
          }

          if (responseTimes.length > 0) {
            avgAiResponseSec = Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length);
          }
        }
      } catch {
        // non-critical — skip
      }

      return NextResponse.json({
        total_conversations:         total,
        ai_conversations:            aiConversations ?? 0,
        human_conversations:         humanConversations ?? 0,
        handoff_rate:                handoffRate,
        active_today:                activeToday ?? 0,
        this_week_conversations:     thisWeekCount,
        last_week_conversations:     lastWeekCount,
        weekly_trend_pct:            weeklyTrend,
        avg_ai_response_sec:         avgAiResponseSec,
        inbound_messages_this_month: usage?.inbound_messages_count ?? 0,
        ai_replies_this_month:       usage?.ai_replies_count ?? 0,
        human_messages_this_month:   usage?.human_messages_count ?? 0,
        daily_activity:              dailyActivity,
        recent_conversations: recentConvs.map((c) => ({
          id:              c.id,
          name:            c.display_name ?? "Sin nombre",
          mode:            c.mode,
          needs_attention: c.needs_attention ?? false,
          last_message_at: toUnix(c.last_message_at),
        })),
      });
    });
  } catch (error) {
    return toDashboardAuthResponse(error);
  }
}
