import { NextRequest, NextResponse } from "next/server";
import { listKnowledgeSources, createKnowledgeSource } from "@/lib/knowledge-sources";
import { toDashboardAuthResponse, withDashboardBusinessContext, withVerifiedActiveDashboardBusinessContext } from "@/lib/route-auth";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return await withDashboardBusinessContext(async ({ businessId }) => {
      const sources = await listKnowledgeSources(businessId);
      return NextResponse.json({ sources });
    });
  } catch (error) {
    return toDashboardAuthResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    // Verificado + activo: crear una fuente dispara un fetch del servidor.
    return await withVerifiedActiveDashboardBusinessContext(async ({ businessId }) => {
      const rl = rateLimit(`sources-create:${businessId}`, 5, 10 * 60_000);
      if (!rl.ok) {
        return NextResponse.json(
          { error: "Agregaste varias fuentes seguidas. Esperá unos minutos." },
          { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
        );
      }
      const body = await req.json().catch(() => ({}));
      const url = typeof body.url === "string" ? body.url : "";
      const label = typeof body.label === "string" ? body.label : null;
      try {
        const source = await createKnowledgeSource(businessId, url, label);
        return NextResponse.json({ ok: true, source });
      } catch (err) {
        return NextResponse.json(
          { error: err instanceof Error ? err.message : "No pudimos leer ese link." },
          { status: 400 }
        );
      }
    });
  } catch (error) {
    return toDashboardAuthResponse(error);
  }
}
