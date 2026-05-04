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

alter table conversations
add column if not exists contact_id uuid references contacts(id) on delete set null;

alter table outbox_messages
add column if not exists contact_id uuid references contacts(id) on delete set null;

alter table conversations
drop constraint if exists conversations_business_id_phone_jid_key;

create index if not exists idx_conversations_business_contact
  on conversations (business_id, contact_id);

create unique index if not exists uq_conversations_business_contact
  on conversations (business_id, contact_id)
  where contact_id is not null;

create index if not exists idx_contacts_business_phone
  on contacts (business_id, phone_number);

create index if not exists idx_contact_identities_business_contact
  on contact_identities (business_id, contact_id);
