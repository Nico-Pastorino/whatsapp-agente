-- Migration 009: last_inbound_jid en conversations
--
-- Guarda el JID real desde donde llegó el último mensaje del cliente.
-- Es la dirección más confiable para enviar respuestas desde el outbox
-- o desde el dashboard, ya que es un JID verificado por Baileys.
--
-- Diferencia con phone_jid:
--   phone_jid  = el JID "canónico" del contacto (puede ser inferido o inferido mal)
--   last_inbound_jid = el JID exacto del remiteJid del último mensaje entrante
--
-- SEGURO: ADD COLUMN nullable → no rompe filas existentes.
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run

alter table conversations
  add column if not exists last_inbound_jid text;

create index if not exists idx_conversations_last_inbound
  on conversations (business_id, last_inbound_jid)
  where last_inbound_jid is not null;

notify pgrst, 'reload schema';
