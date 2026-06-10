-- 027_pairing_code_connection.sql
-- =====================================================================
-- Conexión de WhatsApp por CÓDIGO DE VINCULACIÓN (además del QR).
--
-- Flujo: el usuario ingresa su número en el dashboard → se guarda en
-- pairing_phone → el worker (Baileys requestPairingCode) genera el código
-- de 8 caracteres → se guarda en pairing_code → la UI lo muestra → el
-- usuario lo escribe en WhatsApp (Dispositivos vinculados → "Vincular con
-- número de teléfono"). Al conectar, ambos campos se limpian.
--
-- Aditivo y seguro: no toca filas existentes ni el flujo QR.
-- =====================================================================

alter table public.whatsapp_sessions
  add column if not exists pairing_phone text,
  add column if not exists pairing_code text,
  add column if not exists pairing_requested_at timestamptz;
