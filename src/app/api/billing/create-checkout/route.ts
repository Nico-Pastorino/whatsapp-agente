import { NextResponse } from "next/server";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { toDashboardAuthResponse, withDashboardBusinessContext } from "@/lib/route-auth";

export const dynamic = "force-dynamic";

function getMpClient(): MercadoPagoConfig {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) throw new Error("MERCADOPAGO_ACCESS_TOKEN no configurado.");
  return new MercadoPagoConfig({ accessToken: token });
}

/**
 * URL base de la app.
 * Configurar en Vercel como: NEXT_PUBLIC_APP_URL=https://whatsapp-agente.vercel.app
 * Sin barra final.
 */
function getAppUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  // Fallback automático en Vercel (VERCEL_URL no incluye el protocolo)
  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) return `https://${vercelUrl}`;

  return "http://localhost:3000";
}

export async function POST() {
  try {
    return await withDashboardBusinessContext(async ({ businessId }) => {
      const supabase = getSupabaseAdminClient();

      // Get current subscription and plan
      const { data: subscription, error: subError } = await supabase
        .from("subscriptions")
        .select("plan_code, status")
        .eq("business_id", businessId)
        .single();
      if (subError || !subscription) {
        return NextResponse.json({ error: "Suscripción no encontrada." }, { status: 404 });
      }

      const { data: plan, error: planError } = await supabase
        .from("plans")
        .select("code, name, price_monthly, currency")
        .eq("code", subscription.plan_code ?? "starter")
        .maybeSingle();
      if (planError || !plan || !plan.price_monthly) {
        return NextResponse.json({ error: "Plan no disponible para cobro." }, { status: 400 });
      }

      // Create internal payment record
      const { data: payment, error: paymentError } = await supabase
        .from("payments")
        .insert({
          business_id: businessId,
          plan_code: plan.code,
          status: "pending",
          amount: plan.price_monthly,
          currency: plan.currency ?? "ARS",
          metadata: { triggered_by: "checkout" },
          updated_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (paymentError || !payment) {
        return NextResponse.json({ error: "Error creando el registro de pago." }, { status: 500 });
      }

      const appUrl = getAppUrl();
      const notificationUrl = `${appUrl}/api/webhooks/mercadopago`;

      console.log(`[mp/checkout] business_id=${businessId}`);
      console.log(`[mp/checkout] plan=${plan.code} amount=${plan.price_monthly} ${plan.currency ?? "ARS"}`);
      console.log(`[mp/checkout] payment_record_id=${payment.id}`);
      console.log(`[mp/checkout] notification_url=${notificationUrl}`);

      const client = getMpClient();
      const preferenceClient = new Preference(client);

      const result = await preferenceClient.create({
        body: {
          items: [
            {
              id: plan.code,
              title: `Plan ${plan.name} — Agente WhatsApp`,
              quantity: 1,
              currency_id: "ARS",
              unit_price: plan.price_monthly,
            },
          ],
          back_urls: {
            success: `${appUrl}/payment/success`,
            failure: `${appUrl}/payment/failure`,
            pending: `${appUrl}/payment/pending`,
          },
          // notification_url: URL que Mercado Pago llama vía POST desde sus servidores
          // al confirmar, rechazar o actualizar el estado del pago.
          // Debe ser pública (no localhost) y manejar POST.
          notification_url: notificationUrl,
          auto_return: "approved",
          external_reference: payment.id,
          metadata: {
            business_id: businessId,
            plan_code: plan.code,
            payment_id: payment.id,
          },
        },
      });

      console.log(`[mp/checkout] preference created id=${result.id}`);
      console.log(`[mp/checkout] checkout_url=${result.init_point}`);

      // Save MP preference ID
      await supabase
        .from("payments")
        .update({ mp_preference_id: result.id, updated_at: new Date().toISOString() })
        .eq("id", payment.id);

      return NextResponse.json({ checkoutUrl: result.init_point });
    });
  } catch (error) {
    console.error("[mp/checkout] error:", error);
    return toDashboardAuthResponse(error);
  }
}
