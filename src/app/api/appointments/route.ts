import { NextRequest, NextResponse } from "next/server";
import { listAppointments, createAppointment, AppointmentLimitError } from "@/lib/db";
import { toDashboardAuthResponse, withActiveDashboardBusinessContext } from "@/lib/route-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    return await withActiveDashboardBusinessContext(async ({ businessId }) => {
      const includeCancelled = req.nextUrl.searchParams.get("all") === "1";
      const appointments = await listAppointments(businessId, { includeCancelled });
      return NextResponse.json({ appointments });
    });
  } catch (error) {
    return toDashboardAuthResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    return await withActiveDashboardBusinessContext(async ({ businessId }) => {
      const body = await req.json().catch(() => ({}));

      const customer_name = typeof body.customer_name === "string" ? body.customer_name.trim() : "";
      if (!customer_name) {
        return NextResponse.json({ error: "El nombre del cliente es obligatorio." }, { status: 400 });
      }

      // starts_at: aceptamos ISO o vacío. Si viene, validamos que sea fecha válida.
      let starts_at: string | null = null;
      if (typeof body.starts_at === "string" && body.starts_at.trim()) {
        const d = new Date(body.starts_at);
        if (Number.isNaN(d.getTime())) {
          return NextResponse.json({ error: "Fecha y hora inválidas." }, { status: 400 });
        }
        starts_at = d.toISOString();
      }

      try {
        const appointment = await createAppointment(
          {
            customer_name,
            customer_phone: typeof body.customer_phone === "string" ? body.customer_phone.trim() || null : null,
            service: typeof body.service === "string" ? body.service.trim() || null : null,
            starts_at,
            notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
            status: body.status,
            source: "human",
          },
          businessId
        );
        return NextResponse.json({ appointment });
      } catch (err) {
        if (err instanceof AppointmentLimitError) {
          return NextResponse.json({ error: err.message }, { status: 403 });
        }
        throw err;
      }
    });
  } catch (error) {
    return toDashboardAuthResponse(error);
  }
}
