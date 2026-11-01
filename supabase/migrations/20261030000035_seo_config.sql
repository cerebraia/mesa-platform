-- Migration 035: SEO configuration per restaurant
--
-- Adds seo_title, seo_description, seo_image_path, allow_indexing to
-- restaurant_config. Each business can control how it appears in search
-- engines and when its URL is shared on social networks.
--
-- SEO fields are:
--   · Writable only by the restaurant owner (via saveSeo server action).
--   · Readable by anon (needed for server-side generateMetadata).
--   · Never exposed in the public JSON API response that the public menu
--     client receives — they're consumed server-side only by Next.js metadata.
--
-- allow_indexing = false emits noindex + removes the restaurant from the sitemap.
-- Default is true so real businesses are indexed from day one; test/demo
-- businesses should be set to false by the admin.

ALTER TABLE restaurant_config
  ADD COLUMN IF NOT EXISTS seo_title       text
    CHECK (char_length(seo_title)       <= 120),
  ADD COLUMN IF NOT EXISTS seo_description text
    CHECK (char_length(seo_description) <= 320),
  ADD COLUMN IF NOT EXISTS seo_image_path  text
    CHECK (char_length(seo_image_path)  <= 500),
  ADD COLUMN IF NOT EXISTS allow_indexing  boolean NOT NULL DEFAULT true;

-- Grant anon SELECT so generateMetadata (server-side) can read them
-- without requiring a service-role client on public catalog pages.
GRANT SELECT (seo_title, seo_description, seo_image_path, allow_indexing)
  ON restaurant_config TO anon;

-- Extend update_config_image to support seo_image_path, keeping the same
-- atomic read-old / write-new / return-old pattern used for logo and cover.
CREATE OR REPLACE FUNCTION update_config_image(
  p_restaurant_id uuid,
  p_field         text,   -- 'logo_path', 'cover_path', or 'seo_image_path'
  p_new_path      text    -- null to clear
)
RETURNS text               -- old path (null if none)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_path text;
BEGIN
  IF member_role(p_restaurant_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Solo el propietario puede modificar imágenes de configuración'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_field NOT IN ('logo_path', 'cover_path', 'seo_image_path') THEN
    RAISE EXCEPTION 'Campo de imagen no válido: %', p_field
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Insert row if it doesn't exist yet (first save)
  INSERT INTO restaurant_config (restaurant_id)
  VALUES (p_restaurant_id)
  ON CONFLICT (restaurant_id) DO NOTHING;

  IF p_field = 'logo_path' THEN
    SELECT logo_path       INTO v_old_path FROM restaurant_config WHERE restaurant_id = p_restaurant_id;
    UPDATE restaurant_config SET logo_path      = p_new_path, updated_at = now() WHERE restaurant_id = p_restaurant_id;
  ELSIF p_field = 'cover_path' THEN
    SELECT cover_path      INTO v_old_path FROM restaurant_config WHERE restaurant_id = p_restaurant_id;
    UPDATE restaurant_config SET cover_path     = p_new_path, updated_at = now() WHERE restaurant_id = p_restaurant_id;
  ELSE
    SELECT seo_image_path  INTO v_old_path FROM restaurant_config WHERE restaurant_id = p_restaurant_id;
    UPDATE restaurant_config SET seo_image_path = p_new_path, updated_at = now() WHERE restaurant_id = p_restaurant_id;
  END IF;

  RETURN v_old_path;
END;
$$;

REVOKE ALL ON FUNCTION update_config_image(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_config_image(uuid, text, text) TO authenticated;
