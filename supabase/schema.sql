-- ============================================================
-- Agente WhatsApp — Schema Supabase
-- Ejecutar completo en: Supabase Dashboard → SQL Editor → Run
-- Es idempotente: se puede ejecutar varias veces sin errores.
-- ============================================================

create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'conversation_mode') then
    create type conversation_mode as enum ('AI', 'HUMAN');
  end if;

  if not exists (select 1 from pg_type where typname = 'message_role') then
    create type message_role as enum ('user', 'assistant', 'human');
  end if;

  if not exists (select 1 from pg_type where typname = 'whatsapp_connection_status') then
    create type whatsapp_connection_status as enum ('disconnected', 'qr', 'connecting', 'connected');
  end if;

  if not exists (select 1 from pg_type where typname = 'subscription_status') then
    create type subscription_status as enum ('trial', 'active', 'past_due', 'canceled');
  end if;
end $$;

create table if not exists businesses (
  id uuid primary key,
  slug text not null unique,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists business_settings (
  business_id uuid primary key references businesses(id) on delete cascade,
  description text not null default '',
  extra text not null default '',
  system_prompt_override text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  price_text text not null default '',
  description text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  display_name text,
  phone_number text,
  primary_jid text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists contact_identities (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  identity_type text not null check (identity_type in ('phone','pn_jid','lid_jid','raw_jid')),
  identity_value text not null,
  created_at timestamptz not null default now(),
  unique (business_id, identity_value)
);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  phone_jid text not null,
  display_name text,
  mode conversation_mode not null default 'AI',
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  role message_role not null,
  content text not null,
  external_message_id text,
  created_at timestamptz not null default now()
);

create table if not exists subscriptions (
  business_id uuid primary key references businesses(id) on delete cascade,
  plan_code text not null default 'starter',
  status subscription_status not null default 'active',
  monthly_message_limit integer,
  monthly_ai_reply_limit integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists usage_monthly (
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

create table if not exists whatsapp_sessions (
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

create table if not exists outbox_messages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  phone_jid text not null,
  content text not null,
  sent boolean not null default false,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_conversations_business_last_message
  on conversations (business_id, last_message_at desc nulls last);

create index if not exists idx_conversations_business_phone
  on conversations (business_id, phone_jid);

create index if not exists idx_conversations_business_contact
  on conversations (business_id, contact_id);

create unique index if not exists uq_conversations_business_contact
  on conversations (business_id, contact_id)
  where contact_id is not null;

create index if not exists idx_messages_conversation_created
  on messages (conversation_id, created_at);

create index if not exists idx_products_business
  on products (business_id, sort_order, created_at);

create index if not exists idx_contacts_business_phone
  on contacts (business_id, phone_number);

create index if not exists idx_contact_identities_business_contact
  on contact_identities (business_id, contact_id);

create index if not exists idx_outbox_pending
  on outbox_messages (business_id, sent, created_at);

create index if not exists idx_whatsapp_sessions_instance
  on whatsapp_sessions (business_id, instance_name);

-- ---- worker_commands ----
-- Historial de órdenes enviadas al worker. El flujo principal usa
-- desired_action en whatsapp_sessions; esta tabla es para auditoría
-- y extensión futura (múltiples comandos en cola, reintentos, etc.).
create table if not exists worker_commands (
  id            uuid        primary key default gen_random_uuid(),
  business_id   uuid        not null references businesses(id) on delete cascade,
  instance_name text        not null,
  command       text        not null, -- 'disconnect' | 'restart' | 'qr_refresh'
  payload       jsonb,
  executed      boolean     not null default false,
  executed_at   timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists idx_worker_commands_pending
  on worker_commands (business_id, instance_name, executed, created_at)
  where executed = false;
