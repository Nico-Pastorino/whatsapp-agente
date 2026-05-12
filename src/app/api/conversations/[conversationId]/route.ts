import { NextRequest, NextResponse } from "next/server";
import { deleteConversation, getConversationById } from "@/lib/db";
import { toDashboardAuthResponse, withActiveDashboardBusinessContext } from "@/lib/route-auth";

export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ conversationId: string }>;
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    return await withActiveDashboardBusinessContext(async ({ businessId }) => {
      const { conversationId } = await params;
      const id = conversationId?.trim();

      if (!id) {
        return NextResponse.json({ error: "ID inválido" }, { status: 400 });
      }

      const conv = await getConversationById(id, businessId);
      if (!conv) {
        return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
      }

      await deleteConversation(id, businessId);
      return NextResponse.json({ ok: true });
    });
  } catch (error) {
    return toDashboardAuthResponse(error);
  }
}
