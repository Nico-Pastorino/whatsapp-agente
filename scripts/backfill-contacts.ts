/**
 * Backfill contact_id en conversaciones legacy.
 *
 * Las conversaciones creadas antes del sistema de contactos tienen
 * contact_id = NULL. Este script:
 *   1. Encuentra todas esas conversaciones.
 *   2. Crea (o encuentra) un contacto por phone_jid.
 *   3. Actualiza contact_id en la conversación.
 *
 * Por defecto corre en modo dry-run (solo muestra qué haría).
 * Para ejecutar los cambios: npx tsx scripts/backfill-contacts.ts --execute
 *
 * Uso:
 *   npm run backfill:contacts           → dry-run
 *   npm run backfill:contacts -- --execute  → ejecuta el backfill
 */

import "./env-loader";
import { createClient } from "@supabase/supabase-js";
import { normalizeWhatsAppJid } from "../src/lib/whatsapp-jid";

const DRY_RUN = !process.argv.includes("--execute");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const businessId = process.env.BUSINESS_ID!;

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !businessId) {
  console.error("❌ Faltan NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY o BUSINESS_ID");
  process.exit(1);
}

interface ConvRow {
  id: string;
  phone_jid: string | null;
  display_name: string | null;
  created_at: string;
}

async function findOrCreateContact(
  phoneJid: string,
  displayName: string | null
): Promise<string> {
  const normalizedJid = normalizeWhatsAppJid(phoneJid);
  const phoneNumber = normalizedJid.split("@")[0];

  // Try to find existing contact by primary_jid or phone_number
  const { data: existing } = await supabase
    .from("contacts")
    .select("id")
    .eq("business_id", businessId)
    .eq("primary_jid", normalizedJid)
    .limit(1)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: byPhone } = await supabase
    .from("contacts")
    .select("id")
    .eq("business_id", businessId)
    .eq("phone_number", phoneNumber)
    .limit(1)
    .maybeSingle();

  if (byPhone) return byPhone.id;

  // Create new contact
  const { data: created, error } = await supabase
    .from("contacts")
    .insert({
      business_id: businessId,
      display_name: displayName ?? null,
      phone_number: phoneNumber,
      primary_jid: normalizedJid,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !created) throw new Error(`Error creando contacto: ${error?.message}`);
  return created.id;
}

async function upsertIdentity(contactId: string, type: string, value: string): Promise<void> {
  await supabase.from("contact_identities").upsert(
    { business_id: businessId, contact_id: contactId, identity_type: type, identity_value: value },
    { onConflict: "business_id,identity_value", ignoreDuplicates: true }
  );
}

