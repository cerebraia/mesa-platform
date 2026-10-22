-- ============================================================
-- Mesa Platform · Migración 024 — Modalidad del catálogo
-- ============================================================
-- Mesa es ahora una plataforma de catálogos digitales.
-- Los pedidos son una función adicional activable por negocio.
--
-- 1. Añade orders_enabled a restaurant_config.
--    DEFAULT true garantiza compatibilidad con negocios existentes.
-- 2. Concede SELECT de la columna a anon (el menú público lo necesita).
-- 3. Actualiza save_restaurant_config para persistir orders_enabled.
-- 4. Añade trigger BEFORE INSERT en orders que bloquea inserciones
--    cuando orders_enabled = false — independiente de la capa de app.
-- ============================================================

-- ── 1. Columna ──────────────────────────────────────────────

ALTER TABLE restaurant_config
  ADD COLUMN IF NOT EXISTS orders_enabled boolean NOT NULL DEFAULT true;

-- ── 2. Permisos de anon ──────────────────────────────────────
-- La información es pública: el catálogo necesita saber si
-- el botón de carrito debe mostrarse.

GRANT SELECT (orders_enabled) ON restaurant_config TO anon;

-- ── 3. Actualizar RPC save_restaurant_config ─────────────────

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

  -- Actualizar nombre y zona horaria
  UPDATE restaurants
  SET name       = COALESCE(NULLIF(p_name, ''), name),
      timezone   = COALESCE(NULLIF(p_timezone, ''), timezone),
      updated_at = now()
  WHERE id = p_restaurant_id;

  -- Upsert restaurant_config incluyendo orders_enabled
  INSERT INTO restaurant_config (
    restaurant_id, description, primary_color, phone, whatsapp,
    instagram_url, facebook_url, twitter_url, address,
    pickup_enabled, pickup_address, pickup_notes,
    delivery_enabled, is_temporarily_closed, closed_message,
    orders_enabled
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
    NULLIF(p_config->>'closed_message', ''),
    COALESCE((p_config->>'orders_enabled')::boolean, true)
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
    orders_enabled        = EXCLUDED.orders_enabled,
    updated_at            = now();
END;
$$;

REVOKE ALL ON FUNCTION save_restaurant_config(uuid, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION save_restaurant_config(uuid, text, text, jsonb) TO authenticated;

-- ── 4. Trigger: bloquear INSERT en orders cuando orders_enabled = false ──
-- Actúa en la capa de base de datos independientemente de la API o RPC.
-- Si no existe fila de config, el DEFAULT true se aplica (onboarding libre).
-- place_order es SECURITY DEFINER pero auth.uid() sigue siendo el usuario
-- real durante la llamada; el trigger lo intercepta antes del INSERT.

CREATE OR REPLACE FUNCTION guard_orders_enabled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled boolean;
BEGIN
  SELECT COALESCE(orders_enabled, true)
  INTO v_enabled
  FROM restaurant_config
  WHERE restaurant_id = NEW.restaurant_id;

  -- Sin fila de config = onboarding, sin restricción
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF NOT v_enabled THEN
    RAISE EXCEPTION 'Los pedidos no están habilitados para este negocio.'
      USING ERRCODE = 'check_violation', HINT = 'ORDERS_DISABLED';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_orders_enabled ON orders;
CREATE TRIGGER trg_guard_orders_enabled
  BEFORE INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION guard_orders_enabled();
