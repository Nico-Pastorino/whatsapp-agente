-- Migration 012: invitaciones comerciales y cancelación programada

CREATE TABLE IF NOT EXISTS business_invitations (
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_business_invitations_pending_unique
  ON business_invitations (business_id, email)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_business_invitations_token
  ON business_invitations (token);

CREATE INDEX IF NOT EXISTS idx_business_invitations_business
  ON business_invitations (business_id, created_at desc);

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean not null default false;

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

NOTIFY pgrst, 'reload schema';
