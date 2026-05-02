import { NextRequest, NextResponse } from "next/server";
import { setMode, getConversationById } from "@/lib/db";

export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ conversationId: string }>;
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { conversationId } = await params;
  const id = conversationId?.trim();

  if (!id) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const conv = await getConversationById(id);
  if (!conv) {
    return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
  }

  const body = await req.json();
  const mode: string = body.mode;

  if (mode !== "AI" && mode !== "HUMAN") {
    return NextResponse.json({ error: "Modo inválido" }, { status: 400 });
  }

  await setMode(id, mode);
  return NextResponse.json({ ok: true, mode });
}
