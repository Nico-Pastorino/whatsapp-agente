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

alter table conversations add column if not exists contact_id uuid references contacts(id) on delete cascade;
alter table conversations alter column contact_id set not null;
alter table conversations drop constraint if exists conversations_business_id_phone_jid_key;
create unique index if not exists uq_conversations_business_contact
  on conversations (business_id, contact_id);

alter table outbox_messages add column if not exists contact_id uuid references contacts(id) on delete cascade;
alter table outbox_messages alter column contact_id set not null;
alter table outbox_messages add column if not exists target_jid text;
update outbox_messages set target_jid = coalesce(target_jid, phone_jid);
alter table outbox_messages alter column target_jid set not null;
alter table outbox_messages add column if not exists error text;

create index if not exists idx_contacts_business_phone
  on contacts (business_id, phone_number);

create index if not exists idx_contact_identities_business_contact
  on contact_identities (business_id, contact_id);

create index if not exists idx_conversations_business_contact
  on conversations (business_id, contact_id);

create index if not exists idx_outbox_pending
  on outbox_messages (business_id, sent, created_at);
