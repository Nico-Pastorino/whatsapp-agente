-- ============================================================
-- Migration 001: Alinear columnas del schema con el código
-- ============================================================
-- Problema: el schema inicial puede haberse creado sin todas las
-- columnas que usa el código. Este migration las agrega de forma
-- segura con IF NOT EXISTS (idempotente, se puede ejecutar N veces).
--
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run
-- Después ejecutar también la última línea de NOTIFY para limpiar
-- el cache de schema de PostgREST.
-- ============================================================

-- ---- businesses ----
alter table businesses add column if not exists slug          text;
alter table businesses add column if not exists display_name  text not null default '';
alter table businesses add column if not exists updated_at    timestamptz not null default now();

-- slug debe ser unique — agregar constraint si no existe
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'businesses_slug_key'
    and conrelid = 'businesses'::regclass
  ) then
    alter table businesses add constraint businesses_slug_key unique (slug);
  end if;
end $$;

-- ---- business_settings ----
alter table business_settings add column if not exists description            text not null default '';
alter table business_settings add column if not exists extra                  text not null default '';
alter table business_settings add column if not exists system_prompt_override text not null default '';
alter table business_settings add column if not exists updated_at             timestamptz not null default now();

-- ---- products ----
alter table products add column if not exists name        text not null default '';
alter table products add column if not exists price_text  text not null default '';
alter table products add column if not exists description text not null default '';
alter table products add column if not exists sort_order  integer not null default 0;
alter table products add column if not exists created_at  timestamptz not null default now();
alter table products add column if not exists updated_at  timestamptz not null default now();

-- ---- conversations ----
alter table conversations add column if not exists phone_jid       text;
alter table conversations add column if not exists display_name    text;
alter table conversations add column if not exists last_message_at timestamptz;
alter table conversations add column if not exists updated_at      timestamptz not null default now();

-- Enum conversation_mode (por si no existe)
do $$ begin
  if not exists (select 1 from pg_type where typname = 'conversation_mode') then
    create type conversation_mode as enum ('AI', 'HUMAN');
  end if;
end $$;

-- Columna mode con el tipo enum
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'conversations' and column_name = 'mode'
  ) then
    alter table conversations add column mode conversation_mode not null default 'AI';
  end if;
end $$;

-- Unique constraint (business_id, phone_jid)
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'conversations_business_id_phone_jid_key'
    and conrelid = 'conversations'::regclass
  ) then
    alter table conversations add constraint conversations_business_id_phone_jid_key
      unique (business_id, phone_jid);
  end if;
end $$;

-- ---- messages ----
alter table messages add column if not exists business_id          uuid;
alter table messages add column if not exists role                 text;
alter table messages add column if not exists content              text not null default '';
alter table messages add column if not exists external_message_id  text;
alter table messages add column if not exists created_at           timestamptz not null default now();

-- ---- subscriptions ----
alter table subscriptions add column if not exists plan_code              text not null default 'starter';
alter table subscriptions add column if not exists monthly_message_limit  integer;
alter table subscriptions add column if not exists monthly_ai_reply_limit integer;
alter table subscriptions add column if not exists updated_at             timestamptz not null default now();

-- Enum subscription_status
do $$ begin
  if not exists (select 1 from pg_type where typname = 'subscription_status') then
    create type subscription_status as enum ('trial', 'active', 'past_due', 'canceled');
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'subscriptions' and column_name = 'status'
  ) then
    alter table subscriptions add column status subscription_status not null default 'active';
  end if;
end $$;

-- ---- usage_monthly ----
alter table usage_monthly add column if not exists month_start             date;
alter table usage_monthly add column if not exists inbound_messages_count  integer not null default 0;
alter table usage_monthly add column if not exists ai_replies_count        integer not null default 0;
alter table usage_monthly add column if not exists human_messages_count    integer not null default 0;
alter table usage_monthly add column if not exists updated_at              timestamptz not null default now();

-- Unique constraint (business_id, month_start)
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'usage_monthly_business_id_month_start_key'
    and conrelid = 'usage_monthly'::regclass
  ) then
    alter table usage_monthly add constraint usage_monthly_business_id_month_start_key
      unique (business_id, month_start);
  end if;
end $$;

-- ---- whatsapp_sessions ----
alter table whatsapp_sessions add column if not exists instance_name  text;
alter table whatsapp_sessions add column if not exists qr_string      text;
alter table whatsapp_sessions add column if not exists phone          text;
alter table whatsapp_sessions add column if not exists auth_path      text;
alter table whatsapp_sessions add column if not exists desired_action text not null default 'none';
alter table whatsapp_sessions add column if not exists last_seen_at   timestamptz;
alter table whatsapp_sessions add column if not exists updated_at     timestamptz not null default now();

-- Enum whatsapp_connection_status
do $$ begin
  if not exists (select 1 from pg_type where typname = 'whatsapp_connection_status') then
    create type whatsapp_connection_status
      as enum ('disconnected', 'qr', 'connecting', 'connected');
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'whatsapp_sessions' and column_name = 'status'
  ) then
    alter table whatsapp_sessions
      add column status whatsapp_connection_status not null default 'disconnected';
  end if;
end $$;

-- Unique constraint (business_id, instance_name)
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'whatsapp_sessions_business_id_instance_name_key'
    and conrelid = 'whatsapp_sessions'::regclass
  ) then
    alter table whatsapp_sessions add constraint whatsapp_sessions_business_id_instance_name_key
      unique (business_id, instance_name);
  end if;
end $$;

-- ---- outbox_messages ----
alter table outbox_messages add column if not exists phone_jid  text;
alter table outbox_messages add column if not exists content    text not null default '';
alter table outbox_messages add column if not exists sent       boolean not null default false;
alter table outbox_messages add column if not exists sent_at    timestamptz;
alter table outbox_messages add column if not exists created_at timestamptz not null default now();

-- ---- Índices (por si no existen) ----
create index if not exists idx_conversations_business_last_message
  on conversations (business_id, last_message_at desc nulls last);

create index if not exists idx_conversations_business_phone
  on conversations (business_id, phone_jid);

create index if not exists idx_messages_conversation_created
  on messages (conversation_id, created_at);

create index if not exists idx_products_business
  on products (business_id, sort_order, created_at);

create index if not exists idx_outbox_pending
  on outbox_messages (business_id, sent, created_at);

create index if not exists idx_whatsapp_sessions_instance
  on whatsapp_sessions (business_id, instance_name);

-- ============================================================
-- IMPORTANTE: limpiar cache de schema de PostgREST
-- Ejecutar esto DESPUÉS del migration para que Supabase
-- reconozca las nuevas columnas de inmediato.
-- ============================================================
notify pgrst, 'reload schema';
