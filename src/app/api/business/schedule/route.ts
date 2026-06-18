import { NextRequest, NextResponse } from "next/server";
import { getBusinessSchedule, saveBusinessSchedule } from "@/lib/db";
import type { BusinessHourRow, ScheduleExceptionRow, BusinessScheduleSettings } from "@/lib/db";
import { toDashboardAuthResponse, withActiveRoleDashboardBusinessContext, withDashboardBusinessContext } from "@/lib/route-auth";

export const dynamic = "force-dynamic";

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export async function GET() {
  try {
    return await withDashboardBusinessContext(async ({ businessId }) => {
      const schedule = await getBusinessSchedule(businessId);
      return NextResponse.json(schedule);
    });
  } catch (error) {
    return toDashboardAuthResponse(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    return await withActiveRoleDashboardBusinessContext(["owner", "admin"], async ({ businessId }) => {
      const body = await req.json().catch(() => ({}));

      // Horario semanal: validar weekday 0-6, HH:MM y cierre > apertura.
      const rawHours = Array.isArray(body.hours) ? body.hours : [];
      const hours: BusinessHourRow[] = [];
      for (const h of rawHours) {
        const weekday = Number(h?.weekday);
        const open = String(h?.open_time ?? "");
        const close = String(h?.close_time ?? "");
        if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) continue;
        if (!HHMM.test(open) || !HHMM.test(close)) continue;
        if (toMin(close) <= toMin(open)) continue;
        hours.push({ weekday, open_time: open, close_time: close });
      }

      // Excepciones: fecha válida + kind permitido; horas opcionales.
      const rawEx = Array.isArray(body.exceptions) ? body.exceptions : [];
      const exceptions: ScheduleExceptionRow[] = [];
      for (const e of rawEx) {
        const date = String(e?.exception_date ?? "");
        const kind = String(e?.kind ?? "");
        if (!DATE.test(date)) continue;
        if (kind !== "closed" && kind !== "block" && kind !== "special") continue;
        const start = e?.start_time && HHMM.test(String(e.start_time)) ? String(e.start_time) : null;
        const end = e?.end_time && HHMM.test(String(e.end_time)) ? String(e.end_time) : null;
        // block/special necesitan rango válido.
        if ((kind === "block" || kind === "special") && (!start || !end || toMin(end) <= toMin(start))) continue;
        exceptions.push({
          exception_date: date,
          kind: kind as ScheduleExceptionRow["kind"],
          start_time: kind === "closed" ? null : start,
          end_time: kind === "closed" ? null : end,
          reason: typeof e?.reason === "string" ? e.reason.slice(0, 200) : "",
        });
      }

      const s = body.settings ?? {};
      const settings: BusinessScheduleSettings = {
        timezone: typeof s.timezone === "string" && s.timezone.trim() ? s.timezone.trim().slice(0, 60) : "America/Argentina/Buenos_Aires",
        slot_interval_minutes: clampInt(s.slot_interval_minutes, 5, 240, 30),
        default_duration_minutes: clampInt(s.default_duration_minutes, 5, 480, 30),
        booking_lead_minutes: clampInt(s.booking_lead_minutes, 0, 10080, 0),
        booking_horizon_days: clampInt(s.booking_horizon_days, 1, 365, 30),
      };

      await saveBusinessSchedule({ hours, exceptions, settings }, businessId);
      const saved = await getBusinessSchedule(businessId);
      return NextResponse.json(saved);
    });
  } catch (error) {
    return toDashboardAuthResponse(error);
  }
}
