-- 030_product_limit_enforcement.sql
--
-- Refuerza el límite de productos por plan a nivel base de datos.
--
-- Antes el límite se validaba solo en la app (getCatalogCapacity + createBusinessItem):
-- dos requests concurrentes (o el loop de importación de Excel) podían leer el mismo
-- count y ambos insertar, superando el tope del plan (race condition TOCTOU).
--
-- Este trigger es el backstop definitivo: serializa las inserciones por negocio con
-- un advisory lock transaccional y rechaza la inserción si se alcanzó el límite.
-- La validación de la app se mantiene para dar un mensaje de error amigable; esta
-- garantía es la que no se puede bypassear llamando la API directa.

create or replace function enforce_product_limit()
returns trigger
language plpgsql
as $$
declare
  v_limit integer;
  v_count integer;
begin
  -- Serializa las inserciones concurrentes del mismo negocio dentro de la transacción.
  perform pg_advisory_xact_lock(hashtext(NEW.business_id::text));

  select p.product_limit
    into v_limit
  from subscriptions s
  join plans p on p.code = s.plan_code
  where s.business_id = NEW.business_id;

  -- Sin límite configurado (NULL) => ilimitado.
  if v_limit is null then
    return NEW;
  end if;

  select count(*)
    into v_count
  from products
  where business_id = NEW.business_id
    and deleted_at is null;

  if v_count >= v_limit then
    raise exception 'CATALOG_LIMIT_EXCEEDED: límite de % productos alcanzado para el negocio %', v_limit, NEW.business_id
      using errcode = 'check_violation';
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_enforce_product_limit on products;

create trigger trg_enforce_product_limit
  before insert on products
  for each row
  execute function enforce_product_limit();
