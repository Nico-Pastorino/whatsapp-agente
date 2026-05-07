-- Migration 008: retry_count en outbox_messages
--
-- Agrega un contador de reintentos al outbox para evitar que mensajes
-- con errores permanentes (ej: JID inválido, @lid sin teléfono) se reintenten
-- indefinidamente cada 2s.
--
-- Después de MAX_RETRIES (3) intentos fallidos, el worker deja de procesar
-- ese mensaje. El operador puede verlo en el dashboard si se agrega UI de errores.
--
-- SEGURO: ADD COLUMN con default → no rompe filas existentes.
-- Idempotente: IF NOT EXISTS → se puede correr múltiples veces.
--
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run

alter table outbox_messages
  add column if not exists retry_count integer not null default 0;

create index if not exists idx_outbox_retry
  on outbox_messages (business_id, sent, retry_count, created_at)
  where sent = false;

notify pgrst, 'reload schema';
