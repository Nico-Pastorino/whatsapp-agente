-- ════════════════════════════════════════════════════════════════
-- APLICAR EN SUPABASE → SQL Editor → New query → pegar TODO → Run
-- Seguro y repetible (IF NOT EXISTS / ON CONFLICT). No borra datos.
-- Combina las migraciones 020 + 021.
-- ════════════════════════════════════════════════════════════════

-- Migration 020: Pricing v3 (3 planes más baratos) + base de conocimiento + agenda de turnos
--
-- Precios nuevos (ARS/mes):
--   Starter  $29.000  · 20 productos  · 3 usuarios  · 1 número
--   Growth   $59.000  · 150 productos · 10 usuarios · 1 número  (reactivado como plan activo)
--   Pro      $99.000  · 1000 productos· 25 usuarios · 3 números
--
-- Features nuevas por plan: knowledge_base (Growth+), appointments/agenda (Growth+).
-- El descuento anual (20%) se calcula en el checkout, no se guarda como plan aparte.

-- ── Planes ───────────────────────────────────────────────────────────────────
UPDATE plans SET
  name                   = 'Starter',
  price_monthly          = 29000,
  currency               = 'ARS',
  conversation_limit     = NULL,
  product_limit          = 20,
  users_limit            = 3,
  whatsapp_numbers_limit = 1,
  features = jsonb_build_object(
    'shared_inbox', true,
    'ai_assistant', true,
    'human_handoff', true,
    'template_tiers', jsonb_build_array('basic')
  )
WHERE code = 'starter';

INSERT INTO plans (code, name, price_monthly, currency, conversation_limit, product_limit, users_limit, whatsapp_numbers_limit, features)
VALUES (
  'growth', 'Growth', 59000, 'ARS', NULL, 150, 10, 1,
  jsonb_build_object(
    'shared_inbox', true,
    'ai_assistant', true,
    'human_handoff', true,
    'usage_visibility', true,
    'knowledge_base', true,
    'appointments', true,
    'template_tiers', jsonb_build_array('basic', 'commercial')
  )
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  price_monthly = EXCLUDED.price_monthly,
  currency = EXCLUDED.currency,
  conversation_limit = EXCLUDED.conversation_limit,
  product_limit = EXCLUDED.product_limit,
  users_limit = EXCLUDED.users_limit,
  whatsapp_numbers_limit = EXCLUDED.whatsapp_numbers_limit,
  features = EXCLUDED.features;

INSERT INTO plans (code, name, price_monthly, currency, conversation_limit, product_limit, users_limit, whatsapp_numbers_limit, features)
VALUES (
  'pro', 'Pro', 99000, 'ARS', NULL, 1000, 25, 3,
  jsonb_build_object(
    'shared_inbox', true,
    'ai_assistant', true,
    'human_handoff', true,
    'usage_visibility', true,
    'knowledge_base', true,
    'appointments', true,
    'priority_support', true,
    'template_tiers', jsonb_build_array('basic', 'commercial', 'premium')
  )
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  price_monthly = EXCLUDED.price_monthly,
  currency = EXCLUDED.currency,
  conversation_limit = EXCLUDED.conversation_limit,
  product_limit = EXCLUDED.product_limit,
  users_limit = EXCLUDED.users_limit,
  whatsapp_numbers_limit = EXCLUDED.whatsapp_numbers_limit,
  features = EXCLUDED.features;

-- ── Base de conocimiento + agenda en business_settings ───────────────────────
ALTER TABLE business_settings
  ADD COLUMN IF NOT EXISTS knowledge_base   TEXT    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS booking_enabled  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS booking_config   TEXT    NOT NULL DEFAULT '';

-- ── Tabla de turnos (para registrar/consultar reservas tomadas) ──────────────
CREATE TABLE IF NOT EXISTS appointments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
  contact_id      uuid REFERENCES contacts(id) ON DELETE SET NULL,
  customer_name   text,
  service         text,
  starts_at       timestamptz,
  notes           text,
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'confirmed', 'cancelled', 'done')),
  source          text NOT NULL DEFAULT 'ai'
                    CHECK (source IN ('ai', 'human')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointments_business_starts
  ON appointments (business_id, starts_at);


-- Migration 021: teléfono en turnos + notificaciones internas al encargado
--
-- Aditiva y segura (ADD COLUMN / CREATE TABLE IF NOT EXISTS). No borra ni modifica datos.
-- Depende de 020 (tabla appointments + columnas de booking).

-- ── Teléfono del cliente en turnos ───────────────────────────────────────────
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS customer_phone text;

-- ── Configuración de avisos internos en business_settings ────────────────────
-- notify_enabled : interruptor general
-- notify_phone   : número del dueño/encargado (solo dígitos, formato internacional)
-- notify_events  : array de eventos a avisar, ej: ["new_appointment","human_handoff"]
ALTER TABLE business_settings
  ADD COLUMN IF NOT EXISTS notify_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_phone   text    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS notify_events  jsonb   NOT NULL DEFAULT '[]'::jsonb;

-- ── Historial / cola de notificaciones internas ──────────────────────────────
-- El worker es quien las envía por WhatsApp (Baileys vive fuera de Vercel).
-- dedup_key garantiza que un mismo evento no se avise dos veces.
CREATE TABLE IF NOT EXISTS internal_notifications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  event_type   text NOT NULL,
  content      text NOT NULL,
  target_jid   text NOT NULL,
  dedup_key    text,
  status       text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  error        text,
  retry_count  integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  sent_at      timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_internal_notifications_dedup
  ON internal_notifications (business_id, dedup_key)
  WHERE dedup_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_internal_notifications_pending
  ON internal_notifications (business_id, status, created_at)
  WHERE status = 'pending';
