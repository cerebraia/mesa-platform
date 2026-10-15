-- ============================================================
-- Mesa Platform · Migración 013 — Funciones de configuración
-- ============================================================

-- ── is_restaurant_open ────────────────────────────────────────
-- Calcula si un restaurante está abierto ahora mismo.
-- Considera:
--   1. Cierre manual (is_temporarily_closed).
--   2. Hora actual convertida a la zona horaria del restaurante.
--   3. Intervalos activos del business_hours para el día actual.
--   4. Intervalos que cruzan medianoche (closes_at < opens_at):
--      se verifica también el día anterior para cubrir el caso
--      donde un intervalo 22:00→02:00 del día previo aún está activo.
-- SECURITY DEFINER: accesible desde anon (no tiene SELECT en
-- business_hours ni restaurant_config directamente — RLS filtra,
-- pero la función puede leer internamente como owner de la función).
CREATE OR REPLACE FUNCTION is_restaurant_open(p_restaurant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tz         text;
  v_is_closed  boolean;
  v_now_local  time;
  v_day        smallint;
  v_open       boolean;
BEGIN
  -- Get timezone and manual closure
  SELECT
    r.timezone,
    COALESCE(rc.is_temporarily_closed, false)
  INTO v_tz, v_is_closed
  FROM restaurants r
  LEFT JOIN restaurant_config rc ON rc.restaurant_id = r.id
  WHERE r.id = p_restaurant_id;

  IF NOT FOUND THEN RETURN false; END IF;
  IF v_is_closed THEN RETURN false; END IF;

  -- Current local time and day of week (0=Sunday … 6=Saturday)
  SELECT
    (now() AT TIME ZONE COALESCE(v_tz, 'UTC'))::time,
    EXTRACT(DOW FROM now() AT TIME ZONE COALESCE(v_tz, 'UTC'))::smallint
  INTO v_now_local, v_day;

  SELECT EXISTS (
    SELECT 1 FROM business_hours
    WHERE restaurant_id = p_restaurant_id
      AND is_active = true
      AND (
        -- Same day, normal (non-crossing): opens_at <= closes_at
        (day_of_week = v_day
          AND closes_at > opens_at
          AND v_now_local >= opens_at
          AND v_now_local < closes_at)
        OR
        -- Same day, midnight-crossing start: currently after opens_at
        (day_of_week = v_day
          AND closes_at <= opens_at
          AND v_now_local >= opens_at)
        OR
        -- Previous day, midnight-crossing continuation: currently before closes_at
        (day_of_week = ((v_day + 6) % 7)::smallint
          AND closes_at <= opens_at
          AND v_now_local < closes_at)
      )
  ) INTO v_open;

  RETURN COALESCE(v_open, false);
END;
$$;

REVOKE ALL ON FUNCTION is_restaurant_open(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_restaurant_open(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION is_restaurant_open(uuid) TO anon;

-- ── save_restaurant_config ────────────────────────────────────
-- Upsert atómico de restaurant_config + update de restaurants.name
-- y restaurants.timezone. Verifica que el llamante sea owner.
CREATE OR REPLACE FUNCTION save_restaurant_config(
  p_restaurant_id uuid,
  p_name          text,
  p_timezone      text,
  p_config        jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF member_role(p_restaurant_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Solo los propietarios pueden modificar la configuración'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Update name and timezone on restaurants table
  UPDATE restaurants
  SET name      = COALESCE(NULLIF(p_name, ''), name),
      timezone  = COALESCE(NULLIF(p_timezone, ''), timezone),
      updated_at = now()
  WHERE id = p_restaurant_id;

  -- Upsert restaurant_config
  INSERT INTO restaurant_config (
    restaurant_id, description, primary_color, phone, whatsapp,
    instagram_url, facebook_url, twitter_url, address,
    pickup_enabled, pickup_address, pickup_notes,
    delivery_enabled, is_temporarily_closed, closed_message
  ) VALUES (
    p_restaurant_id,
    NULLIF(p_config->>'description', ''),
    NULLIF(p_config->>'primary_color', ''),
    NULLIF(p_config->>'phone', ''),
    NULLIF(p_config->>'whatsapp', ''),
    NULLIF(p_config->>'instagram_url', ''),
    NULLIF(p_config->>'facebook_url', ''),
    NULLIF(p_config->>'twitter_url', ''),
    NULLIF(p_config->>'address', ''),
    COALESCE((p_config->>'pickup_enabled')::boolean, false),
    NULLIF(p_config->>'pickup_address', ''),
    NULLIF(p_config->>'pickup_notes', ''),
    COALESCE((p_config->>'delivery_enabled')::boolean, false),
    COALESCE((p_config->>'is_temporarily_closed')::boolean, false),
    NULLIF(p_config->>'closed_message', '')
  )
  ON CONFLICT (restaurant_id) DO UPDATE SET
    description           = EXCLUDED.description,
    primary_color         = EXCLUDED.primary_color,
    phone                 = EXCLUDED.phone,
    whatsapp              = EXCLUDED.whatsapp,
    instagram_url         = EXCLUDED.instagram_url,
    facebook_url          = EXCLUDED.facebook_url,
    twitter_url           = EXCLUDED.twitter_url,
    address               = EXCLUDED.address,
    pickup_enabled        = EXCLUDED.pickup_enabled,
    pickup_address        = EXCLUDED.pickup_address,
    pickup_notes          = EXCLUDED.pickup_notes,
    delivery_enabled      = EXCLUDED.delivery_enabled,
    is_temporarily_closed = EXCLUDED.is_temporarily_closed,
    closed_message        = EXCLUDED.closed_message,
    updated_at            = now();
END;
$$;

REVOKE ALL ON FUNCTION save_restaurant_config(uuid, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION save_restaurant_config(uuid, text, text, jsonb) TO authenticated;

-- ── update_config_image ───────────────────────────────────────
-- Actualiza logo_path o cover_path en restaurant_config.
-- Sigue el patrón: guardar nueva referencia; solo después borrar la antigua.
-- El borrado del Storage lo hace la aplicación.
CREATE OR REPLACE FUNCTION update_config_image(
  p_restaurant_id uuid,
  p_field         text,   -- 'logo_path' or 'cover_path'
  p_new_path      text
)
RETURNS text   -- returns old path (so caller can delete from Storage)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_path text;
BEGIN
  IF member_role(p_restaurant_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Solo los propietarios pueden modificar imágenes'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_field NOT IN ('logo_path', 'cover_path') THEN
    RAISE EXCEPTION 'Campo de imagen no válido: %', p_field
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Ensure row exists
  INSERT INTO restaurant_config (restaurant_id)
  VALUES (p_restaurant_id)
  ON CONFLICT (restaurant_id) DO NOTHING;

  IF p_field = 'logo_path' THEN
    SELECT logo_path INTO v_old_path FROM restaurant_config WHERE restaurant_id = p_restaurant_id;
    UPDATE restaurant_config SET logo_path = p_new_path, updated_at = now()
    WHERE restaurant_id = p_restaurant_id;
  ELSE
    SELECT cover_path INTO v_old_path FROM restaurant_config WHERE restaurant_id = p_restaurant_id;
    UPDATE restaurant_config SET cover_path = p_new_path, updated_at = now()
    WHERE restaurant_id = p_restaurant_id;
  END IF;

  RETURN v_old_path;
END;
$$;

REVOKE ALL ON FUNCTION update_config_image(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_config_image(uuid, text, text) TO authenticated;

-- ── save_business_hours ───────────────────────────────────────
-- Reemplaza todos los horarios del restaurante de forma atómica.
CREATE OR REPLACE FUNCTION save_business_hours(
  p_restaurant_id uuid,
  p_hours         jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row jsonb;
BEGIN
  IF member_role(p_restaurant_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Solo los propietarios pueden modificar horarios'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  DELETE FROM business_hours WHERE restaurant_id = p_restaurant_id;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_hours)
  LOOP
    INSERT INTO business_hours (restaurant_id, day_of_week, opens_at, closes_at, is_active)
    VALUES (
      p_restaurant_id,
      (v_row->>'day_of_week')::smallint,
      (v_row->>'opens_at')::time,
      (v_row->>'closes_at')::time,
      COALESCE((v_row->>'is_active')::boolean, true)
    );
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION save_business_hours(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION save_business_hours(uuid, jsonb) TO authenticated;
