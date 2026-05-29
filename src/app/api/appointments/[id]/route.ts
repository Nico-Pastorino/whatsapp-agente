import { NextRequest, NextResponse } from "next/server";
import { updateAppointment, getAppointmentById } from "@/lib/db";
import type { AppointmentInput } from "@/lib/db";
import { toDashboardAuthResponse, withActiveDashboardBusinessContext } from "@/lib/route-auth";

export const dynamic = "force-dynamic";

const VALID_STATUS = ["pending", "confirmed", "cancelled", "done"];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    return await withActiveDashboardBusinessContext(async ({ businessId }) => {
      const { id } = await params;
      const body = await req.json().catch(() => ({}));

      // Verificamos que el turno exista y pertenezca a ESTE negocio.
      const existing = await getAppointmentById(id, businessId);
      if (!existing) {
        return NextResponse.json({ error: "Turno no encontrado." }, { status: 404 });
      }

      const patch: AppointmentInput = {};
      if (body.customer_name !== undefined)
        patch.customer_name = typeof body.customer_name === "string" ? body.customer_name.trim() : null;
      if (body.customer_phone !== undefined)
        patch.customer_phone = typeof body.customer_phone === "string" ? body.customer_phone.trim() || null : null;
      if (body.service !== undefined)
        patch.service = typeof body.service === "string" ? body.service.trim() || null : null;
      if (body.notes !== undefined)
        patch.notes = typeof body.notes === "string" ? body.notes.trim() || null : null;
      if (body.starts_at !== undefined) {
        if (typeof body.starts_at === "string" && body.starts_at.trim()) {
          const d = new Date(body.starts_at);
          if (Number.isNaN(d.getTime())) {
            return NextResponse.json({ error: "Fecha y hora inválidas." }, { status: 400 });
          }
          patch.starts_at = d.toISOString();
        } else {
          patch.starts_at = null;
        }
      }
      if (body.status !== undefined) {
        if (!VALID_STATUS.includes(body.status)) {
          return NextResponse.json({ error: "Estado inválido." }, { status: 400 });
        }
        patch.status = body.status;
      }

      const appointment = await updateAppointment(id, patch, businessId);
      return NextResponse.json({ appointment });
    });
  } catch (error) {
    return toDashboardAuthResponse(error);
  }
}
