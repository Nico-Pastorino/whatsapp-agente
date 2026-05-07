import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { getSupabaseAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function getMpClient(): MercadoPagoConfig {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) throw new Error("MERCADOPAGO_ACCESS_TOKEN no configurado.");
  return new MercadoPagoConfig({ accessToken: token });
}

/**
 * Extrae el MP payment ID de la notificación entrante.
 *
 * MP envía notificaciones en dos formatos según la versión de la API:
 *
 * 1. Webhooks REST (moderno — usado con notification_url en preferencias):
 *    POST body JSON: { action: "payment.created", data: { id: "12345" } }
 *
 * 2. IPN legacy:
 *    Query params: ?topic=payment&id=12345
 *    Body puede estar vacío.
 *
 * Esta función intenta ambos y devuelve el ID o null si no aplica.
 */
function extractMpPaymentId(
  body: Record<string, unknown>,
  searchParams: URLSearchParams
): string | null {
  // Formato 1: Webhooks REST moderno
  const action = typeof body.action === "string" ? body.action : "";
  if (action.startsWith("payment.")) {
    const dataId = (body.data as Record<string, unknown> | undefined)?.id;
    if (typeof dataId === "string" || typeof dataId === "number") {
      return String(dataId);
    }
  }

  // Formato 2: IPN legacy por query params
  const topic = searchParams.get("topic");
  const qId = searchParams.get("id");
  if (topic === "payment" && qId) {
    return qId;
  }

  // Formato 3: Algunos endpoints MP mandan { type: "payment", data: { id } }
  const type = typeof body.type === "string" ? body.type : "";
  if (type === "payment") {
    const dataId = (body.data as Record<string, unknown> | undefined)?.id;
    if (typeof dataId === "string" || typeof dataId === "number") {
      return String(dataId);
    }
  }

  return null;
}

export async function POST(req: NextRequest) {
  console.log("[mp/webhook] received");

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // Body vacío es normal en IPN legacy — no es un error
  }

  const searchParams = req.nextUrl.searchParams;
  const mpPaymentId = extractMpPaymentId(body, searchParams);

  console.log(`[mp/webhook] action=${body.action ?? "(none)"} topic=${searchParams.get("topic") ?? "(none)"}`);
  console.log(`[mp/webhook] payment_id=${mpPaymentId ?? "(not extracted)"}`);

  if (!mpPaymentId) {
    // No es una notificación de pago — puede ser test de MP o ping de conexión
    console.log("[mp/webhook] not a payment event, skipping");
    return NextResponse.json({ ok: true });
  }

  try {
    const client = getMpClient();
    const paymentClient = new Payment(client);
    const payment = await paymentClient.get({ id: mpPaymentId });

    console.log(`[mp/webhook] payment_status=${payment.status}`);
    console.log(`[mp/webhook] external_reference=${payment.external_reference ?? "(none)"}`);

    const externalRef = payment.external_reference;

    if (payment.status !== "approved") {
      // Actualizar estado del pago si cambió (rejected, cancelled, etc.)
      if (externalRef) {
        const supabase = getSupabaseAdminClient();
        const statusMap: Record<string, string> = {
          cancelled: "cancelled",
          rejected: "rejected",
        };
        const mappedStatus = statusMap[payment.status ?? ""] ?? "pending";
        await supabase
          .from("payments")
          .update({
            mp_payment_id: mpPaymentId,
            status: mappedStatus,
            updated_at: new Date().toISOString(),
          })
          .eq("id", externalRef);
        console.log(`[mp/webhook] payment record updated status=${mappedStatus}`);
      }
      return NextResponse.json({ ok: true });
    }

    // ── Pago aprobado ──

    if (!externalRef) {
      console.warn("[mp/webhook] approved payment has no external_reference — cannot link to subscription");
      return NextResponse.json({ ok: true });
    }

    const supabase = getSupabaseAdminClient();

    // Idempotencia: si este pago ya fue procesado, no volver a activar
    const { data: existing } = await supabase
      .from("payments")
      .select("status, business_id")
      .eq("id", externalRef)
      .maybeSingle();

    if (existing?.status === "approved") {
      console.log(`[mp/webhook] payment ${externalRef} already approved — skipping (idempotent)`);
      return NextResponse.json({ ok: true });
    }

    if (!existing) {
      console.warn(`[mp/webhook] payment record not found for external_reference=${externalRef}`);
      return NextResponse.json({ ok: true });
    }

    console.log(`[mp/webhook] business_id resolved=${existing.business_id}`);

    // 1. Marcar el pago como aprobado
    await supabase
      .from("payments")
      .update({
        mp_payment_id: mpPaymentId,
        status: "approved",
        updated_at: new Date().toISOString(),
      })
      .eq("id", externalRef);

    console.log(`[mp/webhook] payment record updated to approved`);

    // 2. Activar suscripción por 30 días
    //    Esto actualiza subscriptions.status = 'active' para el business_id,
    //    que es exactamente lo que lee getBusinessSubscriptionStatus(businessId).
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const { error: subError } = await supabase
      .from("subscriptions")
      .update({
        status: "active",
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq("business_id", existing.business_id);

    if (subError) {
      console.error("[mp/webhook] error activating subscription:", subError.message);
      // No retornamos error a MP para que no reintente — el pago ya fue guardado
      return NextResponse.json({ ok: true });
    }

    console.log(`[mp/webhook] subscription activated for business=${existing.business_id}`);
    console.log(`[mp/webhook] period ${now.toISOString()} → ${periodEnd.toISOString()}`);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[mp/webhook] unexpected error:", err instanceof Error ? err.message : err);
    // Siempre 200 para que MP no reintente indefinidamente
    return NextResponse.json({ ok: true });
  }
}
