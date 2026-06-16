-- 031_session_ownership_lock.sql
--
-- Anti-ban: lock de sesión única por número.
--
-- Si dos instancias del worker abren sesión Baileys para el mismo número a la vez
-- (deploy con solapamiento, escalado accidental a 2 réplicas), WhatsApp detecta
-- sesiones simultáneas → conflicto 440 en loop → riesgo alto de baneo del número.
--
-- Estas columnas permiten que UN solo proceso "adopte" cada sesión: el worker
-- renueva su propiedad cada heartbeat; si otra instancia ya es dueña y su lock
-- está vigente, el segundo worker NO abre el socket.
--
-- El código (src/lib/baileys/client.ts) usa esto SOLO si WA_SESSION_LOCK=true,
-- y es fail-open: ante cualquier error de DB sigue funcionando como antes.

alter table whatsapp_sessions
  add column if not exists owned_by text,
  add column if not exists owner_expires_at timestamptz;

-- Índice para evaluar rápido qué locks vencieron.
create index if not exists idx_whatsapp_sessions_owner
  on whatsapp_sessions (business_id, instance_name, owner_expires_at);
