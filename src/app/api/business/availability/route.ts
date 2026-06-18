import { NextRequest, NextResponse } from "next/server";
import { listAvailableSlotsForDate } from "@/lib/db";
import { toDashboardAuthResponse, withDashboardBusinessContext } from "@/lib/route-auth";

export const dynamic = "force-dynamic";

// GET /api/business/availability?date=YYYY-MM-DD
// Devuelve los horarios libres reales de esa fecha (para reprogramar/agendar).
export async function GET(req: NextRequest) {
  try {
    return await withDashboardBusinessContext(async ({ businessId }) => {
      const date = req.nextUrl.searchParams.get("date") ?? "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return NextResponse.json({ error: "Fecha inválida (YYYY-MM-DD)." }, { status: 400 });
      }
      const result = await listAvailableSlotsForDate(date, businessId);
      return NextResponse.json(result);
    });
  } catch (error) {
    return toDashboardAuthResponse(error);
  }
}
