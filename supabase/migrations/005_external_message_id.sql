-- Migration 005: external_message_id para deduplicación de mensajes fromMe
--
-- Permite que el worker marque los mensajes enviados con el ID de Baileys,
-- evitando que el echo fromMe se guarde como un mensaje duplicado.
--
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run

alter table outbox_messages
  add column if not exists external_message_id text;

create index if not exists idx_messages_external_id
  on messages (business_id, external_message_id)
  where external_message_id is not null;

create index if not exists idx_outbox_external_id
  on outbox_messages (business_id, external_message_id)
  where external_message_id is not null;

notify pgrst, 'reload schema';
