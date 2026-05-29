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
