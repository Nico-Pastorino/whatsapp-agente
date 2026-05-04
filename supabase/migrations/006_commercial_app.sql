create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamptz not null default now()
);

create table if not exists business_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','agent')),
  created_at timestamptz not null default now(),
  unique (business_id, user_id)
);

create table if not exists plans (
  code text primary key,
  name text not null,
  price_monthly integer,
  currency text not null default 'ARS',
  conversation_limit integer,
  ai_reply_limit integer,
  product_limit integer,
  users_limit integer,
  whatsapp_numbers_limit integer,
  features jsonb not null default '{}'::jsonb
);

alter table subscriptions
  add column if not exists current_period_start timestamptz not null default now(),
  add column if not exists current_period_end timestamptz not null default (now() + interval '30 days');

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_name = 'subscriptions'
      and constraint_type = 'FOREIGN KEY'
      and constraint_name = 'subscriptions_plan_code_fkey'
  ) then
    alter table subscriptions
      add constraint subscriptions_plan_code_fkey
      foreign key (plan_code) references plans(code);
  end if;
end $$;

create index if not exists idx_business_members_user
  on business_members (user_id, created_at);

insert into plans (
  code,
  name,
  price_monthly,
  currency,
  conversation_limit,
  ai_reply_limit,
  product_limit,
  users_limit,
  whatsapp_numbers_limit,
  features
) values
  (
    'starter',
    'Starter',
    0,
    'ARS',
    300,
    150,
    30,
    1,
    1,
    '{"shared_inbox": true, "ai_assistant": true, "human_handoff": true}'::jsonb
  ),
  (
    'pro',
    'Pro',
    49900,
    'ARS',
    1500,
    800,
    200,
    5,
    1,
    '{"shared_inbox": true, "ai_assistant": true, "human_handoff": true, "usage_visibility": true}'::jsonb
  ),
  (
    'premium',
    'Premium',
    99900,
    'ARS',
    5000,
    3000,
    1000,
    20,
    3,
    '{"shared_inbox": true, "ai_assistant": true, "human_handoff": true, "usage_visibility": true, "priority_support": true}'::jsonb
  )
on conflict (code) do update
set
  name = excluded.name,
  price_monthly = excluded.price_monthly,
  currency = excluded.currency,
  conversation_limit = excluded.conversation_limit,
  ai_reply_limit = excluded.ai_reply_limit,
  product_limit = excluded.product_limit,
  users_limit = excluded.users_limit,
  whatsapp_numbers_limit = excluded.whatsapp_numbers_limit,
  features = excluded.features;
