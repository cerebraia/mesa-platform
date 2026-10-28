-- Migration 030: Stock tracking configuration
-- Adds stock_tracking_enabled toggle to restaurant_config.
-- When disabled, stock columns are hidden from the product form.

-- ── Add column ─────────────────────────────────────────────────────────────

ALTER TABLE restaurant_config
  ADD COLUMN IF NOT EXISTS stock_tracking_enabled boolean NOT NULL DEFAULT false;

-- authenticated can read this column (needed for the panel form)
GRANT SELECT (stock_tracking_enabled) ON restaurant_config TO authenticated;

-- anon does NOT need this column (it's an internal operational setting)

-- ── Extend save_restaurant_config RPC ──────────────────────────────────────
-- Re-creates the function to also handle stock_tracking_enabled.
-- Preserves all existing functionality; adds the new field.

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

  -- Upsert restaurant_config (includes stock_tracking_enabled)
  INSERT INTO restaurant_config (
    restaurant_id, description, primary_color, phone, whatsapp,
    instagram_url, facebook_url, twitter_url, address,
    pickup_enabled, pickup_address, pickup_notes,
    delivery_enabled, is_temporarily_closed, closed_message,
    stock_tracking_enabled
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
    COALESCE((p_config->>'stock_tracking_enabled')::boolean, false)
  )
  ON CONFLICT (restaurant_id) DO UPDATE SET
    description            = EXCLUDED.description,
    primary_color          = EXCLUDED.primary_color,
    phone                  = EXCLUDED.phone,
    whatsapp               = EXCLUDED.whatsapp,
    instagram_url          = EXCLUDED.instagram_url,
    facebook_url           = EXCLUDED.facebook_url,
    twitter_url            = EXCLUDED.twitter_url,
    address                = EXCLUDED.address,
    pickup_enabled         = EXCLUDED.pickup_enabled,
    pickup_address         = EXCLUDED.pickup_address,
    pickup_notes           = EXCLUDED.pickup_notes,
    delivery_enabled       = EXCLUDED.delivery_enabled,
    is_temporarily_closed  = EXCLUDED.is_temporarily_closed,
    closed_message         = EXCLUDED.closed_message,
    stock_tracking_enabled = EXCLUDED.stock_tracking_enabled,
    updated_at             = now();
END;
$$;

REVOKE ALL ON FUNCTION save_restaurant_config(uuid, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION save_restaurant_config(uuid, text, text, jsonb) TO authenticated;
