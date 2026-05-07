-- Migration 011: soporte seguro para gestión de equipo
--
-- Cambios no destructivos:
--   - garantiza compatibilidad de profiles.full_name
--   - agrega índice por negocio para listar y contar miembros con menos costo

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS full_name text;

CREATE INDEX IF NOT EXISTS idx_business_members_business
  ON business_members (business_id, created_at);

NOTIFY pgrst, 'reload schema';
