-- 033_product_limits_rebalance.sql
--
-- Rebalanceo comercial de límites de productos por plan para empujar el upgrade:
--   Starter  20  -> 10   (taster funcional: ve la magia, no opera en serio)
--   Growth   150 -> 50   (el caballo de batalla de la mayoría)
--   Pro      1000 -> 500 (absorbe ecommerce/Apple/automotor sin quedar corto)
--
-- Los precios NO cambian. Tampoco se tocan users_limit ni whatsapp_numbers_limit.
-- El plan legacy 'premium' (no ofrecido a nuevos usuarios) queda intacto.
--
-- El límite se aplica vía el trigger enforce_product_limit (mig. 030), que lee
-- plans.product_limit, así que con este UPDATE alcanza para que rija en backend.
--
-- Grandfathering: bajar un límite NO borra productos existentes; el trigger solo
-- bloquea NUEVAS inserciones cuando se supera el tope. Un negocio que ya tenga
-- más productos que su nuevo límite conserva los que cargó (no podrá agregar más
-- hasta quedar por debajo o subir de plan).

UPDATE plans SET product_limit = 10  WHERE code = 'starter';
UPDATE plans SET product_limit = 50  WHERE code = 'growth';
UPDATE plans SET product_limit = 500 WHERE code = 'pro';
