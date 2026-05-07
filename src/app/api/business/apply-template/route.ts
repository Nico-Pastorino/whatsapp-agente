import { NextRequest, NextResponse } from "next/server";
import { getBusinessProfile, setBusinessProfile } from "@/lib/db";
import { toDashboardAuthResponse, withDashboardBusinessContext } from "@/lib/route-auth";
import { getTemplateById, buildExtraFromTemplate } from "@/lib/business-templates";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    return await withDashboardBusinessContext(async ({ businessId }) => {
      const body = await req.json();
      const templateId = typeof body.templateId === "string" ? body.templateId.trim() : "";
      const mode: "merge" | "replace" = body.mode === "replace" ? "replace" : "merge";

      if (!templateId) {
        return NextResponse.json({ error: "templateId requerido." }, { status: 400 });
      }

      const template = getTemplateById(templateId);
      if (!template || template.comingSoon) {
        return NextResponse.json({ error: "Plantilla no encontrada." }, { status: 404 });
      }

      const current = await getBusinessProfile(businessId);
      const templateExtra = buildExtraFromTemplate(template);
      const templateProducts = template.suggestedCategories.map((cat) => ({
        name: cat,
        price: "",
        description: "",
      }));

      if (mode === "replace") {
        await setBusinessProfile(
          {
            name: current.name,
            description: template.botGoal,
            products: templateProducts,
            extra: templateExtra,
          },
          businessId
        );
      } else {
        // merge: fill empty fields, append to non-empty, deduplicate products
        const newDescription = current.description?.trim()
          ? current.description
          : template.botGoal;

        const existingNames = new Set(
          (current.products ?? []).map((p) => p.name.toLowerCase().trim())
        );
        const newProducts = [
          ...(current.products ?? []),
          ...templateProducts.filter(
            (p) => !existingNames.has(p.name.toLowerCase().trim())
          ),
        ];

        const existingExtra = current.extra?.trim() ?? "";
        const newExtra = existingExtra
          ? `${existingExtra}\n\n---\nPlantilla: ${template.name}\n${templateExtra}`
          : templateExtra;

        await setBusinessProfile(
          {
            name: current.name,
            description: newDescription,
            products: newProducts,
            extra: newExtra,
          },
          businessId
        );
      }

      console.log(
        `[business/apply-template] business_id=${businessId} template=${templateId} mode=${mode}`
      );

      return NextResponse.json({ ok: true });
    });
  } catch (error) {
    return toDashboardAuthResponse(error);
  }
}
