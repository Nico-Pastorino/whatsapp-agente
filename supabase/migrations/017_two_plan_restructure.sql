-- Migration 017: Two-plan restructure (Starter + Pro)
-- Starter: $39,000 ARS/mo · 15 products · 3 users · basic templates
-- Pro:     $89,000 ARS/mo · 500 products · 15 users · all templates
-- Growth plan is kept as a legacy row (existing subscribers unaffected), hidden from new UI.

-- Update Starter plan
UPDATE plans SET
  name             = 'Starter',
  price_monthly    = 39000,
  currency         = 'ARS',
  conversation_limit     = NULL,          -- unlimited conversations
  product_limit          = 15,
  users_limit            = 3,
  whatsapp_numbers_limit = 1,
  features = jsonb_build_object(
    'template_tiers', jsonb_build_array('basic')
  ),
  updated_at = now()
WHERE code = 'starter';

-- Upsert Pro plan (create if missing, update if present)
INSERT INTO plans (code, name, price_monthly, currency, conversation_limit, product_limit, users_limit, whatsapp_numbers_limit, features, created_at, updated_at)
VALUES (
  'pro',
  'Pro',
  89000,
  'ARS',
  NULL,   -- unlimited conversations
  500,
  15,
  1,
  jsonb_build_object(
    'template_tiers', jsonb_build_array('basic', 'commercial', 'premium')
  ),
  now(),
  now()
)
ON CONFLICT (code) DO UPDATE SET
  name                   = EXCLUDED.name,
  price_monthly          = EXCLUDED.price_monthly,
  currency               = EXCLUDED.currency,
  conversation_limit     = EXCLUDED.conversation_limit,
  product_limit          = EXCLUDED.product_limit,
  users_limit            = EXCLUDED.users_limit,
  whatsapp_numbers_limit = EXCLUDED.whatsapp_numbers_limit,
  features               = EXCLUDED.features,
  updated_at             = now();

-- Growth plan: keep existing subscribers intact, just mark it as legacy
-- We do NOT delete it because active subscriptions reference it.
UPDATE plans SET
  name     = 'Growth (legacy)',
  updated_at = now()
WHERE code = 'growth';
