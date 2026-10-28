-- ============================================================
-- Migration 026 — product_image_fit
-- Añade image_fit a products para controlar el encuadre de la
-- miniatura en el catálogo público.
--
--   NULL o 'cover'   → rellena el cuadro (por defecto)
--   'contain'        → muestra el producto completo sin recorte
--
-- El campo es opcional; null se interpreta como 'cover' en el
-- cliente sin lógica extra en la BD.
-- ============================================================

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS image_fit TEXT;

-- Anon necesita leerlo para renderizar la miniatura correcta.
GRANT SELECT (image_fit) ON products TO anon;

-- ── Actualizar RPC upsert_product para persistir image_fit ────
-- Reemplaza la versión de migration 007 (catalog_rpc.sql).

CREATE OR REPLACE FUNCTION upsert_product(
  p_restaurant_id  uuid,
  p_product        jsonb,
  p_variants       jsonb DEFAULT '[]',
  p_option_groups  jsonb DEFAULT '[]'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_id uuid;
  v_pos        int;
BEGIN
  IF member_role(p_restaurant_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Solo los propietarios pueden modificar el catálogo'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- ── Upsert product ──────────────────────────────────────────
  IF (p_product->>'id') IS NOT NULL AND (p_product->>'id') <> '' THEN
    -- UPDATE
    UPDATE products SET
      category_id      = (p_product->>'category_id')::uuid,
      name             = p_product->>'name',
      description      = NULLIF(p_product->>'description', ''),
      base_price_cents = (p_product->>'base_price_cents')::int,
      promo_price_cents= NULLIF(p_product->>'promo_price_cents', '')::int,
      is_available     = COALESCE((p_product->>'is_available')::boolean, true),
      is_published     = COALESCE((p_product->>'is_published')::boolean, false),
      position         = COALESCE((p_product->>'position')::int, 0),
      image_fit        = NULLIF(p_product->>'image_fit', ''),
      updated_at       = now()
    WHERE id = (p_product->>'id')::uuid
      AND restaurant_id = p_restaurant_id
    RETURNING id INTO v_product_id;

    IF v_product_id IS NULL THEN
      RAISE EXCEPTION 'Producto no encontrado o no pertenece a este restaurante'
        USING ERRCODE = 'no_data_found';
    END IF;
  ELSE
    -- INSERT — calculate next position
    SELECT COALESCE(MAX(position), -1) + 1
      INTO v_pos
      FROM products
     WHERE restaurant_id = p_restaurant_id
       AND category_id = (p_product->>'category_id')::uuid;

    INSERT INTO products (
      restaurant_id, category_id, name, description,
      base_price_cents, promo_price_cents,
      is_available, is_published, position, image_fit
    ) VALUES (
      p_restaurant_id,
      (p_product->>'category_id')::uuid,
      p_product->>'name',
      NULLIF(p_product->>'description', ''),
      (p_product->>'base_price_cents')::int,
      NULLIF(p_product->>'promo_price_cents', '')::int,
      COALESCE((p_product->>'is_available')::boolean, true),
      COALESCE((p_product->>'is_published')::boolean, false),
      COALESCE((p_product->>'position')::int, v_pos),
      NULLIF(p_product->>'image_fit', '')
    )
    RETURNING id INTO v_product_id;
  END IF;

  -- ── Variants ────────────────────────────────────────────────
  DELETE FROM product_variants WHERE product_id = v_product_id AND restaurant_id = p_restaurant_id;
  INSERT INTO product_variants (product_id, restaurant_id, name, price_cents, is_available, position)
  SELECT v_product_id, p_restaurant_id,
    v->>'name',
    (v->>'price_cents')::int,
    COALESCE((v->>'is_available')::boolean, true),
    ordinality - 1
  FROM jsonb_array_elements(p_variants) WITH ORDINALITY AS t(v, ordinality);

  -- ── Option groups + options ──────────────────────────────────
  DELETE FROM option_groups WHERE product_id = v_product_id AND restaurant_id = p_restaurant_id;
  INSERT INTO option_groups (product_id, restaurant_id, name, min_selections, max_selections, position)
  SELECT v_product_id, p_restaurant_id,
    g->>'name',
    COALESCE((g->>'min_selections')::int, 0),
    COALESCE((g->>'max_selections')::int, 1),
    gord - 1
  FROM jsonb_array_elements(p_option_groups) WITH ORDINALITY AS t(g, gord);

  INSERT INTO options (option_group_id, restaurant_id, name, price_delta_cents, is_available, position)
  SELECT og.id, p_restaurant_id,
    o->>'name',
    COALESCE((o->>'price_delta_cents')::int, 0),
    COALESCE((o->>'is_available')::boolean, true),
    oord - 1
  FROM jsonb_array_elements(p_option_groups) WITH ORDINALITY AS t(g, gord)
  JOIN option_groups og
    ON og.product_id = v_product_id
   AND og.restaurant_id = p_restaurant_id
   AND og.position = gord - 1
  CROSS JOIN LATERAL jsonb_array_elements(g->'options') WITH ORDINALITY AS t2(o, oord);

  RETURN v_product_id;
END;
$$;

REVOKE ALL ON FUNCTION upsert_product(uuid, jsonb, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION upsert_product(uuid, jsonb, jsonb, jsonb) TO authenticated;
