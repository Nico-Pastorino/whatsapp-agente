import { NextRequest, NextResponse } from "next/server";
import { getBusinessProfile, setBusinessProfile, canUseTemplate } from "@/lib/db";
import { toDashboardAuthResponse, withActiveRoleDashboardBusinessContext } from "@/lib/route-auth";
import {
  getTemplateById,
  buildExtraFromTemplate,
  buildKnowledgeBaseFromTemplate,
  mapTemplateTone,
} from "@/lib/business-templates";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    return await withActiveRoleDashboardBusinessContext(["owner", "admin"], async ({ businessId }) => {
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
      // All content now goes into `extra`; knowledge_base is kept empty for new applies
      const _templateKnowledgeBase = buildKnowledgeBaseFromTemplate(template);
      const templateToneCode = mapTemplateTone(template);
      // Las plantillas NO crean productos. Antes generaban ítems con name=categoría
      // y precio/descripción vacíos, que ensuciaban el catálogo y el contador, y el
      // asistente no podía usarlos (sin precio = placeholder). Las categorías
      // sugeridas se usan solo como ayuda/autocompletado al cargar productos.
      const templateBookingConfig = template.bookingConfig ?? "";

      if (mode === "replace") {
        await setBusinessProfile(
          {
            name: current.name,
            description: template.botGoal,
            products: current.products ?? [],
            extra: templateExtra,
            knowledge_base: "",
            booking_enabled: Boolean(templateBookingConfig),
            booking_config: templateBookingConfig,
            response_tone: templateToneCode,
          },
          businessId
        );
      } else {
        // merge: fill empty fields, append to non-empty, deduplicate products
        const newDescription = current.description?.trim()
          ? current.description
          : template.botGoal;

        // No tocamos el catálogo: las plantillas solo aportan textos/configuración.
        const newProducts = current.products ?? [];

        const existingExtra = current.extra?.trim() ?? "";
        // Evitar duplicación: si esta plantilla ya fue aplicada (el bloque ya
        // está en `extra`), no volver a anexar el mismo contenido. Instrucciones
        // repetidas inflan el prompt de la IA y degradan las respuestas.
        const templateAlreadyApplied =
          existingExtra.includes(`Plantilla: ${template.name}`) ||
          existingExtra.includes(templateExtra.trim());
        const newExtra = !existingExtra
          ? templateExtra
          : templateAlreadyApplied
          ? existingExtra
          : `${existingExtra}\n\n---\nPlantilla: ${template.name}\n${templateExtra}`;

        // In merge mode, don't touch knowledge_base if it has content (backwards compat)
        const existingKnowledgeBase = current.knowledge_base?.trim() ?? "";

        await setBusinessProfile(
          {
            name: current.name,
            description: newDescription,
            products: newProducts,
            extra: newExtra,
            knowledge_base: existingKnowledgeBase || "",
            booking_enabled: current.booking_enabled || Boolean(templateBookingConfig),
            booking_config: current.booking_config?.trim()
              ? current.booking_config
              : templateBookingConfig,
            response_tone: current.response_tone?.trim()
              ? current.response_tone
              : templateToneCode,
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
