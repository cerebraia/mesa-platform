-- ============================================================
-- Mesa Platform · Migración 037 — Soft-delete de negocios + tipo
-- ============================================================
-- Cambios:
-- 1. restaurants: añade deleted_at, deleted_by, business_type.
-- 2. Índice parcial para listar negocios activos eficientemente.
-- 3. RPC soft_delete_restaurant (admin) — suspende + marca deleted_at.
-- 4. RPC restore_restaurant (admin) — limpia deleted_at, status queda
--    en 'suspended'; el admin activa manualmente después.
-- 5. is_restaurant_open actualizada: devuelve false si deleted_at IS NOT NULL.
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- 1. Columnas nuevas en restaurants
-- ════════════════════════════════════════════════════════════

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS deleted_at  timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS business_type text NOT NULL DEFAULT 'restaurant'
    CHECK (business_type IN ('restaurant', 'store', 'other'));

-- Índice parcial: la mayoría de las consultas admin filtran deleted_at IS NULL
CREATE INDEX IF NOT EXISTS idx_restaurants_not_deleted
  ON restaurants (created_at DESC)
  WHERE deleted_at IS NULL;

-- ════════════════════════════════════════════════════════════
-- 2. is_restaurant_open — añade guardia de deleted_at
-- ════════════════════════════════════════════════════════════
-- Garantía extra: aunque alguien restaure el status a 'active' sin
-- limpiar deleted_at, la función rechaza el restaurante.

CREATE OR REPLACE FUNCTION is_restaurant_open(p_restaurant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status            text;
  v_deleted_at        timestamptz;
  v_timezone          text;
  v_temporarily_closed boolean;
  v_has_hours         boolean;
  v_now_local         timestamptz;
  v_day               int;
  v_time_local        time;
  v_open              boolean := false;
BEGIN
  -- Load restaurant basics
  SELECT status, deleted_at
    INTO v_status, v_deleted_at
    FROM restaurants
   WHERE id = p_restaurant_id;

  -- Deleted or suspended restaurant → always closed
  IF v_status IS NULL OR v_status <> 'active' OR v_deleted_at IS NOT NULL THEN
    RETURN false;
  END IF;

  -- Load config
  SELECT rc.timezone, rc.is_temporarily_closed
    INTO v_timezone, v_temporarily_closed
    FROM restaurant_config rc
   WHERE rc.restaurant_id = p_restaurant_id;

  IF v_temporarily_closed THEN RETURN false; END IF;

  v_timezone := COALESCE(v_timezone, 'UTC');

  BEGIN
    v_now_local := now() AT TIME ZONE v_timezone;
  EXCEPTION WHEN OTHERS THEN
    v_now_local := now();
  END;

  v_day        := EXTRACT(DOW FROM v_now_local)::int; -- 0=Sun … 6=Sat
  v_time_local := v_now_local::time;

  -- Check if any active interval covers right now (including midnight crossings)
  SELECT EXISTS (
    SELECT 1
      FROM business_hours bh
     WHERE bh.restaurant_id = p_restaurant_id
       AND bh.is_active = true
       AND bh.day_of_week = v_day
       AND (
         -- Normal interval (opens_at < closes_at)
         (bh.opens_at <= bh.closes_at AND v_time_local BETWEEN bh.opens_at AND bh.closes_at)
         OR
         -- Midnight-crossing interval: check the closing side on the previous day
         (bh.opens_at > bh.closes_at AND v_time_local >= bh.opens_at)
       )
    UNION ALL
    -- Midnight-crossing from the previous day (day_of_week = yesterday)
    SELECT 1
      FROM business_hours bh
     WHERE bh.restaurant_id = p_restaurant_id
       AND bh.is_active = true
       AND bh.day_of_week = ((v_day + 6) % 7) -- yesterday
       AND bh.opens_at > bh.closes_at           -- midnight-crossing
       AND v_time_local <= bh.closes_at
  ) INTO v_open;

  -- Check if any hours exist at all for this restaurant
  SELECT EXISTS (
    SELECT 1 FROM business_hours WHERE restaurant_id = p_restaurant_id
  ) INTO v_has_hours;

  -- No hours configured → treat as always open
  IF NOT v_has_hours THEN RETURN true; END IF;

  RETURN v_open;
END;
$$;

REVOKE ALL ON FUNCTION is_restaurant_open(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION is_restaurant_open(uuid) TO authenticated;
GRANT  EXECUTE ON FUNCTION is_restaurant_open(uuid) TO anon;

-- ════════════════════════════════════════════════════════════
-- 3. soft_delete_restaurant — solo platform_admin
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION soft_delete_restaurant(p_restaurant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'No autorizado: se requiere platform_admin';
  END IF;

  UPDATE restaurants
     SET deleted_at  = now(),
         deleted_by  = auth.uid(),
         status      = 'suspended',   -- blocks place_order via is_restaurant_open
         updated_at  = now()
   WHERE id = p_restaurant_id
     AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Negocio no encontrado o ya eliminado';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION soft_delete_restaurant(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION soft_delete_restaurant(uuid) TO authenticated;

-- ════════════════════════════════════════════════════════════
-- 4. restore_restaurant — solo platform_admin
-- ════════════════════════════════════════════════════════════
-- Limpia deleted_at pero deja status = 'suspended'.
-- El admin activa el negocio explícitamente después si lo desea.

CREATE OR REPLACE FUNCTION restore_restaurant(p_restaurant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'No autorizado: se requiere platform_admin';
  END IF;

  UPDATE restaurants
     SET deleted_at = NULL,
         deleted_by = NULL,
         updated_at = now()
         -- status stays 'suspended'; admin reactivates manually
   WHERE id = p_restaurant_id
     AND deleted_at IS NOT NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Negocio no encontrado o no está en estado eliminado';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION restore_restaurant(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION restore_restaurant(uuid) TO authenticated;
