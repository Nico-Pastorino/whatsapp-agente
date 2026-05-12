import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { getConnectionState } from "@/lib/db";
import { toDashboardAuthResponse, withActiveDashboardBusinessContext } from "@/lib/route-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return await withActiveDashboardBusinessContext(async ({ businessId }) => {
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
        });
      }

      return NextResponse.json({
        status: state.status,
        phone: state.phone,
        updatedAt: state.updated_at,
        workerOnline: state.worker_online,
      });
    });
  } catch (error) {
    return toDashboardAuthResponse(error);
  }
}