async function run(): Promise<void> {
  console.log(DRY_RUN
    ? "\n🔍 Modo DRY-RUN — no se modificará nada\n"
    : "\n⚡ Modo EXECUTE — se realizarán cambios en Supabase\n"
  );

  // Load all conversations without contact_id
  const { data: convs, error } = await supabase
    .from("conversations")
    .select("id, phone_jid, display_name, created_at")
    .eq("business_id", businessId)
    .is("contact_id", null)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Error cargando conversaciones: ${error.message}`);

  const allConvs = (convs ?? []) as ConvRow[];
  const legacy = allConvs.filter((c) => c.phone_jid?.endsWith("@s.whatsapp.net"));

  if (legacy.length === 0) {
    console.log("✓ No hay conversaciones sin contact_id.\n");
  } else {
    const skipped = allConvs.length - legacy.length;
    console.log(`Total sin contact_id: ${allConvs.length}`);
    console.log(`  Con @s.whatsapp.net (backfilleables): ${legacy.length}`);
    console.log(`  Sin phone_jid o @lid (se omiten): ${skipped}\n`);

    let fixed = 0;
    for (const conv of legacy) {
      const jid = conv.phone_jid!;
      console.log(`  Conversación ${conv.id} | jid=${jid} | name="${conv.display_name ?? ""}"`);

      if (DRY_RUN) {
        console.log(`    [dry-run] Crearía/encontraría contacto para ${jid} y actualizaría contact_id`);
        continue;
      }

      const contactId = await findOrCreateContact(jid, conv.display_name);
      const phoneNumber = normalizeWhatsAppJid(jid).split("@")[0];
      await upsertIdentity(contactId, "pn_jid", jid);
      await upsertIdentity(contactId, "phone", phoneNumber);

      const { error: updateErr } = await supabase
        .from("conversations")
        .update({ contact_id: contactId, updated_at: new Date().toISOString() })
        .eq("id", conv.id);

      if (updateErr) {
        console.warn(`    ⚠️  No se pudo actualizar ${conv.id}: ${updateErr.message}`);
      } else {
        console.log(`    ✓ contact_id=${contactId}`);
        fixed++;
      }
    }

    if (DRY_RUN) {
      console.log(`\n📋 Fin del dry-run. Para ejecutar:`);
      console.log(`   npx tsx scripts/backfill-contacts.ts --execute\n`);
    } else {
      console.log(`\n✅ Backfill completado. ${fixed} conversaciones actualizadas.\n`);
    }
  }

  // ── Detectar contactos con LID usado como número de teléfono (bug) ──
  console.log("\n── Verificando contactos con LID como phone ──");
  await fixLidAsPhone();
}

/**
 * Detecta y corrige contactos donde el LID fue almacenado como número de
 * teléfono (primary_jid = "[lid_local]@s.whatsapp.net").
 * Esto sucede cuando senderPn devuelve el LID en vez de un teléfono real.
 */
async function fixLidAsPhone(): Promise<void> {
  // Find contact_identities of type lid_jid
  const { data: lidIdentities } = await supabase
    .from("contact_identities")
    .select("contact_id, identity_value")
    .eq("business_id", businessId)
    .eq("identity_type", "lid_jid");

  if (!lidIdentities || lidIdentities.length === 0) {
    console.log("  ✓ No hay identidades @lid en el sistema.");
    return;
  }

  let badCount = 0;
  for (const lid of lidIdentities) {
    const lidLocalPart = (lid.identity_value as string).split("@")[0] ?? "";
    const fakePnJid = `${lidLocalPart}@s.whatsapp.net`;

    // Check if the contact's primary_jid matches the fake JID
    const { data: contact } = await supabase
      .from("contacts")
      .select("id, display_name, primary_jid, phone_number")
      .eq("business_id", businessId)
      .eq("id", lid.contact_id)
      .maybeSingle();

    if (!contact) continue;
    if (contact.primary_jid !== fakePnJid) continue;

    badCount++;
    console.log(`  ⚠️  Contacto ${contact.id} ("${contact.display_name ?? "sin nombre"}")`);
    console.log(`      primary_jid=${contact.primary_jid} (es un LID, no un teléfono real)`);
    console.log(`      lid_jid=${lid.identity_value}`);

    if (DRY_RUN) {
      console.log(`      [dry-run] Limpiaría primary_jid y phone_number del contacto`);
      console.log(`      [dry-run] Borraría identidades falsas pn_jid y phone del LID`);
      console.log(`      [dry-run] Resetearía phone_jid de la conversación a null`);
      continue;
    }

    // 1. Clear wrong phone data from contact
    await supabase
      .from("contacts")
      .update({ primary_jid: null, phone_number: null, updated_at: new Date().toISOString() })
      .eq("business_id", businessId)
      .eq("id", contact.id);

    // 2. Remove fake pn_jid and phone identities (those created from the LID local part)
    await supabase
      .from("contact_identities")
      .delete()
      .eq("business_id", businessId)
      .eq("contact_id", contact.id)
      .eq("identity_type", "pn_jid")
      .eq("identity_value", fakePnJid);

    await supabase
      .from("contact_identities")
      .delete()
      .eq("business_id", businessId)
      .eq("contact_id", contact.id)
      .eq("identity_type", "phone")
      .eq("identity_value", lidLocalPart);

    // 3. Reset conversation's phone_jid to the @lid JID so the dashboard shows it clearly
    await supabase
      .from("conversations")
      .update({ phone_jid: lid.identity_value, updated_at: new Date().toISOString() })
      .eq("business_id", businessId)
      .eq("contact_id", contact.id);

    console.log(`      ✓ Contacto corregido. Ahora requiere asociar teléfono real.`);
  }

  if (badCount === 0) {
    console.log("  ✓ No se encontraron contactos con LID como phone.");
  } else if (DRY_RUN) {
    console.log(`\n  ${badCount} contacto(s) con LID-como-phone detectado(s).`);
    console.log("  Ejecutar con --execute para corregirlos.\n");
  } else {
    console.log(`\n  ✓ ${badCount} contacto(s) corregidos.\n`);
  }
}

run().catch((err) => {
  console.error("\n❌ Error:", err.message ?? err);
  process.exit(1);
});
