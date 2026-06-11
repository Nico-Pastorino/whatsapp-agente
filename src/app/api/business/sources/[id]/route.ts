import { NextRequest, NextResponse } from "next/server";
import { refreshKnowledgeSource, deleteKnowledgeSource } from "@/lib/knowledge-sources";
import { toDashboardAuthResponse, withActiveDashboardBusinessContext, withVerifiedActiveDashboardBusinessContext } from "@/lib/route-auth";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ id: string }>;
}

/** PATCH = refrescar el snapshot de la fuente ahora. */
export async function PATCH(_req: NextRequest, { params }: Ctx) {
  try {
    return await withVerifiedActiveDashboardBusinessContext(async ({ businessId }) => {
      const { id } = await params;
      const rl = rateLimit(`sources-refresh:${businessId}`, 6, 10 * 60_000);
      if (!rl.ok) {
        return NextResponse.json(
          { error: "Refrescaste varias veces seguidas. Esperá unos minutos." },
          { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
        );
      }
      try {
        const source = await refreshKnowledgeSource(id, businessId);
        return NextResponse.json({ ok: true, source });
      } catch (err) {
        return NextResponse.json(
          { error: err instanceof Error ? err.message : "No pudimos actualizar la fuente." },
          { status: 400 }
        );
      }
    });
  } catch (error) {
    return toDashboardAuthResponse(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    return await withActiveDashboardBusinessContext(async ({ businessId }) => {
      const { id } = await params;
      await deleteKnowledgeSource(id, businessId);
      return NextResponse.json({ ok: true });
    });
  } catch (error) {
    return toDashboardAuthResponse(error);
  }
}
