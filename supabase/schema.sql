create extension if not exists "pgcrypto";

drop table if exists worker_commands cascade;
drop table if exists internal_notifications cascade;
drop table if exists appointments cascade;
drop table if exists outbox_messages cascade;
drop table if exists payments cascade;
drop table if exists messages cascade;
drop table if exists conversations cascade;
drop table if exists contact_identities cascade;
drop table if exists contacts cascade;
drop table if exists whatsapp_sessions cascade;
drop table if exists usage_monthly cascade;
drop table if exists subscriptions cascade;
drop table if exists plans cascade;
drop table if exists business_members cascade;
drop table if exists profiles cascade;
drop table if exists products cascade;
drop table if exists business_settings cascade;
drop table if exists businesses cascade;

drop type if exists conversation_mode cascade;
drop type if exists message_role cascade;
drop type if exists whatsapp_connection_status cascade;
drop type if exists subscription_status cascade;

create type conversation_mode as enum ('AI', 'HUMAN');
create type message_role as enum ('user', 'assistant', 'human');
create type whatsapp_connection_status as enum ('disconnected', 'qr', 'connecting', 'connected');
create type subscription_status as enum ('trial', 'active', 'past_due', 'canceled', 'pending_payment');

create table businesses (
  id uuid primary key,
  slug text not null unique,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamptz not null default now()
);

create table business_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','agent')),
  created_at timestamptz not null default now(),
  unique (business_id, user_id)
);

create table business_settings (
  business_id uuid primary key references businesses(id) on delete cascade,
  description text not null default '',
  extra text not null default '',
  system_prompt_override text not null default '',
  quick_replies jsonb not null default '[]'::jsonb,
  knowledge_base text not null default '',
  booking_enabled boolean not null default false,
  booking_config text not null default '',
  notify_enabled boolean not null default false,
  notify_phone text not null default '',
  notify_events jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table plans (
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

create table products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  price_text text not null default '',
  description text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table contacts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  display_name text,
  phone_number text,
  primary_jid text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table contact_identities (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  identity_type text not null check (identity_type in ('phone','pn_jid','lid_jid','raw_jid')),
  identity_value text not null,
  created_at timestamptz not null default now(),
  unique (business_id, identity_value)
);

create table conversations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  phone_jid text,
  display_name text,
  mode conversation_mode not null default 'AI',
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, contact_id)
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  role message_role not null,
  content text not null,
  external_message_id text,
  created_at timestamptz not null default now()
);

create table subscriptions (
  business_id uuid primary key references businesses(id) on delete cascade,
  plan_code text not null default 'growth' references plans(code),
  status subscription_status not null default 'trial',
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  paid_at timestamptz,
  subscription_started_at timestamptz,
  subscription_ends_at timestamptz,
  mercado_pago_preapproval_id text,
  mercado_pago_preapproval_status text,
  mercado_pago_payment_id text,
  mercado_pago_preference_id text,
  cancel_at_period_end boolean not null default false,
  cancelled_at timestamptz,
  monthly_message_limit integer,
  monthly_ai_reply_limit integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table business_invitations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'agent')),
  token text not null unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired', 'revoked')),
  invited_by uuid references auth.users(id) on delete set null,
  accepted_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table usage_monthly (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  month_start date not null,
  inbound_messages_count integer not null default 0,
  ai_replies_count integer not null default 0,
  human_messages_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, month_start)
);

create table whatsapp_sessions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  instance_name text not null,
  status whatsapp_connection_status not null default 'disconnected',
  qr_string text,
  phone text,
  auth_path text,
  desired_action text not null default 'none',
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, instance_name)
);

create table outbox_messages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  target_jid text not null,
  content text not null,
  sent boolean not null default false,
  sent_at timestamptz,
  error text,
  external_message_id text,
  created_at timestamptz not null default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  email text,
  plan_code text not null references plans(code),
  mp_payment_id text,
  mp_preference_id text,
  mp_preapproval_id text,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','cancelled')),
  amount integer not null,
  currency text not null default 'ARS',
  checkout_type text not null default 'initial'
    check (checkout_type in ('initial','upgrade','renewal')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table worker_commands (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  instance_name text not null,
  command text not null,
  payload jsonb,
  executed boolean not null default false,
  executed_at timestamptz,
  created_at timestamptz not null default now()
);

create table appointments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  conversation_id uuid references conversations(id) on delete set null,
  contact_id uuid references contacts(id) on delete set null,
  customer_name text,
  customer_phone text,
  service text,
  starts_at timestamptz,
  notes text,
  status text not null default 'pending' check (status in ('pending','confirmed','cancelled','done')),
  source text not null default 'ai' check (source in ('ai','human')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table internal_notifications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  event_type text not null,
  content text not null,
  target_jid text not null,
  dedup_key text,
  status text not null default 'pending' check (status in ('pending','sent','failed','skipped')),
  error text,
  retry_count integer not null default 0,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index idx_contacts_business_phone
  on contacts (business_id, phone_number);

create index idx_contact_identities_business_contact
  on contact_identities (business_id, contact_id);

create index idx_conversations_business_contact
  on conversations (business_id, contact_id);

create index idx_conversations_business_last_message
  on conversations (business_id, last_message_at desc nulls last);

create index idx_messages_conversation_created
  on messages (conversation_id, created_at);

create index idx_products_business
  on products (business_id, sort_order, created_at);

create index idx_business_members_user
  on business_members (user_id, created_at);

create index idx_outbox_pending
  on outbox_messages (business_id, sent, created_at);

create index idx_payments_business
  on payments (business_id, created_at desc);

create index idx_payments_mp_id
  on payments (mp_payment_id)
  where mp_payment_id is not null;

create index idx_payments_mp_preapproval
  on payments (mp_preapproval_id)
  where mp_preapproval_id is not null;

create index idx_subscriptions_mp_preapproval
  on subscriptions (mercado_pago_preapproval_id)
  where mercado_pago_preapproval_id is not null;

create index idx_whatsapp_sessions_instance
  on whatsapp_sessions (business_id, instance_name);

create index idx_worker_commands_pending
  on worker_commands (business_id, instance_name, executed, created_at)
  where executed = false;

create index idx_appointments_business_starts
  on appointments (business_id, starts_at);

create unique index uq_internal_notifications_dedup
  on internal_notifications (business_id, dedup_key)
  where dedup_key is not null;

create index idx_internal_notifications_pending
  on internal_notifications (business_id, status, created_at)
  where status = 'pending';

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
    29000,
    'ARS',
    null,
    null,
    20,
    3,
    1,
    '{"shared_inbox": true, "ai_assistant": true, "human_handoff": true, "template_tiers": ["basic"]}'::jsonb
  ),
  (
    'growth',
    'Growth',
    59000,
    'ARS',
    null,
    null,
    150,
    10,
    1,
    '{"shared_inbox": true, "ai_assistant": true, "human_handoff": true, "usage_visibility": true, "knowledge_base": true, "appointments": true, "template_tiers": ["basic", "commercial"]}'::jsonb
  ),
  (
    'pro',
    'Pro',
    99000,
    'ARS',
    null,
    null,
    1000,
    25,
    3,
    '{"shared_inbox": true, "ai_assistant": true, "human_handoff": true, "usage_visibility": true, "knowledge_base": true, "appointments": true, "priority_support": true, "template_tiers": ["basic", "commercial", "premium"]}'::jsonb
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
