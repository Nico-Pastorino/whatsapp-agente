-- 032_conversation_summary.sql
--
-- Memoria de conversación: guarda un resumen corto por conversación (qué quiere
-- el cliente, datos que ya dio, objeciones). Lo genera el análisis que el bot YA
-- hace por mensaje (analyzeConversationAction), así que no agrega costo de LLM.
--
-- Sirve para: retomar el hilo en conversaciones largas sin reenviar todo el
-- historial al modelo (ahorra tokens), y para que el equipo vea de un vistazo en
-- qué quedó cada conversación.
--
-- El código (updateConversationSummary) lo escribe best-effort: si esta migración
-- no está aplicada, el bot sigue funcionando igual (el error se ignora).

alter table conversations
  add column if not exists ai_summary text,
  add column if not exists ai_summary_updated_at timestamptz;
