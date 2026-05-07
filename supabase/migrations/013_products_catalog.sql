-- Migration 013: Catálogo estructurado de productos y servicios
--
-- Agrega columnas a la tabla products existente para soportar:
--   - Tipos: producto / servicio
--   - Categoría, precio promo, estado de stock
--   - Campos específicos de servicios (duración, turno)
--   - Métodos de pago, financiación
--   - Notas internas (NO se muestran al cliente ni a la IA)
--   - Activar/desactivar sin borrar
--   - Soft delete (deleted_at)
--
-- SEGURO: solo ADD COLUMN IF NOT EXISTS, sin DROP ni cambios destructivos.
-- Los registros existentes quedan con defaults: item_type='product', is_active=true, deleted_at=null
--
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS item_type        text NOT NULL DEFAULT 'product'
    CHECK (item_type IN ('product', 'service')),
  ADD COLUMN IF NOT EXISTS category         text,
  ADD COLUMN IF NOT EXISTS promo_price      text,
  ADD COLUMN IF NOT EXISTS stock_status     text DEFAULT 'available'
    CHECK (stock_status IN ('available', 'unavailable', 'on_demand')),
  ADD COLUMN IF NOT EXISTS duration         text,
  ADD COLUMN IF NOT EXISTS requires_booking boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_options  text,
  ADD COLUMN IF NOT EXISTS financing_options text,
  ADD COLUMN IF NOT EXISTS internal_notes   text,
  ADD COLUMN IF NOT EXISTS is_active        boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS deleted_at       timestamptz;

-- Índice para queries de catálogo activo (el más frecuente)
CREATE INDEX IF NOT EXISTS idx_products_active_catalog
  ON products (business_id, is_active, sort_order, created_at)
  WHERE deleted_at IS NULL;

-- Índice para soft-delete filter
CREATE INDEX IF NOT EXISTS idx_products_deleted
  ON products (business_id, deleted_at)
  WHERE deleted_at IS NOT NULL;

NOTIFY pgrst, 'reload schema';
