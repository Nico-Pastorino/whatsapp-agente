import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, Payment, PreApproval } from "mercadopago";
import { getSupabaseAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function getMpClient(): MercadoPagoConfig {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) throw new Error("MERCADOPAGO_ACCESS_TOKEN no configurado.");
  return new MercadoPagoConfig({ accessToken: token });
}

function getEventId(body: Record<string, unknown>, searchParams: URLSearchParams): string | null {
  const dataId = (body.data as Record<string, unknown> | undefined)?.id;
  if (typeof dataId === "string" || typeof dataId === "number") return String(dataId);
  return searchParams.get("data.id") ?? searchParams.get("id");
}

function getEventType(body: Record<string, unknown>, searchParams: URLSearchParams): "payment" | "preapproval" | null {
  const action = typeof body.action === "string" ? body.action : "";
  const type = typeof body.type === "string" ? body.type : "";
  const topic = searchParams.get("topic") ?? "";

  if (action.startsWith("payment.") || type === "payment" || topic === "payment") return "payment";
  if (action.includes("preapproval") || type.includes("preapproval") || topic.includes("preapproval")) return "preapproval";
  return null;
}

function parseSignature(value: string | null): Record<string, string> {
  const entries: Record<string, string> = {};
  for (const part of (value ?? "").split(",")) {
    const [key, ...rest] = part.split("=");
    if (key && rest.length) entries[key.trim()] = rest.join("=").trim();
  }
  return entries;
}

function verifyMercadoPagoSignature(req: NextRequest, eventId: string | null): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim();
  if (!secret) {
    console.warn("[mp/webhook] MERCADOPAGO_WEBHOOK_SECRET no configurado");
    return false;
  }
  if (!eventId) return false;

  const signature = parseSignature(req.headers.get("x-signature"));
  const requestId = req.headers.get("x-request-id");
  const ts = signature.ts;
  const received = signature.v1;
  if (!requestId || !ts || !received) return false;

  const manifest = `id:${eventId};request-id:${requestId};ts:${ts};`;
  const expected = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(received, "hex");
  return (
    expectedBuffer.length === receivedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}

async function markSubscriptionPastDueIfTrialExpired(businessId: string, status: "past_due" | "canceled") {
  const supabase = getSupabaseAdminClient();
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("status, trial_ends_at")
    .eq("business_id", businessId)
    .maybeSingle();

  const trialEndMs = sub?.trial_ends_at ? new Date(sub.trial_ends_at).getTime() : 0;
  const trialExpired = !trialEndMs || trialEndMs < Date.now();
  if (sub?.status === "active" || trialExpired) {
    await supabase
      .from("subscriptions")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("business_id", businessId);
  }
}

async function handlePreApprovalEvent(preapprovalId: string) {
  const supabase = getSupabaseAdminClient();
  const preApprovalClient = new PreApproval(getMpClient());
  const preapproval = await preApprovalClient.get({ id: preapprovalId });
  const externalRef = preapproval.external_reference;

  console.log(`[mp/webhook] preapproval_id=${preapprovalId} status=${preapproval.status}`);
  console.log(`[mp/webhook] preapproval_external_reference=${externalRef ?? "(none)"}`);

  if (!externalRef) return;

  const { data: paymentRecord } = await supabase
    .from("payments")
    .select("id, business_id, plan_code")
    .eq("id", externalRef)
    .maybeSingle();

  if (!paymentRecord) {
    console.warn(`[mp/webhook] payment record not found for preapproval external_reference=${externalRef}`);
    return;
  }

  const now = new Date();
  const preapprovalStatus = preapproval.status ?? "unknown";

  await supabase
    .from("payments")
    .update({
      mp_preapproval_id: preapprovalId,
      updated_at: now.toISOString(),
    })
    .eq("id", paymentRecord.id);

  if (preapprovalStatus === "authorized") {
    const periodEnd = preapproval.next_payment_date
      ? new Date(preapproval.next_payment_date).toISOString()
      : null;

    await supabase
      .from("subscriptions")
      .update({
        plan_code: paymentRecord.plan_code,
        status: "active",
        mercado_pago_preapproval_id: preapprovalId,
        mercado_pago_preapproval_status: preapprovalStatus,
        subscription_started_at: now.toISOString(),
        subscription_ends_at: null,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd,
        cancel_at_period_end: false,
        cancelled_at: null,
        updated_at: now.toISOString(),
      })
      .eq("business_id", paymentRecord.business_id);
    console.log(`[mp/webhook] subscription authorized business=${paymentRecord.business_id}`);
    return;
  }

  await supabase
    .from("subscriptions")
    .update({
      mercado_pago_preapproval_id: preapprovalId,
      mercado_pago_preapproval_status: preapprovalStatus,
      updated_at: now.toISOString(),
    })
    .eq("business_id", paymentRecord.business_id);

  if (["cancelled", "paused"].includes(preapprovalStatus)) {
    await markSubscriptionPastDueIfTrialExpired(
      paymentRecord.business_id,
      preapprovalStatus === "cancelled" ? "canceled" : "past_due"
    );
  }
}

