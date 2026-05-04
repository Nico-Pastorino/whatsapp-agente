/**
 * Merge de conversaciones duplicadas.
 *
 * Detecta contactos con múltiples conversaciones causadas por variantes
 * del mismo JID (ej: con y sin sufijo :N, con y sin @s.whatsapp.net).
 *
 * Por defecto corre en modo dry-run (solo muestra qué haría).
 * Para ejecutar los cambios: npx tsx scripts/merge-duplicate-conversations.ts --execute
 *
 * Uso:
 *   npm run merge:duplicates           → dry-run
 *   npm run merge:duplicates -- --execute  → ejecuta el merge
 */

import "./env-loader";
import { createClient } from "@supabase/supabase-js";
import { normalizeWhatsAppJid, extractPhoneFromJid } from "../src/lib/whatsapp-jid";

const DRY_RUN = !process.argv.includes("--execute");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const businessId = process.env.BUSINESS_ID!;

if (!supabase || !businessId) {
  console.error("❌ Faltan NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY o BUSINESS_ID");
  process.exit(1);
}

// ---- tipos ----

interface ConvRow {
  id: string;
  phone_jid: string;
  display_name: string | null;
  mode: "AI" | "HUMAN";
  last_message_at: string | null;
  created_at: string;
  msg_count?: number;
}

// ---- helpers ----

async function countMessages(conversationId: string): Promise<number> {
  const { count } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversationId);
  return count ?? 0;
}

