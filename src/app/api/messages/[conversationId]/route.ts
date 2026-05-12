import { NextRequest, NextResponse } from "next/server";
import {
  getMessages,
  insertMessage,
  enqueueOutbox,
  getBestOutgoingJidForConversation,
  getConversationById,
  recordHumanMessageUsage,
} from "@/lib/db";
import { toDashboardAuthResponse, withActiveDashboardBusinessContext, withDashboardBusinessContext } from "@/lib/route-auth";

interface Ctx {
  params: Promise<{ conversationId: string }>;
}

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    return await withDashboardBusinessContext(async ({ businessId }) => {
      const { conversationId } = await params;
      const id = conversationId?.trim();

      if (!id) {
        return NextResponse.json({ error: "ID inválido" }, { status: 400 });
      }

      const conv = await getConversationById(id, businessId);
      if (!conv) {
        return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
      }

      const messages = await getMessages(id, 100, businessId);
      return NextResponse.json(messages);
    });
  } catch (error) {
    return toDashboardAuthResponse(error);
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
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

      const body = await req.json();
      const content: string = body.content?.trim();

      if (!content) {
        return NextResponse.json({ error: "Contenido vacío" }, { status: 400 });
      }

      const target = await getBestOutgoingJidForConversation(id, businessId);
      console.log(`[send] contact_id=${conv.contact_id}`);
      console.log(`[send] has pn_jid=${Boolean(target.targetJid)}`);
      console.log(`[send] target_jid=${target.targetJid || ""}`);
      console.log(
        `[send] blocked_reason=${target.targetJid ? "" : target.reason ?? "missing_safe_phone_jid"}`
      );
      if (!target.targetJid) {
        const message =
          target.reason === "self_target"
            ? "Este contacto quedó asociado al mismo número del agente. Corregí el número antes de responder."
            : "Este contacto necesita asociar un número de WhatsApp antes de responder.";
        return NextResponse.json(
          {
            error: "needs_phone_mapping",
            message,
            contactId: conv.contact_id,
            needsPhoneMapping: true,
          },
          { status: 409 }
        );
      }

      const message = await insertMessage(id, "human", content, null, businessId);
      await enqueueOutbox(id, content, businessId);
      await recordHumanMessageUsage(businessId);

      return NextResponse.json({ ok: true, messageId: message.id });
    });
  } catch (error) {
    return toDashboardAuthResponse(error);
  }
}