async function handlePaymentEvent(mpPaymentId: string) {
  const supabase = getSupabaseAdminClient();
  const paymentClient = new Payment(getMpClient());
  const payment = await paymentClient.get({ id: mpPaymentId });

  console.log(`[mp/webhook] payment_id=${mpPaymentId} status=${payment.status}`);
  console.log(`[mp/webhook] payment_external_reference=${payment.external_reference ?? "(none)"}`);

  const metadata = (payment.metadata ?? {}) as Record<string, unknown>;
  const externalRef = payment.external_reference;
  const preapprovalId =
    typeof metadata.preapproval_id === "string"
      ? metadata.preapproval_id
      : typeof metadata.preapprovalId === "string"
        ? metadata.preapprovalId
        : null;

  let paymentRecord = null as null | {
    id: string;
    status: string;
    business_id: string;
    plan_code: string;
  };

  if (externalRef) {
    const { data } = await supabase
      .from("payments")
      .select("id, status, business_id, plan_code")
      .eq("id", externalRef)
      .maybeSingle();
    paymentRecord = data;
  }

  if (!paymentRecord && preapprovalId) {
    const { data } = await supabase
      .from("payments")
      .select("id, status, business_id, plan_code")
      .eq("mp_preapproval_id", preapprovalId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    paymentRecord = data;
  }

  if (!paymentRecord) {
    console.warn(`[mp/webhook] payment record not found for payment=${mpPaymentId}`);
    return;
  }

  const now = new Date();
  const mappedStatus =
    payment.status === "approved"
      ? "approved"
      : payment.status === "rejected"
        ? "rejected"
        : payment.status === "cancelled"
          ? "cancelled"
          : "pending";

  await supabase
    .from("payments")
    .update({
      mp_payment_id: mpPaymentId,
      status: mappedStatus,
      updated_at: now.toISOString(),
    })
    .eq("id", paymentRecord.id);

  if (payment.status === "approved") {
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    await supabase
      .from("subscriptions")
      .update({
        plan_code: paymentRecord.plan_code,
        status: "active",
        paid_at: now.toISOString(),
        mercado_pago_payment_id: mpPaymentId,
        subscription_started_at: now.toISOString(),
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        cancel_at_period_end: false,
        cancelled_at: null,
        updated_at: now.toISOString(),
      })
      .eq("business_id", paymentRecord.business_id);
    console.log(`[mp/webhook] payment approved business=${paymentRecord.business_id}`);
    return;
  }

  if (["rejected", "cancelled"].includes(payment.status ?? "")) {
    await markSubscriptionPastDueIfTrialExpired(paymentRecord.business_id, "past_due");
  }
}

export async function POST(req: NextRequest) {
  console.log("[mp/webhook] received");

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // Body vacío es normal en IPN legacy.
  }

  const searchParams = req.nextUrl.searchParams;
  const eventId = getEventId(body, searchParams);
  const eventType = getEventType(body, searchParams);

  console.log(`[mp/webhook] event_type=${eventType ?? "(unknown)"} event_id=${eventId ?? "(none)"}`);

  if (!verifyMercadoPagoSignature(req, eventId)) {
    console.warn("[mp/webhook] invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (!eventId || !eventType) {
    return NextResponse.json({ ok: true });
  }

  try {
    if (eventType === "preapproval") {
      await handlePreApprovalEvent(eventId);
    } else {
      await handlePaymentEvent(eventId);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[mp/webhook] unexpected error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: true });
  }
}
