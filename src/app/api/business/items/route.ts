import { NextRequest, NextResponse } from "next/server";
import {
  getCatalogCapacity,
  listBusinessItems,
  createBusinessItem,
} from "@/lib/db";
import { toDashboardAuthResponse, withActiveDashboardBusinessContext } from "@/lib/route-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return await withActiveDashboardBusinessContext(async ({ businessId }) => {
      const [items, capacity] = await Promise.all([
        listBusinessItems(businessId),
        getCatalogCapacity(businessId),
      ]);
      return NextResponse.json({ items, ...capacity });
    });
  } catch (error) {
    return toDashboardAuthResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    return await withActiveDashboardBusinessContext(async ({ businessId }) => {
      const body = await req.json();

      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name) {
        return NextResponse.json({ error: "El nombre es obligatorio." }, { status: 400 });
      }

      const item_type = body.item_type === "service" ? "service" : "product";

      try {
        const created = await createBusinessItem(businessId, {
          item_type,
          name,
          category: typeof body.category === "string" ? body.category.trim() || null : null,
          description: typeof body.description === "string" ? body.description.trim() || null : null,
          price: typeof body.price === "string" ? body.price.trim() || null : null,
          promo_price: typeof body.promo_price === "string" ? body.promo_price.trim() || null : null,
          stock_status:
            ["available", "unavailable", "on_demand"].includes(body.stock_status)
              ? body.stock_status
              : "available",
          duration: typeof body.duration === "string" ? body.duration.trim() || null : null,
          requires_booking: body.requires_booking === true,
          payment_options: typeof body.payment_options === "string" ? body.payment_options.trim() || null : null,
          financing_options: typeof body.financing_options === "string" ? body.financing_options.trim() || null : null,
          internal_notes: typeof body.internal_notes === "string" ? body.internal_notes.trim() || null : null,
          is_active: body.is_active !== false,
        });
        return NextResponse.json({ item: created });
      } catch (err) {
        if (err instanceof Error && (err as Error & { code?: string }).code === "CATALOG_LIMIT_EXCEEDED") {
          return NextResponse.json({ error: err.message }, { status: 403 });
        }
        throw err;
      }
    });
  } catch (error) {
    return toDashboardAuthResponse(error);
  }
}
