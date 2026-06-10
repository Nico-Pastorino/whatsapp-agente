import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { getConnectionState } from "@/lib/db";
import { toDashboardAuthResponse, withVerifiedActiveDashboardBusinessContext } from "@/lib/route-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Verificado: el QR de conexión es la puerta al consumo operativo (IA/WhatsApp).
    return await withVerifiedActiveDashboardBusinessContext(async ({ businessId }) => {
      const state = await getConnectionState(businessId);

      const shouldShowQr =
        !!state.qr_string &&
        (state.status === "qr" || state.status === "connecting");

      if (shouldShowQr && state.qr_string) {
        const qrPng = await QRCode.toDataURL(state.qr_string, {
          width: 320,
          margin: 2,
        });
        return NextResponse.json({
          status: "qr",
          qrPng,
          updatedAt: state.updated_at,
          workerOnline: state.worker_online,
          // Vinculación por código (alternativa al QR)
          pairingCode: state.pairing_code,
          pairingPhone: state.pairing_phone,
        });
      }

      return NextResponse.json({
        status: state.status,
        phone: state.phone,
        updatedAt: state.updated_at,
        workerOnline: state.worker_online,
        pairingCode: state.pairing_code,
        pairingPhone: state.pairing_phone,
      });
    });
  } catch (error) {
    return toDashboardAuthResponse(error);
  }
}
