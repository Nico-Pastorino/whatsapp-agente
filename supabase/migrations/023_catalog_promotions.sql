-- Migration 023: Catálogo — destacados + promociones
--
-- PROBLEMA DETECTADO:
--   La migración 022 (is_featured) puede no haber sido aplicada en producción.
--   Esto causa que CATALOG_SELECT falle silenciosamente en todas las queries
--   porque PostgREST devuelve error cuando se pide una columna inexistente.
--   Resultado: el catálogo aparece vacío y la IA no usa ningún producto.
--
-- SOLUCIÓN:
--   Volver a aplicar is_featured con IF NOT EXISTS (idempotente).
--   Agregar promotion_label y promotion_ends_at para el nuevo sistema de promociones.
--
-- SEGURO: solo ADD COLUMN IF NOT EXISTS. No borra ni modifica datos existentes.
-- EJECUTAR EN: Supabase Dashboard → SQL Editor → Run

-- ── is_featured (de migración 022, idempotente) ──────────────────────────────
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE;

-- ── Campos de promoción ───────────────────────────────────────────────────────
-- promotion_label   : ej. "Hot Sale", "12 cuotas sin interés"
-- promotion_ends_at : cuándo vence la promoción (NULL = sin vencimiento)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS promotion_label    TEXT,
  ADD COLUMN IF NOT EXISTS promotion_ends_at  TIMESTAMPTZ;

-- ── Índices ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_products_featured
  ON products (business_id, is_featured)
  WHERE is_featured = TRUE AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_products_promotions
  ON products (business_id, promotion_ends_at)
  WHERE promotion_label IS NOT NULL AND deleted_at IS NULL;

NOTIFY pgrst, 'reload schema';
