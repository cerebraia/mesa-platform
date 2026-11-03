-- ============================================================
-- Mesa Platform · Migración 038 — Fix is_restaurant_open
-- ============================================================
-- La migración 037 reescribió is_restaurant_open con un bug:
--   • Intentaba leer rc.timezone de restaurant_config, pero esa
--     columna no existe — timezone vive en restaurants.
--   • Usaba SELECT INTO separado en lugar del LEFT JOIN original,
--     lo que causaba NULL en lugar de false cuando la función
--     fallaba por el error de columna.
--
-- Esta migración restaura la función correcta de migración 020
-- añadiendo la guardia de deleted_at que 037 quería incorporar.
-- ============================================================

CREATE OR REPLACE FUNCTION is_restaurant_open(p_restaurant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant_status text;
  v_deleted_at        timestamptz;
  v_tz                text;
  v_is_closed         boolean;
  v_now_local         time;
  v_day               smallint;
  v_open              boolean;
BEGIN
  -- Get restaurant status, timezone and manual closure in one JOIN.
  -- LEFT JOIN means: if restaurant_config doesn't exist yet, is_closed = false.
  SELECT
    r.status,
    r.deleted_at,
    r.timezone,
    COALESCE(rc.is_temporarily_closed, false)
  INTO v_restaurant_status, v_deleted_at, v_tz, v_is_closed
  FROM restaurants r
  LEFT JOIN restaurant_config rc ON rc.restaurant_id = r.id
  WHERE r.id = p_restaurant_id;

  -- Restaurant not found at all
  IF NOT FOUND THEN RETURN false; END IF;

  -- Deleted restaurant → always closed (guard added in migr. 037)
  IF v_deleted_at IS NOT NULL THEN RETURN false; END IF;

  -- Restaurant not active (onboarding, suspended, etc.)
  IF v_restaurant_status <> 'active' THEN RETURN false; END IF;

  -- Manual temporary closure
  IF v_is_closed THEN RETURN false; END IF;

  -- Current local time and day of week (0=Sunday … 6=Saturday)
  SELECT
    (now() AT TIME ZONE COALESCE(v_tz, 'UTC'))::time,
    EXTRACT(DOW FROM now() AT TIME ZONE COALESCE(v_tz, 'UTC'))::smallint
  INTO v_now_local, v_day;

  -- Check if any active interval covers right now (midnight-crossing included)
  SELECT EXISTS (
    SELECT 1 FROM business_hours
    WHERE restaurant_id = p_restaurant_id
      AND is_active = true
      AND (
        -- Same day, normal (opens_at < closes_at)
        (day_of_week = v_day
          AND closes_at > opens_at
          AND v_now_local >= opens_at
          AND v_now_local < closes_at)
        OR
        -- Same day, midnight-crossing start (opens_at after closes_at)
        (day_of_week = v_day
          AND closes_at <= opens_at
          AND v_now_local >= opens_at)
        OR
        -- Previous day, midnight-crossing continuation
        (day_of_week = ((v_day + 6) % 7)::smallint
          AND closes_at <= opens_at
          AND v_now_local < closes_at)
      )
  ) INTO v_open;

  RETURN COALESCE(v_open, false);
END;
$$;

REVOKE ALL ON FUNCTION is_restaurant_open(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION is_restaurant_open(uuid) TO authenticated;
GRANT  EXECUTE ON FUNCTION is_restaurant_open(uuid) TO anon;
