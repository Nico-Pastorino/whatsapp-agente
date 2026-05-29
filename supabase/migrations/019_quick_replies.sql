-- Migration 019: Quick replies for human mode
-- Stored as a JSONB array of strings in business_settings.
-- Example: '["Ahora te llamo", "Muchas gracias", "Confirmado, te esperamos"]'

ALTER TABLE business_settings
  ADD COLUMN IF NOT EXISTS quick_replies JSONB NOT NULL DEFAULT '[]'::JSONB;
