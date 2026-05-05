import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { getSupabaseAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function getMpClient(): MercadoPagoConfig {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) throw new Error("MERCADOPAGO_ACCESS_TOKEN no configurado.");
  return new MercadoPagoConfig({ accessToken: token });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true }); // ignore malformed
  }

  const action = typeof body.action === "string" ? body.action : "";
  const dataId = (body.data as Record<string, unknown> | undefined)?.id;
  const mpPaymentId = typeof dataId === "string" || typeof dataId === "number" ? String(dataId) : null;

  if (!mpPaymentId || (!action.startsWith("payment."))) {
    return NextResponse.json({ ok: true }); // not a payment event
  }

  try {
    const client = getMpClient();
    const paymentClient = new Payment(client);
    const payment = await paymentClient.get({ id: mpPaymentId });

    if (payment.status !== "approved") {
      // Update payment record with the received status if it changed
      const mpStatus = payment.status ?? "pending";
      const externalRef = payment.external_reference;
      if (externalRef) {
        const supabase = getSupabaseAdminClient();
        await supabase
          .from("payments")
          .update({
            mp_payment_id: mpPaymentId,
            status: mpStatus === "cancelled" ? "cancelled" : mpStatus === "rejected" ? "rejected" : "pending",
            updated_at: new Date().toISOString(),
          })
          .eq("id", externalRef);
      }
      return NextResponse.json({ ok: true });
    }

    const externalRef = payment.external_reference;
    if (!externalRef) {
      console.warn("[webhook/mp] approved payment has no external_reference:", mpPaymentId);
      return NextResponse.json({ ok: true });
    }

    const supabase = getSupabaseAdminClient();

    // 1. Update payment record
    const { data: paymentRecord } = await supabase
      .from("payments")
      .update({
        mp_payment_id: mpPaymentId,
        status: "approved",
        updated_at: new Date().toISOString(),
      })
      .eq("id", externalRef)
      .select("business_id")
      .maybeSingle();

    if (!paymentRecord?.business_id) {
      console.warn("[webhook/mp] payment record not found for external_reference:", externalRef);
      return NextResponse.json({ ok: true });
    }

    // 2. Activate subscription for 30 days
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    await supabase
      .from("subscriptions")
      .update({
        status: "active",
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq("business_id", paymentRecord.business_id);

    console.log(`[webhook/mp] subscription activated for business=${paymentRecord.business_id}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[webhook/mp] error:", err);
    // Return 200 so MP does not retry indefinitely
    return NextResponse.json({ ok: true });
  }
}
