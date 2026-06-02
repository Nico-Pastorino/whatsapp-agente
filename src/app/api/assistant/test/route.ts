import { NextRequest, NextResponse } from "next/server";
import { generateReply } from "@/lib/openrouter";
import type { Message } from "@/lib/db";
import { toDashboardAuthResponse, withActiveDashboardBusinessContext } from "@/lib/route-auth";

export const dynamic = "force-dynamic";

// Prueba de respuesta del asistente desde el dashboard.
// Usa la MISMA configuración guardada del negocio (datos, catálogo, tono, FAQ),
// pero NO envía nada por WhatsApp ni guarda mensajes. Es un sandbox de prueba.
export async function POST(req: NextRequest) {
  try {
    return await withActiveDashboardBusinessContext(async ({ businessId }) => {
      const body = await req.json().catch(() => null);
      const rawMessages = Array.isArray(body?.messages) ? body.messages : [];

      const history: Message[] = rawMessages
        .filter(
          (m: unknown): m is { role: string; content: string } =>
            !!m &&
            typeof (m as { content?: unknown }).content === "string" &&
            (m as { content: string }).content.trim().length > 0
        )
        .slice(-12)
        .map((m: { role: string; content: string }, i: number) => ({
          id: `test-${i}`,
          conversation_id: "test",
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content.trim().slice(0, 1000),
          created_at: Math.floor(Date.now() / 1000),
        }));

      if (history.length === 0) {
        return NextResponse.json({ error: "Escribí un mensaje para probar." }, { status: 400 });
      }

      try {
        const reply = await generateReply(history, businessId);
        return NextResponse.json({ reply });
      } catch (err) {
        console.error("[assistant/test] generateReply falló:", err);
        return NextResponse.json(
          { error: "No pudimos generar una respuesta de prueba en este momento." },
          { status: 503 }
        );
      }
    });
  } catch (error) {
    return toDashboardAuthResponse(error);
  }
}
