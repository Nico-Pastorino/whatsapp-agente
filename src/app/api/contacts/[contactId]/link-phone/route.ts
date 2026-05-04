import { NextRequest, NextResponse } from "next/server";
import { linkPhoneToContact } from "@/lib/db";

interface Ctx {
  params: Promise<{ contactId: string }>;
}

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: Ctx) {
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

  try {
    const result = await linkPhoneToContact(id, phoneNumber);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo asociar el número.",
      },
      { status: 400 }
    );
  }
}
