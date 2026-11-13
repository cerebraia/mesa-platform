-- ============================================================
-- Mesa Platform · Migración 045 — Corregir get_admin_platform_metrics
-- ============================================================
-- Bug: la query de pedidos usaba o.currency pero la tabla orders
-- no tiene columna currency; la moneda pertenece al restaurante (r.currency).
-- Corrección: cambiar o.currency → r.currency en el subquery de órdenes.
-- ============================================================

CREATE OR REPLACE FUNCTION get_admin_platform_metrics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurants  jsonb;
  v_products     jsonb;
  v_subs         jsonb;
  v_payments     jsonb;
  v_orders       jsonb;
BEGIN
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Acceso denegado: se requiere platform_admin.';
  END IF;

  SELECT jsonb_build_object(
    'active',      COUNT(*) FILTER (WHERE status = 'active'      AND deleted_at IS NULL),
    'onboarding',  COUNT(*) FILTER (WHERE status = 'onboarding'  AND deleted_at IS NULL),
    'suspended',   COUNT(*) FILTER (WHERE status = 'suspended'   AND deleted_at IS NULL),
    'deleted',     COUNT(*) FILTER (WHERE deleted_at IS NOT NULL),
    'total',       COUNT(*)
  )
  INTO v_restaurants
  FROM restaurants;

  SELECT jsonb_build_object(
    'published', COUNT(*) FILTER (
      WHERE p.is_published = TRUE AND p.is_available = TRUE AND p.deleted_at IS NULL),
    'draft',     COUNT(*) FILTER (
      WHERE p.is_published = FALSE AND p.deleted_at IS NULL),
    'paused',    COUNT(*) FILTER (
      WHERE p.is_published = TRUE AND p.is_available = FALSE AND p.deleted_at IS NULL),
    'deleted',   COUNT(*) FILTER (WHERE p.deleted_at IS NOT NULL)
  )
  INTO v_products
  FROM products p
  JOIN restaurants r ON r.id = p.restaurant_id
  WHERE r.deleted_at IS NULL;

  SELECT jsonb_build_object(
    'active',    COUNT(*) FILTER (
      WHERE status = 'active' AND (ends_at IS NULL OR ends_at > NOW())),
    'expired',   COUNT(*) FILTER (
      WHERE status = 'expired'
         OR (status = 'active' AND ends_at IS NOT NULL AND ends_at < NOW())),
    'cancelled', COUNT(*) FILTER (WHERE status = 'cancelled')
  )
  INTO v_subs
  FROM subscriptions;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('currency', currency, 'count', cnt, 'total_cents', total_cents)
      ORDER BY currency
    ), '[]'::jsonb
  )
  INTO v_payments
  FROM (
    SELECT sp.currency, COUNT(*) AS cnt, SUM(sp.amount_cents) AS total_cents
    FROM subscription_payments sp
    JOIN subscriptions s ON s.id = sp.subscription_id
    JOIN restaurants   r ON r.id = s.restaurant_id
    WHERE r.deleted_at IS NULL
    GROUP BY sp.currency
  ) sub;

  -- orders.currency does not exist; currency lives on the restaurant
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('currency', currency, 'count', cnt, 'total_cents', total_cents)
      ORDER BY currency
    ), '[]'::jsonb
  )
  INTO v_orders
  FROM (
    SELECT r.currency, COUNT(*) AS cnt, SUM(o.total_cents) AS total_cents
    FROM orders o
    JOIN restaurants r ON r.id = o.restaurant_id
    WHERE r.deleted_at IS NULL
    GROUP BY r.currency
  ) sub;

  RETURN jsonb_build_object(
    'restaurants',          v_restaurants,
    'products',             v_products,
    'subscriptions',        v_subs,
    'payments_by_currency', v_payments,
    'orders_by_currency',   v_orders
  );
END;
$$;

REVOKE ALL ON FUNCTION get_admin_platform_metrics() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_admin_platform_metrics() TO authenticated;
