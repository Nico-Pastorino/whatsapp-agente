-- Migration 022: Add is_featured flag to products catalog
-- Featured items get priority placement in AI responses.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_products_featured
  ON products (business_id, is_featured)
  WHERE is_featured = TRUE AND deleted_at IS NULL;
