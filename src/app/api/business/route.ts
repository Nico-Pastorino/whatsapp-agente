import { NextRequest, NextResponse } from "next/server";
import { getBusinessProfile, setBusinessProfile } from "@/lib/db";
import { toDashboardAuthResponse, withDashboardBusinessContext } from "@/lib/route-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return await withDashboardBusinessContext(async ({ businessId }) => {
      const profile = await getBusinessProfile(businessId);
      return NextResponse.json({
        ...profile,
      });
    });
  } catch (error) {
    return toDashboardAuthResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    return await withDashboardBusinessContext(async ({ businessId }) => {
      const body = await req.json();

      const name: string = (body.name ?? "").trim();
      const description: string = (body.description ?? "").trim();
      const extra: string = (body.extra ?? "").trim();

      const rawProducts = Array.isArray(body.products) ? body.products : [];
      const products = rawProducts
        .filter((p: { name?: string }) => typeof p.name === "string" && p.name.trim())
        .map((p: { name: string; price?: string; description?: string }) => ({
          name: p.name.trim(),
          price: (p.price ?? "").trim(),
          description: (p.description ?? "").trim(),
        }));

      await setBusinessProfile(
        {
          name,
          description,
          products,
          extra,
        },
        businessId
      );

      return NextResponse.json({ ok: true });
    });
  } catch (error) {
    return toDashboardAuthResponse(error);
  }
}
