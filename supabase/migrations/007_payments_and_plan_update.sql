-- Migration 007: Tabla payments, enum pending_payment, precios actualizados
--
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run

-- 1. Agregar pending_payment al enum de status
alter type subscription_status add value if not exists 'pending_payment';

-- 2. Hacer nullable current_period_start/end (para subscriptions en pending_payment)
alter table subscriptions alter column current_period_start drop not null;
alter table subscriptions alter column current_period_end drop not null;
alter table subscriptions alter column current_period_start drop default;
alter table subscriptions alter column current_period_end drop default;

-- 3. Actualizar precios y límites de planes según spec comercial
update plans set
  price_monthly       = 49000,
  conversation_limit  = 500,
  ai_reply_limit      = 500,
  product_limit       = 20,
  users_limit         = 1
where code = 'starter';

update plans set
  price_monthly       = 99000,
  conversation_limit  = 2000,
  ai_reply_limit      = 2000,
  product_limit       = 100,
  users_limit         = 3
where code = 'pro';

update plans set
  price_monthly       = 199000,
  conversation_limit  = 5000,
  ai_reply_limit      = 5000,
  product_limit       = 500,
  users_limit         = 10
where code = 'premium';

-- 4. Crear tabla payments para auditoría de cobros
create table if not exists payments (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references businesses(id) on delete cascade,
  plan_code        text not null references plans(code),
  mp_payment_id    text,
  mp_preference_id text,
  status           text not null default 'pending'
                   check (status in ('pending','approved','rejected','cancelled')),
  amount           integer not null,
  currency         text not null default 'ARS',
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_payments_business
  on payments (business_id, created_at desc);

create index if not exists idx_payments_mp_id
  on payments (mp_payment_id)
  where mp_payment_id is not null;

-- Notificar a PostgREST para limpiar el caché de schema
notify pgrst, 'reload schema';
