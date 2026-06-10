-- 026_sync_launch_pricing.sql
-- =====================================================================
-- Sincroniza los precios de LANZAMIENTO (penetración para pilotos):
--   Starter 29.000 / Growth 59.000 / Pro 99.000 (ARS)
--
-- Red de seguridad idempotente: corrige la tabla `plans` aunque alguien
-- haya corrido un seed con otros precios (p. ej. 49/89/149).
-- NO toca subscriptions, payments, conversaciones ni datos de negocios.
-- Límites por plan (productos 20/150/1000, usuarios 3/10/25) se preservan
-- vía COALESCE: solo se completan si estuvieran en NULL.
--
-- Los precios "normales" futuros (49/89/149) se aplicarán con una
-- migración nueva + actualización de src/lib/plan-display.ts en el mismo
-- deploy. Fuente única en código: src/lib/plan-display.ts.
-- =====================================================================

insert into public.plans (code, name, price_monthly, currency, product_limit, users_limit, whatsapp_numbers_limit, features)
values
  ('starter', 'Starter', 29000, 'ARS', 20,   3,  1,
   '{"shared_inbox": true, "ai_assistant": true, "human_handoff": true, "template_tiers": ["basic"]}'::jsonb),
  ('growth',  'Growth',  59000, 'ARS', 150,  10, 1,
   '{"shared_inbox": true, "ai_assistant": true, "human_handoff": true, "usage_visibility": true, "knowledge_base": true, "appointments": true, "template_tiers": ["basic", "commercial"]}'::jsonb),
  ('pro',     'Pro',     99000, 'ARS', 1000, 25, 3,
   '{"shared_inbox": true, "ai_assistant": true, "human_handoff": true, "usage_visibility": true, "knowledge_base": true, "appointments": true, "priority_support": true, "template_tiers": ["basic", "commercial", "premium"]}'::jsonb)
on conflict (code) do update set
  name           = excluded.name,
  price_monthly  = excluded.price_monthly,
  currency       = excluded.currency,
  -- Límites y features existentes se preservan; solo se completan si faltan.
  product_limit  = coalesce(public.plans.product_limit, excluded.product_limit),
  users_limit    = coalesce(public.plans.users_limit, excluded.users_limit),
  whatsapp_numbers_limit = coalesce(public.plans.whatsapp_numbers_limit, excluded.whatsapp_numbers_limit),
  features       = coalesce(public.plans.features, excluded.features);

-- Verificación (no devuelve filas si todo está bien):
-- select code, price_monthly from public.plans
-- where (code = 'starter' and price_monthly <> 29000)
--    or (code = 'growth'  and price_monthly <> 59000)
--    or (code = 'pro'     and price_monthly <> 99000);
