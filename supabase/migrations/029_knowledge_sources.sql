-- 029_knowledge_sources.sql
-- =====================================================================
-- FUENTES EXTERNAS: el negocio pega un link (página web, Google Sheets,
-- CSV) y el asistente responde con esa información (precios, stock,
-- disponibilidad, carta, etc.).
--
-- Modelo snapshot: el contenido se extrae y se guarda en `content` al
-- crear/refrescar la fuente. La IA lee el snapshot (rápido y barato).
-- El worker refresca fuentes viejas automáticamente.
-- =====================================================================

create table if not exists public.knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  url text not null,
  label text,
  source_type text not null default 'web',        -- web | sheet
  content text,                                    -- texto extraído (truncado)
  status text not null default 'pending',          -- pending | ok | error
  error_message text,
  enabled boolean not null default true,
  last_fetched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_knowledge_sources_business
  on public.knowledge_sources (business_id);

-- Mismo modelo de seguridad que el resto: RLS activo, acceso solo vía
-- service role desde el backend (migración 025).
alter table public.knowledge_sources enable row level security;
