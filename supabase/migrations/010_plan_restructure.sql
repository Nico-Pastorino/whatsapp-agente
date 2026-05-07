-- Migration 010: Planes Starter / Growth / Pro + checkout_type en payments
--
-- Cambios:
--   - Actualiza plan 'starter' con features JSONB completo
--   - Inserta plan 'growth' (nuevo código)
--   - Actualiza plan 'pro' a nuevos límites y precio ($149.000)
--   - Deja plan 'premium' intacto (legacy, no se ofrece a nuevos usuarios)
--   - Agrega columna checkout_type a payments (safe, nullable→default 'initial')
--
-- SEGURO: solo ADD/INSERT/UPDATE, sin DROP ni cambios destructivos.
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run

-- 1. Actualizar plan Starter con features por rubro y límites
UPDATE plans SET
  name                    = 'Starter',
  price_monthly           = 49000,
  conversation_limit      = 500,
  ai_reply_limit          = 500,
  product_limit           = 10,
  users_limit             = 3,
  whatsapp_numbers_limit  = 1,
  features = '{
    "max_templates": 1,
    "template_tiers": ["basic"],
    "leads": false,
    "analytics": "basic",
    "training": false,
    "premium_templates": false,
    "custom_templates": false
  }'::jsonb
WHERE code = 'starter';

-- 2. Insertar plan Growth (código nuevo)
INSERT INTO plans (
  code, name, price_monthly, currency,
  conversation_limit, ai_reply_limit, product_limit,
  users_limit, whatsapp_numbers_limit, features
) VALUES (
  'growth', 'Growth', 89000, 'ARS',
  2000, 2000, 100,
  10, 1,
  '{
    "max_templates": 999,
    "template_tiers": ["basic", "commercial"],
    "leads": true,
    "analytics": "commercial",
    "training": true,
    "premium_templates": false,
    "custom_templates": false
  }'::jsonb
)
ON CONFLICT (code) DO UPDATE SET
  name                   = excluded.name,
  price_monthly          = excluded.price_monthly,
  currency               = excluded.currency,
  conversation_limit     = excluded.conversation_limit,
  ai_reply_limit         = excluded.ai_reply_limit,
  product_limit          = excluded.product_limit,
  users_limit            = excluded.users_limit,
  whatsapp_numbers_limit = excluded.whatsapp_numbers_limit,
  features               = excluded.features;

-- 3. Actualizar plan Pro (era $99.000, pasa a $149.000 con más capacidad)
UPDATE plans SET
  name                    = 'Pro',
  price_monthly           = 149000,
  conversation_limit      = 5000,
  ai_reply_limit          = 10000,
  product_limit           = 500,
  users_limit             = 25,
  whatsapp_numbers_limit  = 3,
  features = '{
    "max_templates": 999,
    "template_tiers": ["basic", "commercial", "premium"],
    "leads": true,
    "analytics": "advanced",
    "training": true,
    "premium_templates": true,
    "custom_templates": true
  }'::jsonb
WHERE code = 'pro';

-- 4. Plan 'premium' se deja intacto para no romper FK en subscriptions/payments

-- 5. Agregar checkout_type a payments (safe: IF NOT EXISTS + default 'initial')
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS checkout_type text NOT NULL DEFAULT 'initial'
    CHECK (checkout_type IN ('initial', 'upgrade', 'renewal'));

NOTIFY pgrst, 'reload schema';
