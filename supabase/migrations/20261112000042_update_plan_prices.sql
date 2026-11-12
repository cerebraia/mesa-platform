-- ============================================================
-- Mesa Platform · Migración 042 — Actualización de precios y límites de planes
-- ============================================================
-- Actualiza los tres planes comerciales a los nuevos valores:
--   • inicio:    US$0/mes  · 20 productos  (antes US$19 · 50 productos)
--   • negocio:   US$29.99  · 200 productos (antes US$39)
--   • acompanado: US$59.99 · 400 productos (antes US$69)
--
-- Garantías:
--   • Idempotente: ON CONFLICT (plan_code) DO UPDATE.
--   • No toca suscripciones, pagos ni fechas de renovación existentes.
--   • Negocios con más de 20 productos en el plan "inicio" conservan sus
--     productos; solo se bloquean nuevas altas hasta regularizar el plan
--     (aplica la lógica existente de upsert_product con advisory lock).
--   • No se borran ni despublican productos automáticamente.
-- ============================================================

INSERT INTO plans (
  plan_code, name, description,
  price_cents, currency, max_products, max_members,
  allowed_roles, is_active, is_test
)
VALUES
  (
    'inicio',
    'Mesa Inicio',
    'Vitrina digital gratuita con tu marca y tu enlace propio.',
    0, 'USD', 20, 1,
    ARRAY['owner'],
    true, false
  ),
  (
    'negocio',
    'Mesa Negocio',
    'Para equipos que necesitan más espacio y roles especializados.',
    2999, 'USD', 200, 5,
    ARRAY['owner','attention','kitchen'],
    true, false
  ),
  (
    'acompanado',
    'Mesa Acompañado',
    'Más capacidad y ayuda directa de nuestro equipo para tu catálogo.',
    5999, 'USD', 400, 10,
    ARRAY['owner','attention','kitchen'],
    true, false
  )
ON CONFLICT (plan_code) DO UPDATE
  SET name          = EXCLUDED.name,
      description   = EXCLUDED.description,
      price_cents   = EXCLUDED.price_cents,
      max_products  = EXCLUDED.max_products,
      max_members   = EXCLUDED.max_members,
      allowed_roles = EXCLUDED.allowed_roles,
      is_active     = EXCLUDED.is_active;

-- Verificación: confirmar que los valores quedaron aplicados correctamente.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT plan_code, price_cents, max_products
    FROM plans
    WHERE plan_code IN ('inicio','negocio','acompanado')
  LOOP
    RAISE NOTICE 'Plan %: price_cents=%, max_products=%',
      r.plan_code, r.price_cents, r.max_products;
  END LOOP;
END$$;
