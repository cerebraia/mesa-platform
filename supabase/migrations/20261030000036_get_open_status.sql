-- Migration 036 — get_business_open_status
-- Returns structured open/close status for the public catalog header.
-- Uses the same midnight-crossing logic as is_restaurant_open (migration 013).
-- Returns NULL when the restaurant has no active business_hours configured,
-- so the caller can omit the status indicator rather than showing a wrong state.

CREATE OR REPLACE FUNCTION get_business_open_status(p_restaurant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tz         text;
  v_is_closed  boolean;
  v_closed_msg text;
  v_now_local  time;
  v_day        smallint;
  v_has_hours  boolean;
  v_close_time time;
  v_open_time  time;
BEGIN
  -- Get timezone and temporary-closure status (SECURITY DEFINER bypasses anon column grants)
  SELECT r.timezone,
         COALESCE(rc.is_temporarily_closed, false),
         rc.closed_message
  INTO v_tz, v_is_closed, v_closed_msg
  FROM restaurants r
  LEFT JOIN restaurant_config rc ON rc.restaurant_id = r.id
  WHERE r.id = p_restaurant_id AND r.status = 'active';

  IF NOT FOUND THEN RETURN NULL; END IF;

  IF v_is_closed THEN
    RETURN jsonb_build_object(
      'status',         'temporarily_closed',
      'closed_message', v_closed_msg
    );
  END IF;

  -- Current local time in the restaurant's timezone
  SELECT
    (now() AT TIME ZONE COALESCE(v_tz, 'UTC'))::time,
    EXTRACT(DOW FROM now() AT TIME ZONE COALESCE(v_tz, 'UTC'))::smallint
  INTO v_now_local, v_day;

  -- Omit status entirely when no active schedules exist
  SELECT EXISTS(
    SELECT 1 FROM business_hours
    WHERE restaurant_id = p_restaurant_id AND is_active = true
  ) INTO v_has_hours;

  IF NOT v_has_hours THEN RETURN NULL; END IF;

  -- ── Open now? ──────────────────────────────────────────────────────────
  -- Mirrors the three cases from is_restaurant_open; picks earliest close.
  SELECT closes_at
  INTO v_close_time
  FROM business_hours
  WHERE restaurant_id = p_restaurant_id
    AND is_active = true
    AND (
      -- Normal interval (non-crossing): same day, within window
      (day_of_week = v_day
         AND closes_at > opens_at
         AND v_now_local >= opens_at
         AND v_now_local < closes_at)
      OR
      -- Midnight-crossing start: same day, past opens_at
      (day_of_week = v_day
         AND closes_at <= opens_at
         AND v_now_local >= opens_at)
      OR
      -- Midnight-crossing continuation: previous day, still before closes_at
      (day_of_week = ((v_day + 6) % 7)::smallint
         AND closes_at <= opens_at
         AND v_now_local < closes_at)
    )
  ORDER BY closes_at ASC
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'status',    'open',
      'closes_at', to_char(v_close_time, 'HH24:MI')
    );
  END IF;

  -- ── Closed — find next opening ─────────────────────────────────────────
  -- 1. Later today
  SELECT opens_at
  INTO v_open_time
  FROM business_hours
  WHERE restaurant_id = p_restaurant_id
    AND is_active = true
    AND day_of_week = v_day
    AND opens_at > v_now_local
  ORDER BY opens_at ASC
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'status',   'closed',
      'opens_at', to_char(v_open_time, 'HH24:MI')
    );
  END IF;

  -- 2. Tomorrow (simplification: does not walk through entire week)
  SELECT opens_at
  INTO v_open_time
  FROM business_hours
  WHERE restaurant_id = p_restaurant_id
    AND is_active = true
    AND day_of_week = ((v_day + 1) % 7)::smallint
  ORDER BY opens_at ASC
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'status',   'closed',
      'opens_at', to_char(v_open_time, 'HH24:MI')
    );
  END IF;

  RETURN jsonb_build_object('status', 'closed');
END;
$$;

REVOKE ALL ON FUNCTION get_business_open_status(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_business_open_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_business_open_status(uuid) TO anon;
