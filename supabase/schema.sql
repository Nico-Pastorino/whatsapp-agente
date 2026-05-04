create extension if not exists "pgcrypto";

drop table if exists worker_commands cascade;
drop table if exists outbox_messages cascade;
drop table if exists messages cascade;
drop table if exists conversations cascade;
drop table if exists contact_identities cascade;
drop table if exists contacts cascade;
drop table if exists whatsapp_sessions cascade;
drop table if exists usage_monthly cascade;
drop table if exists subscriptions cascade;
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
create type subscription_status as enum ('trial', 'active', 'past_due', 'canceled');

create table businesses (
  id uuid primary key,
  slug text not null unique,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table business_settings (
  business_id uuid primary key references businesses(id) on delete cascade,
  description text not null default '',
  extra text not null default '',
  system_prompt_override text not null default '',
  updated_at timestamptz not null default now()
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
  plan_code text not null default 'starter',
  status subscription_status not null default 'active',
  monthly_message_limit integer,
  monthly_ai_reply_limit integer,
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
  created_at timestamptz not null default now()
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

create index idx_outbox_pending
  on outbox_messages (business_id, sent, created_at);

create index idx_whatsapp_sessions_instance
  on whatsapp_sessions (business_id, instance_name);

create index idx_worker_commands_pending
  on worker_commands (business_id, instance_name, executed, created_at)
  where executed = false;
