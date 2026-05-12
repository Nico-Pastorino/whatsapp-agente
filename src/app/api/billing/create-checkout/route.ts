import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, PreApproval } from "mercadopago";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { toDashboardAuthResponse, withDashboardBusinessContext } from "@/lib/route-auth";
import { canUpgradeTo, checkAccountAccess } from "@/lib/db";

export const dynamic = "force-dynamic";

function getMpClient(): MercadoPagoConfig {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) throw new Error("MERCADOPAGO_ACCESS_TOKEN no configurado.");
  return new MercadoPagoConfig({ accessToken: token });
}

function getAppUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) return `https://${vercelUrl}`;
  return "http://localhost:3000";
}

export async function POST(req: NextRequest) {
  try {
    return await withDashboardBusinessContext(async ({ businessId, user }) => {
      const body = await req.json().catch(() => ({})) as Record<string, unknown>;
      const requestedPlanCode =
        typeof body.plan_code === "string" ? body.plan_code.trim() : null;
      const checkoutType: "initial" | "upgrade" =
        body.checkout_type === "upgrade" ? "upgrade" : "initial";

      const supabase = getSupabaseAdminClient();

      const { data: subscription, error: subError } = await supabase
        .from("subscriptions")
        .select("plan_code, status, trial_ends_at")
        .eq("business_id", businessId)
        .single();
      if (subError || !subscription) {
        return NextResponse.json({ error: "Suscripción no encontrada." }, { status: 404 });
      }

      const currentPlanCode = subscription.plan_code ?? "starter";

      // Determine target plan
      let targetPlanCode = currentPlanCode;

      if (checkoutType === "upgrade" && requestedPlanCode) {
        const upgradeCheck = canUpgradeTo(currentPlanCode, requestedPlanCode);
        if (!upgradeCheck.allowed) {
          return NextResponse.json({ error: upgradeCheck.reason }, { status: 400 });
        }
        targetPlanCode = requestedPlanCode;
      }

      const { data: plan, error: planError } = await supabase
        .from("plans")
        .select("code, name, price_monthly, currency")
        .eq("code", targetPlanCode)
        .maybeSingle();
      if (planError || !plan || !plan.price_monthly) {
        return NextResponse.json({ error: "Plan no disponible para cobro." }, { status: 400 });
      }

      const { data: payment, error: paymentError } = await supabase
        .from("payments")
        .insert({
          business_id: businessId,
          user_id: user.sub,
          email: user.email,
          plan_code: targetPlanCode,
          checkout_type: checkoutType,
          status: "pending",
          amount: plan.price_monthly,
          currency: plan.currency ?? "ARS",
          metadata: {
            triggered_by: checkoutType,
            user_id: user.sub,
            business_id: businessId,
            email: user.email,
            current_plan: currentPlanCode,
            target_plan: targetPlanCode,
            plan_code: targetPlanCode,
          },
          updated_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (paymentError || !payment) {
        return NextResponse.json({ error: "Error creando el registro de pago." }, { status: 500 });
      }

      const appUrl = getAppUrl();

      console.log(`[mp/checkout] business_id=${businessId}`);
      console.log(`[mp/checkout] checkout_type=${checkoutType}`);
      console.log(`[mp/checkout] current_plan=${currentPlanCode}`);
      console.log(`[mp/checkout] target_plan=${targetPlanCode}`);
      console.log(`[mp/checkout] amount=${plan.price_monthly} ${plan.currency ?? "ARS"}`);
      console.log(`[mp/checkout] payment_record_id=${payment.id}`);

      const client = getMpClient();
      const preApprovalClient = new PreApproval(client);

      const title =
        checkoutType === "upgrade"
          ? `Upgrade a ${plan.name} — Agente WhatsApp`
          : `Plan ${plan.name} — Agente WhatsApp`;

      const access = await checkAccountAccess(businessId);
      const now = new Date();
      const trialEnd =
        subscription.trial_ends_at && new Date(subscription.trial_ends_at).getTime() > now.getTime()
          ? new Date(subscription.trial_ends_at)
          : null;

      const result = await preApprovalClient.create({
        body: {
          reason: title,
          payer_email: user.email,
          external_reference: payment.id,
          back_url: `${appUrl}/payment/success`,
          status: "pending",
          auto_recurring: {
            frequency: 1,
            frequency_type: "months",
            transaction_amount: plan.price_monthly,
            currency_id: plan.currency ?? "ARS",
            ...(trialEnd ? { start_date: trialEnd.toISOString() } : {}),
          },
        },
      });

      if (!result.id || !result.init_point) {
        return NextResponse.json({ error: "Mercado Pago no devolvió un checkout válido." }, { status: 502 });
      }

      console.log(`[mp/checkout] preapproval created id=${result.id}`);
      console.log(`[mp/checkout] checkout_url=${result.init_point}`);

      await supabase
        .from("payments")
        .update({
          mp_preapproval_id: result.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", payment.id);

      await supabase
        .from("subscriptions")
        .update({
          mercado_pago_preapproval_id: result.id,
          mercado_pago_preapproval_status: result.status ?? "pending",
          ...(access.canUseApp ? {} : { status: "pending_payment" }),
          updated_at: new Date().toISOString(),
        })
        .eq("business_id", businessId);

      return NextResponse.json({ checkoutUrl: result.init_point });
    });
  } catch (error) {
    console.error("[mp/checkout] error:", error);
    return toDashboardAuthResponse(error);
  }
}
