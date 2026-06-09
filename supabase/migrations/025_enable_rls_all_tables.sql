-- 025_enable_rls_all_tables.sql
-- =====================================================================
-- CRÍTICO DE SEGURIDAD — Habilitar Row Level Security (RLS) en todas las
-- tablas del esquema public.
--
-- Por qué: hoy las tablas NO tienen RLS. En Supabase, los roles `anon` y
-- `authenticated` tienen permisos sobre el esquema public, así que sin RLS
-- cualquiera que tenga la anon key (que es pública por diseño) podría leer o
-- escribir TODA la base vía la API REST de Supabase, salteándose por completo
-- la capa de autorización de la app. Eso expondría conversaciones, mensajes,
-- clientes, suscripciones y datos de todos los negocios.
--
-- Qué hace esta migración: activa RLS en cada tabla public SIN crear policies.
-- Resultado: `anon` y `authenticated` quedan sin acceso a las tablas.
--
-- Por qué es SEGURO para esta app: todo el acceso a datos se hace con el
-- service role (getSupabaseAdminClient) desde el backend, y el service role
-- hace BYPASS de RLS. La anon key solo se usa para login (auth.signInWithPassword),
-- que NO toca tablas public. Por lo tanto, la app sigue funcionando igual.
--
-- Reversible: `alter table public.<tabla> disable row level security;`
-- =====================================================================

do $$
declare
  r record;
begin
  for r in
    select tablename
    from pg_tables
    where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security;', r.tablename);
  end loop;
end $$;

-- Verificación: esta consulta NO debe devolver filas (todas con RLS activo).
-- select tablename
-- from pg_tables
-- where schemaname = 'public'
--   and rowsecurity = false;
