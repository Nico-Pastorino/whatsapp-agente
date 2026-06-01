import { NextRequest, NextResponse } from "next/server";
import { getBusinessProfile, setBusinessProfile, canUseTemplate } from "@/lib/db";
import { toDashboardAuthResponse, withActiveDashboardBusinessContext } from "@/lib/route-auth";
import {
  getTemplateById,
  buildExtraFromTemplate,
  buildKnowledgeBaseFromTemplate,
} from "@/lib/business-templates";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    return await withActiveDashboardBusinessContext(async ({ businessId }) => {
      const body = await req.json();
      const templateId = typeof body.templateId === "string" ? body.templateId.trim() : "";
      const mode: "merge" | "replace" = body.mode === "replace" ? "replace" : "merge";

      if (!templateId) {
        return NextResponse.json({ error: "Elegí una plantilla para continuar." }, { status: 400 });
      }

      const template = getTemplateById(templateId);
      if (!template || template.comingSoon) {
        return NextResponse.json({ error: "Plantilla no encontrada." }, { status: 404 });
      }

      // Validate plan access
      const access = await canUseTemplate(businessId, template.tier);
      if (!access.allowed) {
        const planName = "Pro";
        return NextResponse.json(
          { error: `Esta plantilla está disponible en el plan ${planName}.` },
          { status: 403 }
        );
      }

      const current = await getBusinessProfile(businessId);
      const templateExtra = buildExtraFromTemplate(template);
      const templateKnowledgeBase = buildKnowledgeBaseFromTemplate(template);
      const templateProducts = template.suggestedCategories.map((cat) => ({
        name: cat,
        price: "",
        description: "",
      }));
      const templateBookingConfig = template.bookingConfig ?? "";

      if (mode === "replace") {
        await setBusinessProfile(
          {
            name: current.name,
            description: template.botGoal,
            products: templateProducts,
            extra: templateExtra,
            knowledge_base: templateKnowledgeBase,
            booking_enabled: Boolean(templateBookingConfig),
            booking_config: templateBookingConfig,
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
        const existingKnowledgeBase = current.knowledge_base?.trim() ?? "";
        const newKnowledgeBase = existingKnowledgeBase
          ? `${existingKnowledgeBase}\n\n---\nBase sugerida: ${template.name}\n${templateKnowledgeBase}`
          : templateKnowledgeBase;

        await setBusinessProfile(
          {
            name: current.name,
            description: newDescription,
            products: newProducts,
            extra: newExtra,
            knowledge_base: newKnowledgeBase,
            booking_enabled: current.booking_enabled || Boolean(templateBookingConfig),
            booking_config: current.booking_config?.trim()
              ? current.booking_config
              : templateBookingConfig,
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
