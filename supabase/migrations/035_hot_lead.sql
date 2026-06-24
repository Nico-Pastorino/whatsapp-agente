-- Migration 035: Add hot_lead flag to conversations
-- Cuando la IA detecta intención clara de compra/reserva (evento "hot_lead"),
-- marcamos la conversación para que el dueño la vea en el centro de
-- notificaciones (🔥 cliente interesado). Antes esto solo se enviaba como aviso
-- a WhatsApp y no quedaba registrado en la app.
-- Se limpia cuando alguien toma el chat (modo HUMAN), responde desde el panel,
-- o se genera una reserva en esa conversación.

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS hot_lead BOOLEAN NOT NULL DEFAULT FALSE;

-- Índice para encontrar rápido los leads calientes (badge / filtro).
CREATE INDEX IF NOT EXISTS idx_conversations_hot_lead
  ON conversations (business_id, hot_lead)
  WHERE hot_lead = TRUE;