async function run(): Promise<void> {
  console.log(DRY_RUN
    ? "\n🔍 Modo DRY-RUN — no se modificará nada\n"
    : "\n⚡ Modo EXECUTE — se realizarán cambios en Supabase\n"
  );

  // 1. Cargar todas las conversaciones del negocio
  const { data: allConvs, error } = await supabase
    .from("conversations")
    .select("id, phone_jid, display_name, mode, last_message_at, created_at")
    .eq("business_id", businessId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Error al cargar conversaciones: ${error.message}`);
  if (!allConvs || allConvs.length === 0) {
    console.log("✓ No hay conversaciones en este negocio.");
    return;
  }

  console.log(`Total conversaciones: ${allConvs.length}`);
  for (const conv of allConvs as ConvRow[]) {
    const canonical = normalizeWhatsAppJid(conv.phone_jid);
    console.log(`  • ${conv.phone_jid} → canónico: ${canonical} | name="${conv.display_name}" | mode=${conv.mode}`);
  }
  console.log("");

  // 2. Agrupar por número canónico O por display_name (para @lid vs @s.whatsapp.net)
  //    WhatsApp asigna @lid a mensajes de WA Web y @s.whatsapp.net al teléfono.
  //    Ambos representan el mismo contacto físico.
  const groups = new Map<string, ConvRow[]>();

  for (const conv of allConvs as ConvRow[]) {
    const canonical = normalizeWhatsAppJid(conv.phone_jid);
    const numericKey = extractPhoneFromJid(canonical) ?? canonical;

    // Si es @lid y tiene display_name, intentar agrupar con el @s.whatsapp.net del mismo nombre
    if (conv.phone_jid.endsWith("@lid") && conv.display_name) {
      const nameKey = `name:${conv.display_name.trim().toLowerCase()}`;
      if (!groups.has(nameKey)) groups.set(nameKey, []);
      groups.get(nameKey)!.push(conv);
    } else if (conv.display_name) {
      // Para @s.whatsapp.net: registrar también por name para que el @lid lo encuentre
      const nameKey = `name:${conv.display_name.trim().toLowerCase()}`;
      if (!groups.has(nameKey)) groups.set(nameKey, []);
      groups.get(nameKey)!.push(conv);
    } else {
      // Sin nombre: agrupar solo por número canónico
      if (!groups.has(numericKey)) groups.set(numericKey, []);
      groups.get(numericKey)!.push(conv);
    }
  }

  // 3. Identificar grupos con duplicados
  const duplicateGroups = [...groups.entries()].filter(([, convs]) => convs.length > 1);

  if (duplicateGroups.length === 0) {
    console.log("✓ No hay conversaciones duplicadas.\n");
    return;
  }

  console.log(`⚠️  Grupos con duplicados: ${duplicateGroups.length}\n`);

  let totalMerged = 0;

  for (const [phone, convs] of duplicateGroups) {
    console.log(`\n── Contacto: ${phone} (${convs.length} conversaciones) ──`);

    // Contar mensajes por conversación
    const withCounts: ConvRow[] = [];
    for (const conv of convs) {
      const count = await countMessages(conv.id);
      withCounts.push({ ...conv, msg_count: count });
      console.log(
        `   id=${conv.id}  jid="${conv.phone_jid}"  mode=${conv.mode}  mensajes=${count}  created=${conv.created_at.slice(0, 10)}`
      );
    }

    // Elegir conversación principal:
    // 1. Preferir @s.whatsapp.net sobre @lid (número real sobre LID anónimo)
    // 2. Si alguna está en HUMAN, preferirla (es la que el operador usó)
    // 3. Entre las candidatas, la que tenga más mensajes
    // 4. En empate, la más antigua
    const phoneConvs = withCounts.filter(c => !c.phone_jid.endsWith("@lid"));
    const humanConvs = withCounts.filter(c => c.mode === "HUMAN");
    let candidates = phoneConvs.length > 0 ? phoneConvs : withCounts;
    if (humanConvs.length > 0) candidates = humanConvs;
    const primary = candidates.reduce((best, curr) =>
      (curr.msg_count ?? 0) > (best.msg_count ?? 0) ? curr : best
    );

    const duplicates = withCounts.filter(c => c.id !== primary.id);

    console.log(`   ✓ Principal: ${primary.id} (mode=${primary.mode}, mensajes=${primary.msg_count})`);
    console.log(`   → A mover a principal: ${duplicates.length} conversación(es)`);

    if (DRY_RUN) {
      for (const dup of duplicates) {
        console.log(`   [dry-run] Movería ${dup.msg_count} mensajes de ${dup.id} a ${primary.id}`);
        console.log(`   [dry-run] Movería outbox_messages de ${dup.id} a ${primary.id}`);
        console.log(`   [dry-run] Borraría conversación ${dup.id}`);
      }
      continue;
    }

    // ---- EXECUTE ----

    for (const dup of duplicates) {
      // 1. Normalizar phone_jid de la conversación principal
      const canonicalJid = normalizeWhatsAppJid(primary.phone_jid);

      // 2. Mover messages
      const { error: msgErr } = await supabase
        .from("messages")
        .update({ conversation_id: primary.id })
        .eq("conversation_id", dup.id);
      if (msgErr) throw new Error(`Error moviendo messages de ${dup.id}: ${msgErr.message}`);

      // 3. Mover outbox_messages pendientes
      const { error: outboxErr } = await supabase
        .from("outbox_messages")
        .update({ conversation_id: primary.id, target_jid: canonicalJid })
        .eq("conversation_id", dup.id)
        .eq("sent", false);
      if (outboxErr) throw new Error(`Error moviendo outbox de ${dup.id}: ${outboxErr.message}`);

      // 4. Actualizar last_message_at en la principal
      const latestAt = [primary.last_message_at, dup.last_message_at]
        .filter(Boolean)
        .sort()
        .pop();

      if (latestAt) {
        await supabase
          .from("conversations")
          .update({ last_message_at: latestAt, updated_at: new Date().toISOString() })
          .eq("id", primary.id);
      }

      // 5. Actualizar phone_jid de la principal al canónico
      await supabase
        .from("conversations")
        .update({ phone_jid: canonicalJid, updated_at: new Date().toISOString() })
        .eq("id", primary.id);

      // 6. Borrar la conversación duplicada (messages ya fueron movidos)
      const { error: delErr } = await supabase
        .from("conversations")
        .delete()
        .eq("id", dup.id);
      if (delErr) throw new Error(`Error borrando conversación ${dup.id}: ${delErr.message}`);

      console.log(`   ✓ Merge completado: ${dup.id} → ${primary.id}`);
      totalMerged++;
    }
  }

  if (DRY_RUN) {
    console.log(`\n📋 Fin del dry-run. Para ejecutar los cambios:`);
    console.log(`   npx tsx scripts/merge-duplicate-conversations.ts --execute\n`);
  } else {
    console.log(`\n✅ Merge completado. ${totalMerged} conversaciones duplicadas eliminadas.\n`);
  }
}

run().catch((err) => {
  console.error("\n❌ Error:", err.message ?? err);
  process.exit(1);
});
