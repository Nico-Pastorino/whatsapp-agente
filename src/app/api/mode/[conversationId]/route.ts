import { NextRequest, NextResponse } from "next/server";
import { setMode, getConversationById } from "@/lib/db";
import { toDashboardAuthResponse, withActiveDashboardBusinessContext } from "@/lib/route-auth";

export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ conversationId: string }>;
}

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    return await withActiveDashboardBusinessContext(async ({ businessId, user }) => {
      const { conversationId } = await params;
      const id = conversationId?.trim();

      if (!id) {
        return NextResponse.json({ error: "ID inválido" }, { status: 400 });
      }

      const conv = await getConversationById(id, businessId);
      if (!conv) {
        return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
      }

      const body = await req.json();
      const mode: string = body.mode;

      if (mode !== "AI" && mode !== "HUMAN") {
        return NextResponse.json({ error: "Modo inválido" }, { status: 400 });
      }

      await setMode(id, mode, businessId, mode === "HUMAN" ? { assignedTo: user.sub } : {});
      return NextResponse.json({ ok: true, mode });
    });
  } catch (error) {
    return toDashboardAuthResponse(error);
  }
}
