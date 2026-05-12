import { NextRequest, NextResponse } from "next/server";
import { linkPhoneToContact } from "@/lib/db";
import { toDashboardAuthResponse, withActiveDashboardBusinessContext } from "@/lib/route-auth";

interface Ctx {
  params: Promise<{ contactId: string }>;
}

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    return await withActiveDashboardBusinessContext(async ({ businessId }) => {
      const { contactId } = await params;
      const id = contactId?.trim();

      if (!id) {
        return NextResponse.json({ error: "Contacto inválido" }, { status: 400 });
      }

      const body = (await req.json().catch(() => null)) as { phoneNumber?: string } | null;
      const phoneNumber = body?.phoneNumber?.trim();

      if (!phoneNumber) {
        return NextResponse.json({ error: "Número requerido" }, { status: 400 });
      }

      const result = await linkPhoneToContact(id, phoneNumber, businessId);
      return NextResponse.json(result);
    });
  } catch (error) {
    if ((error as { status?: number })?.status) {
      return toDashboardAuthResponse(error);
    }
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo asociar el número.",
      },
      { status: 400 }
    );
  }
}
