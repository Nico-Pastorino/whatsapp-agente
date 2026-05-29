import { NextRequest, NextResponse } from "next/server";
import { getBusinessProfile, setBusinessProfile } from "@/lib/db";
import { toDashboardAuthResponse, withActiveDashboardBusinessContext, withDashboardBusinessContext } from "@/lib/route-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return await withDashboardBusinessContext(async ({ businessId }) => {
      const profile = await getBusinessProfile(businessId);
      return NextResponse.json({
        ...profile,
      });
    });
  } catch (error) {
    return toDashboardAuthResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    return await withActiveDashboardBusinessContext(async ({ businessId }) => {
      const body = await req.json();

      const name: string = (body.name ?? "").trim();
      const description: string = (body.description ?? "").trim();
      const extra: string = (body.extra ?? "").trim();

      const rawProducts = Array.isArray(body.products) ? body.products : [];
      const products = rawProducts
        .filter((p: { name?: string }) => typeof p.name === "string" && p.name.trim())
        .map((p: { name: string; price?: string; description?: string }) => ({
          name: p.name.trim(),
          price: (p.price ?? "").trim(),
          description: (p.description ?? "").trim(),
        }));

      // quick_replies: array of non-empty strings, max 10, max 120 chars each
      const rawReplies = Array.isArray(body.quick_replies) ? body.quick_replies : undefined;
      const quick_replies = rawReplies
        ? (rawReplies as unknown[])
            .filter((r): r is string => typeof r === "string" && r.trim().length > 0)
            .map((r) => r.trim().slice(0, 120))
            .slice(0, 10)
        : undefined;

      // Base de conocimiento (texto libre, máx 8000 chars)
      const knowledge_base =
        typeof body.knowledge_base === "string"
          ? body.knowledge_base.trim().slice(0, 8000)
          : undefined;

      // Agenda de turnos
      const booking_enabled =
        typeof body.booking_enabled === "boolean" ? body.booking_enabled : undefined;
      const booking_config =
        typeof body.booking_config === "string"
          ? body.booking_config.trim().slice(0, 4000)
          : undefined;

      // Avisos internos al encargado
      const notify_enabled =
        typeof body.notify_enabled === "boolean" ? body.notify_enabled : undefined;
      const notify_phone =
        typeof body.notify_phone === "string" ? body.notify_phone.trim().slice(0, 30) : undefined;
      const ALLOWED_EVENTS = [
        "new_appointment",
        "appointment_cancelled",
        "human_handoff",
        "hot_lead",
        "unanswered",
        "daily_summary",
      ];
      const notify_events = Array.isArray(body.notify_events)
        ? (body.notify_events as unknown[])
            .filter((e): e is string => typeof e === "string" && ALLOWED_EVENTS.includes(e))
        : undefined;

      await setBusinessProfile(
        {
          name, description, products, extra, quick_replies, knowledge_base, booking_enabled, booking_config,
          notify_enabled, notify_phone, notify_events,
        },
        businessId
      );

      return NextResponse.json({ ok: true });
    });
  } catch (error) {
    return toDashboardAuthResponse(error);
  }
}
