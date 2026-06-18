-- 034_booking_engine_foundation.sql
--
-- FUNDACIÓN de la agenda profesional. 100% ADITIVO: no modifica ni borra nada
-- existente, así que no rompe el flujo actual de reservas (solicitud → confirma
-- humano). Las columnas/tablas nuevas quedan disponibles para wirear la
-- validación de disponibilidad por fases.
--
-- No toca: appointments.status/source, business_settings.booking_config, worker,
-- IA, MercadoPago, auth, multi-tenant. Todo sigue igual hasta que se integre.

-- 1) Settings de agenda (zona horaria, frecuencia de turnos, antelación, horizonte)
alter table business_settings
  add column if not exists timezone text not null default 'America/Argentina/Buenos_Aires',
  add column if not exists slot_interval_minutes integer not null default 30,
  add column if not exists default_duration_minutes integer not null default 30,
  add column if not exists booking_lead_minutes integer not null default 0,
  add column if not exists booking_horizon_days integer not null default 30;

-- 2) Horario semanal estructurado — múltiples turnos por día.
--    Sin filas para un weekday = ese día está CERRADO.
create table if not exists business_hours (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6), -- 0=Domingo .. 6=Sábado
  open_time time not null,
  close_time time not null,
  created_at timestamptz not null default now(),
  check (close_time > open_time)
);
create index if not exists idx_business_hours_business
  on business_hours (business_id, weekday);

-- 3) Excepciones: feriados, vacaciones, bloqueos manuales y horarios especiales.
--    kind='closed'  -> todo el día cerrado (feriado/vacaciones)
--    kind='block'   -> rango puntual ocupado (start_time..end_time)
--    kind='special' -> reemplaza el horario de ese día (start_time..end_time)
create table if not exists schedule_exceptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  exception_date date not null,
  kind text not null check (kind in ('closed','block','special')),
  start_time time,
  end_time time,
  reason text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_schedule_exceptions_business
  on schedule_exceptions (business_id, exception_date);

-- 4) Duración y fin del turno (para detectar solapamientos reales).
alter table appointments
  add column if not exists duration_minutes integer,
  add column if not exists ends_at timestamptz;

-- RLS coherente con el resto del esquema (sin policies: acceso sólo por service role).
alter table business_hours enable row level security;
alter table schedule_exceptions enable row level security;
