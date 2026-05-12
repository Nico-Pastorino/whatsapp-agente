-- Migration 014: trial de 14 días + suscripción recurrente Mercado Pago
--
-- Seguro para producción: solo agrega columnas/índices y valores de enum.
-- No migra automáticamente cuentas existentes para evitar bloquear clientes reales.

ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'pending_payment';

ALTER TABLE subscriptions
  ALTER COLUMN current_period_start DROP NOT NULL,
  ALTER COLUMN current_period_end DROP NOT NULL;

ALTER TABLE subscriptions
  ALTER COLUMN plan_code SET DEFAULT 'growth',
  ALTER COLUMN status SET DEFAULT 'trial';

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS trial_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS mercado_pago_preapproval_id text,
  ADD COLUMN IF NOT EXISTS mercado_pago_preapproval_status text,
  ADD COLUMN IF NOT EXISTS mercado_pago_payment_id text,
  ADD COLUMN IF NOT EXISTS mercado_pago_preference_id text;

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS user_id uuid references auth.users(id) on delete set null,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS mp_preapproval_id text;

CREATE INDEX IF NOT EXISTS idx_subscriptions_mp_preapproval
  ON subscriptions (mercado_pago_preapproval_id)
  WHERE mercado_pago_preapproval_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_mp_preapproval
  ON payments (mp_preapproval_id)
  WHERE mp_preapproval_id IS NOT NULL;

-- Auditoría manual recomendada antes/después de deploy:
-- SELECT
--   s.business_id,
--   b.display_name,
--   s.plan_code,
--   s.status,
--   s.created_at,
--   s.current_period_start,
--   s.current_period_end,
--   COUNT(p.id) FILTER (WHERE p.status = 'approved') AS approved_payments
-- FROM subscriptions s
-- JOIN businesses b ON b.id = s.business_id
-- LEFT JOIN payments p ON p.business_id = s.business_id
-- WHERE s.plan_code = 'starter' AND s.status = 'active'
-- GROUP BY s.business_id, b.display_name, s.plan_code, s.status, s.created_at, s.current_period_start, s.current_period_end
-- HAVING COUNT(p.id) FILTER (WHERE p.status = 'approved') = 0
-- ORDER BY s.created_at DESC;

NOTIFY pgrst, 'reload schema';
