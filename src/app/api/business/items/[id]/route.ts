import { NextRequest, NextResponse } from "next/server";
import { updateBusinessItem, deleteBusinessItem } from "@/lib/db";
import { toDashboardAuthResponse, withActiveDashboardBusinessContext } from "@/lib/route-auth";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    return await withActiveDashboardBusinessContext(async ({ businessId }) => {
      const { id: itemId } = await params;
      const body = await req.json();

      const patch: Record<string, unknown> = {};
      if (typeof body.name === "string") patch.name = body.name.trim() || undefined;
      if (typeof body.item_type === "string") patch.item_type = body.item_type === "service" ? "service" : "product";
      if (body.category !== undefined) patch.category = typeof body.category === "string" ? body.category.trim() || null : null;
      if (body.description !== undefined) patch.description = typeof body.description === "string" ? body.description.trim() || null : null;
      if (body.price !== undefined) patch.price = typeof body.price === "string" ? body.price.trim() || null : null;
      if (body.promo_price !== undefined) patch.promo_price = typeof body.promo_price === "string" ? body.promo_price.trim() || null : null;
      if (body.stock_status !== undefined) {
        patch.stock_status = ["available", "unavailable", "on_demand"].includes(body.stock_status)
          ? body.stock_status
          : "available";
      }
      if (body.duration !== undefined) patch.duration = typeof body.duration === "string" ? body.duration.trim() || null : null;
      if (typeof body.requires_booking === "boolean") patch.requires_booking = body.requires_booking;
      if (body.payment_options !== undefined) patch.payment_options = typeof body.payment_options === "string" ? body.payment_options.trim() || null : null;
      if (body.financing_options !== undefined) patch.financing_options = typeof body.financing_options === "string" ? body.financing_options.trim() || null : null;
      if (body.internal_notes !== undefined) patch.internal_notes = typeof body.internal_notes === "string" ? body.internal_notes.trim() || null : null;
      if (typeof body.is_active === "boolean") patch.is_active = body.is_active;

      const updated = await updateBusinessItem(businessId, itemId, patch);
      return NextResponse.json({ item: updated });
    });
  } catch (error) {
    return toDashboardAuthResponse(error);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    return await withActiveDashboardBusinessContext(async ({ businessId }) => {
      const { id: itemId } = await params;
      await deleteBusinessItem(businessId, itemId);
      return NextResponse.json({ ok: true });
    });
  } catch (error) {
    return toDashboardAuthResponse(error);
  }
}
