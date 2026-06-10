import { NextRequest, NextResponse } from "next/server";
import { getConnectionState, requestPairingCode } from "@/lib/db";
import { toDashboardAuthResponse, withVerifiedActiveRoleDashboardBusinessContext } from "@/lib/route-auth";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Solicita un código de vinculación de WhatsApp para el número indicado.
 * El worker lo detecta en el próximo ciclo de QR (≤ ~60s) y publica el
 * código de 8 caracteres, que la UI muestra vía /api/connection/status.
 */
export async function POST(req: NextRequest) {
  try {
    return await withVerifiedActiveRoleDashboardBusinessContext(["owner"], async ({ businessId }) => {
      const rl = rateLimit(`pairing-code:${businessId}`, 4, 10 * 60_000);
      if (!rl.ok) {
        return NextResponse.json(
          { error: "Pediste varios códigos seguidos. Esperá unos minutos." },
          { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
        );
      }

      const body = await req.json().catch(() => ({}));
      let phone = typeof body.phone === "string" ? body.phone.replace(/[^\d]/g, "") : "";

      // Normalización Argentina: los celulares en WhatsApp SIEMPRE llevan
      // 549 + área + número. Si el usuario puso 54 sin el 9 (error clásico),
      // lo corregimos — un código pedido para el número equivocado nunca
      // va a poder ingresarse en el teléfono.
      if (phone.startsWith("54") && !phone.startsWith("549") && phone.length >= 12) {
        phone = `549${phone.slice(2)}`;
      }

      if (phone.length < 10 || phone.length > 15) {
        return NextResponse.json(
          { error: "Ingresá tu número con código de país, sin 0 ni 15. Ej: 5491155551234." },
          { status: 400 }
        );
      }
      if (phone.startsWith("0")) {
        return NextResponse.json(
          { error: "No uses 0 al inicio. Empezá con el código de país (54 para Argentina)." },
          { status: 400 }
        );
      }

      const state = await getConnectionState(businessId);
      if (state.status === "connected") {
        return NextResponse.json(
          { error: "Tu WhatsApp ya está conectado." },
          { status: 409 }
        );
      }
      if (!state.worker_online) {
        return NextResponse.json(
          { error: "El asistente está iniciando. Esperá un momento y volvé a intentar." },
          { status: 503 }
        );
      }

      await requestPairingCode(phone, businessId);
      console.log(`[connection/pairing] requested business_id=${businessId}`);
      return NextResponse.json({ ok: true });
    });
  } catch (error) {
    return toDashboardAuthResponse(error);
  }
}
