import { NextRequest, NextResponse } from "next/server";
import { getBusinessProfile, setBusinessProfile } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const profile = await getBusinessProfile();
  return NextResponse.json({
    ...profile,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const name: string = (body.name ?? "").trim();
  const description: string = (body.description ?? "").trim();
  const extra: string = (body.extra ?? "").trim();

  // Validar y limpiar productos
  const rawProducts = Array.isArray(body.products) ? body.products : [];
  const products = rawProducts
    .filter((p: { name?: string }) => typeof p.name === "string" && p.name.trim())
    .map((p: { name: string; price?: string; description?: string }) => ({
      name: p.name.trim(),
      price: (p.price ?? "").trim(),
      description: (p.description ?? "").trim(),
    }));

  await setBusinessProfile({
    name,
    description,
    products,
    extra,
  });

  return NextResponse.json({ ok: true });
}
