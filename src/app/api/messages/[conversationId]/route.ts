import { NextRequest, NextResponse } from "next/server";
import {
  getMessages,
  insertMessage,
  enqueueOutbox,
  getConversationById,
  recordHumanMessageUsage,
} from "@/lib/db";

interface Ctx {
  params: Promise<{ conversationId: string }>;
}

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { conversationId } = await params;
  const id = conversationId?.trim();

  if (!id) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const messages = await getMessages(id, 100);
  return NextResponse.json(messages);
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
  const content: string = body.content?.trim();

  if (!content) {
    return NextResponse.json({ error: "Contenido vacío" }, { status: 400 });
  }

  const message = await insertMessage(id, "human", content);
  await enqueueOutbox(id, content);
  await recordHumanMessageUsage();

  return NextResponse.json({ ok: true, messageId: message.id });
}
