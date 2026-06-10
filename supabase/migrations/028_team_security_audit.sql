-- 028_team_security_audit.sql
-- Team permissions, invitation lifecycle metadata, and basic traceability.

alter table business_members
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists last_active_at timestamptz;

alter table business_invitations
  add column if not exists revoked_at timestamptz,
  add column if not exists resent_at timestamptz;

alter table messages
  add column if not exists sent_by_user_id uuid references auth.users(id) on delete set null;

alter table outbox_messages
  add column if not exists created_by_user_id uuid references auth.users(id) on delete set null;

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_business_created
  on audit_logs (business_id, created_at desc);

create index if not exists idx_messages_sent_by_user
  on messages (business_id, sent_by_user_id, created_at desc)
  where sent_by_user_id is not null;

create index if not exists idx_outbox_created_by_user
  on outbox_messages (business_id, created_by_user_id, created_at desc)
  where created_by_user_id is not null;

alter table if exists audit_logs enable row level security;
