-- Migration 015: asegurar deduplicación de outbox sin errores 400
--
-- Algunos entornos pueden no haber aplicado la migración 005 completa.
-- Esta guardia es idempotente y evita errores al consultar external_message_id.

ALTER TABLE outbox_messages
  ADD COLUMN IF NOT EXISTS external_message_id text;

CREATE INDEX IF NOT EXISTS idx_outbox_external_message_id
  ON outbox_messages (business_id, external_message_id)
  WHERE external_message_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
