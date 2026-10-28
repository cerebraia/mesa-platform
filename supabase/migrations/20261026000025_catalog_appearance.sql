-- ============================================================
-- Migration 025 — catalog_appearance
-- Añade background_color, secondary_color y font_family a
-- restaurant_config para que cada negocio pueda personalizar
-- la apariencia de su catálogo público desde el panel.
--
-- Columnas:
--   background_color TEXT  — Color de fondo del catálogo (hex, p.ej. "#fbf3e8")
--   secondary_color  TEXT  — Color de texto secundario / acento complementario
--   font_family      TEXT  — Familia tipográfica: null = Poppins (default), "Nunito"
--
-- Todos los campos son opcionales. Si son null, el catálogo usa
-- los valores por defecto de Mesa.
-- ============================================================

-- ── 1. Columnas ──────────────────────────────────────────────

ALTER TABLE restaurant_config
  ADD COLUMN IF NOT EXISTS background_color TEXT,
  ADD COLUMN IF NOT EXISTS secondary_color  TEXT,
  ADD COLUMN IF NOT EXISTS font_family      TEXT;

-- ── 2. Permisos de anon ──────────────────────────────────────
-- El catálogo público necesita leer estos valores para renderizar
-- la apariencia correcta.

GRANT SELECT (background_color, secondary_color, font_family)
  ON restaurant_config TO anon;

-- ── 3. Actualizar RPC save_restaurant_config ─────────────────
-- Reemplaza la versión de migration 024 (orders_enabled).

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

  UPDATE restaurants
  SET name       = COALESCE(NULLIF(p_name, ''), name),
      timezone   = COALESCE(NULLIF(p_timezone, ''), timezone),
      updated_at = now()
  WHERE id = p_restaurant_id;

  INSERT INTO restaurant_config (
    restaurant_id, description, primary_color,
    background_color, secondary_color, font_family,
    phone, whatsapp,
    instagram_url, facebook_url, twitter_url, address,
    pickup_enabled, pickup_address, pickup_notes,
    delivery_enabled, is_temporarily_closed, closed_message,
    orders_enabled
  ) VALUES (
    p_restaurant_id,
    NULLIF(p_config->>'description', ''),
    NULLIF(p_config->>'primary_color', ''),
    NULLIF(p_config->>'background_color', ''),
    NULLIF(p_config->>'secondary_color', ''),
    NULLIF(p_config->>'font_family', ''),
    NULLIF(p_config->>'phone', ''),
    NULLIF(p_config->>'whatsapp', ''),
    NULLIF(p_config->>'instagram_url', ''),
    NULLIF(p_config->>'facebook_url', ''),
    NULLIF(p_config->>'twitter_url', ''),
    NULLIF(p_config->>'address', ''),
    COALESCE((p_config->>'pickup_enabled')::boolean,  false),
    NULLIF(p_config->>'pickup_address', ''),
    NULLIF(p_config->>'pickup_notes', ''),
    COALESCE((p_config->>'delivery_enabled')::boolean,      false),
    COALESCE((p_config->>'is_temporarily_closed')::boolean, false),
    NULLIF(p_config->>'closed_message', ''),
    COALESCE((p_config->>'orders_enabled')::boolean, true)
  )
  ON CONFLICT (restaurant_id) DO UPDATE SET
    description           = EXCLUDED.description,
    primary_color         = EXCLUDED.primary_color,
    background_color      = EXCLUDED.background_color,
    secondary_color       = EXCLUDED.secondary_color,
    font_family           = EXCLUDED.font_family,
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
