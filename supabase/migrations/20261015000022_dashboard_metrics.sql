-- ============================================================
-- Mesa Platform · Migración 022 — Dashboard metrics RPC
-- ============================================================
-- get_dashboard_metrics: agregaciones para el resumen operativo.
--
-- Acceso: member_role() valida la membresía; los datos financieros
-- (paid_cents, avg_ticket_cents, published_products) solo se
-- devuelven a owner y attention. Kitchen recibe solo conteos
-- operativos y la cola de preparación.
--
-- Las fechas de inicio y fin del período se calculan en la zona
-- horaria del restaurante para que "Hoy" y "Este mes" coincidan
-- con el calendario local del negocio.
--
-- Definiciones:
--   orders_period   : COUNT de todos los pedidos creados en el período,
--                     independientemente de su estado final.
--   orders_active   : COUNT en tiempo real de pedidos no terminales
--                     (received, accepted, preparing, ready, on_the_way).
--   paid_cents      : SUM de total_cents donde payment_status='confirmed'
--                     AND status NOT IN ('cancelled','rejected') en el período.
--                     Representa lo confirmado cobrado, NO ingresos netos.
--   avg_ticket_cents: AVG de total_cents excluyendo cancelled y rejected en
--                     el período. Ticket promedio de pedidos procesados.
--   published_products: COUNT en tiempo real de productos publicados.
-- ============================================================

CREATE OR REPLACE FUNCTION get_dashboard_metrics(
  p_restaurant_id uuid,
  p_period        text    DEFAULT 'today',
  p_timezone      text    DEFAULT 'America/Caracas'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role            text;
  v_period_start    timestamptz;
  v_period_end      timestamptz;
  v_orders_period   bigint;
  v_orders_active   bigint;
  v_paid_cents      bigint;
  v_avg_cents       bigint;
  v_products        bigint;
  v_recent          jsonb;
BEGIN
  v_role := member_role(p_restaurant_id);
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Acceso denegado: sin membresía activa'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- ── Period bounds in restaurant timezone ──────────────────
  -- date_trunc('day', <timestamp tz>) AT TIME ZONE tz produces the
  -- correct UTC-equivalent start-of-day for that local timezone.
  CASE p_period
    WHEN 'today' THEN
      v_period_start := date_trunc('day', now() AT TIME ZONE p_timezone)
                          AT TIME ZONE p_timezone;
      v_period_end   := v_period_start + interval '1 day';

    WHEN 'yesterday' THEN
      v_period_end   := date_trunc('day', now() AT TIME ZONE p_timezone)
                          AT TIME ZONE p_timezone;
      v_period_start := v_period_end - interval '1 day';

    WHEN '7days' THEN
      v_period_end   := date_trunc('day', now() AT TIME ZONE p_timezone)
                          AT TIME ZONE p_timezone + interval '1 day';
      v_period_start := v_period_end - interval '7 days';

    WHEN 'month' THEN
      v_period_start := date_trunc('month', now() AT TIME ZONE p_timezone)
                          AT TIME ZONE p_timezone;
      v_period_end   := v_period_start + interval '1 month';

    ELSE -- fallback to today
      v_period_start := date_trunc('day', now() AT TIME ZONE p_timezone)
                          AT TIME ZONE p_timezone;
      v_period_end   := v_period_start + interval '1 day';
  END CASE;

  -- ── Pedidos recibidos en el período (all statuses) ────────
  SELECT COUNT(*)
  INTO v_orders_period
  FROM orders
  WHERE restaurant_id = p_restaurant_id
    AND created_at   >= v_period_start
    AND created_at    < v_period_end;

  -- ── Pedidos activos (tiempo real, sin filtro de período) ──
  SELECT COUNT(*)
  INTO v_orders_active
  FROM orders
  WHERE restaurant_id = p_restaurant_id
    AND status NOT IN ('completed', 'rejected', 'cancelled');

  -- ── Métricas financieras (owner y attention únicamente) ───
  IF v_role IN ('owner', 'attention') THEN

    SELECT COALESCE(SUM(total_cents), 0)
    INTO v_paid_cents
    FROM orders
    WHERE restaurant_id   = p_restaurant_id
      AND created_at     >= v_period_start
      AND created_at      < v_period_end
      AND payment_status  = 'confirmed'
      AND status NOT IN ('cancelled', 'rejected');

    SELECT COALESCE(AVG(total_cents)::bigint, 0)
    INTO v_avg_cents
    FROM orders
    WHERE restaurant_id = p_restaurant_id
      AND created_at   >= v_period_start
      AND created_at    < v_period_end
      AND status NOT IN ('cancelled', 'rejected');

    SELECT COUNT(*)
    INTO v_products
    FROM products
    WHERE restaurant_id = p_restaurant_id
      AND is_published  = true;

    -- Recent orders: last 5, with commercial + payment data
    SELECT jsonb_agg(row_to_json(r) ORDER BY r.created_at DESC)
    INTO v_recent
    FROM (
      SELECT id,
             order_number,
             status,
             payment_status,
             modality,
             total_cents,
             created_at
      FROM orders
      WHERE restaurant_id = p_restaurant_id
      ORDER BY created_at DESC
      LIMIT 5
    ) r;

  ELSE
    -- Kitchen: no financial metrics
    v_paid_cents := NULL;
    v_avg_cents  := NULL;
    v_products   := NULL;

    -- Kitchen queue: active orders (accepted/preparing/ready), oldest first
    SELECT jsonb_agg(row_to_json(r) ORDER BY r.created_at ASC)
    INTO v_recent
    FROM (
      SELECT id,
             order_number,
             status,
             modality,
             created_at
      FROM orders
      WHERE restaurant_id = p_restaurant_id
        AND status IN ('accepted', 'preparing', 'ready')
      ORDER BY created_at ASC
      LIMIT 10
    ) r;
  END IF;

  RETURN jsonb_build_object(
    'period',               p_period,
    'period_start',         v_period_start,
    'period_end',           v_period_end,
    'orders_period',        v_orders_period,
    'orders_active',        v_orders_active,
    'paid_cents',           v_paid_cents,
    'avg_ticket_cents',     v_avg_cents,
    'published_products',   v_products,
    'recent_orders',        COALESCE(v_recent, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION get_dashboard_metrics(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_dashboard_metrics(uuid, text, text) TO authenticated;
