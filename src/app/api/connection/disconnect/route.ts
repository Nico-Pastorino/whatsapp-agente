import { NextResponse } from "next/server";
import { requestWhatsappDisconnect } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST() {
  await requestWhatsappDisconnect();

  return NextResponse.json({ ok: true });
}
