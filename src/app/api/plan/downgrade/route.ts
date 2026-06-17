import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Downgrade deshabilitado por decisión de producto: no se permite bajar de plan
// ni hay prorrateo. El endpoint queda bloqueado a propósito (la función interna
// downgradePlan se conserva por si se necesita desde una herramienta de soporte).
export async function POST() {
  return NextResponse.json(
    { error: "El cambio a un plan inferior no está disponible. Escribinos si necesitás ayuda con tu plan." },
    { status: 403 }
  );
}
