-- ============================================================
-- Mesa Platform · Migración 007 — RPC para guardado atómico
-- ============================================================
-- upsert_product: guarda producto, variantes y grupos de opciones
-- en una sola transacción. Idempontente: usa ON CONFLICT en el
-- producto y delete+reinsert para variantes y grupos.
--
-- Requiere que el llamante sea owner del restaurante.
-- SECURITY DEFINER para poder validar la pertenencia de la
-- categoría sin que RLS interfiera en la verificación interna.
-- auth.uid() sigue reflejando el usuario que llama.
-- ============================================================

CREATE OR REPLACE FUNCTION upsert_product(
  p_restaurant_id uuid,
  p_product       jsonb,
  p_variants      jsonb DEFAULT '[]'::jsonb,
  p_option_groups jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id         uuid;
  v_group_id   uuid;
  v_grp        jsonb;
  v_opt        jsonb;
  v_pos        integer;
  v_category   uuid;
BEGIN
  -- ── Autorización ───────────────────────────────────────────
  IF member_role(p_restaurant_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Solo los propietarios pueden modificar el catálogo'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_category := (p_product->>'category_id')::uuid;

  -- ── Validar que la categoría pertenece al mismo restaurante ─
  IF NOT EXISTS (
    SELECT 1 FROM categories
    WHERE id = v_category AND restaurant_id = p_restaurant_id
  ) THEN
    RAISE EXCEPTION 'La categoría no pertenece a este restaurante'
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  -- ── Upsert del producto ─────────────────────────────────────
  INSERT INTO products (
    id,
    restaurant_id,
    category_id,
    name,
    description,
    base_price_cents,
    promo_price_cents,
    is_available,
    is_published,
    position
  ) VALUES (
    COALESCE(NULLIF(p_product->>'id', '')::uuid, gen_random_uuid()),
    p_restaurant_id,
    v_category,
    p_product->>'name',
    NULLIF(p_product->>'description', ''),
    (p_product->>'base_price_cents')::integer,
    NULLIF(p_product->>'promo_price_cents', '')::integer,
    COALESCE((p_product->>'is_available')::boolean, true),
    COALESCE((p_product->>'is_published')::boolean, false),
    COALESCE((p_product->>'position')::integer, 0)
  )
  ON CONFLICT (id) DO UPDATE SET
    category_id       = EXCLUDED.category_id,
    name              = EXCLUDED.name,
    description       = EXCLUDED.description,
    base_price_cents  = EXCLUDED.base_price_cents,
    promo_price_cents = EXCLUDED.promo_price_cents,
    is_available      = EXCLUDED.is_available,
    is_published      = EXCLUDED.is_published,
    position          = EXCLUDED.position,
    updated_at        = now()
  RETURNING id INTO v_id;

  -- ── Reemplazar variantes ────────────────────────────────────
  -- Delete+reinsert es idempotente: reintentar produce el mismo resultado.
  DELETE FROM product_variants WHERE product_id = v_id;

  v_pos := 0;
  FOR v_grp IN SELECT * FROM jsonb_array_elements(p_variants)
  LOOP
    INSERT INTO product_variants (
      restaurant_id, product_id, name, price_cents, is_available, position
    ) VALUES (
      p_restaurant_id,
      v_id,
      v_grp->>'name',
      (v_grp->>'price_cents')::integer,
      COALESCE((v_grp->>'is_available')::boolean, true),
      v_pos
    );
    v_pos := v_pos + 1;
  END LOOP;

  -- ── Reemplazar grupos de opciones y sus opciones ────────────
  -- ON DELETE CASCADE en options elimina las opciones al borrar el grupo.
  DELETE FROM option_groups WHERE product_id = v_id;

  v_pos := 0;
  FOR v_grp IN SELECT * FROM jsonb_array_elements(p_option_groups)
  LOOP
    INSERT INTO option_groups (
      restaurant_id, product_id, name, min_selections, max_selections, position
    ) VALUES (
      p_restaurant_id,
      v_id,
      v_grp->>'name',
      COALESCE((v_grp->>'min_selections')::integer, 0),
      COALESCE((v_grp->>'max_selections')::integer, 1),
      v_pos
    )
    RETURNING id INTO v_group_id;

    DECLARE opt_pos integer := 0;
    BEGIN
      FOR v_opt IN SELECT * FROM jsonb_array_elements(COALESCE(v_grp->'options', '[]'::jsonb))
      LOOP
        INSERT INTO options (
          restaurant_id, option_group_id, name, price_delta_cents, is_available, position
        ) VALUES (
          p_restaurant_id,
          v_group_id,
          v_opt->>'name',
          COALESCE((v_opt->>'price_delta_cents')::integer, 0),
          COALESCE((v_opt->>'is_available')::boolean, true),
          opt_pos
        );
        opt_pos := opt_pos + 1;
      END LOOP;
    END;

    v_pos := v_pos + 1;
  END LOOP;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION upsert_product(uuid, jsonb, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION upsert_product(uuid, jsonb, jsonb, jsonb) TO authenticated;

-- ── publish_product / unpublish_product ──────────────────────
-- Cambiar estado de publicación sin tocar el formulario completo.

CREATE OR REPLACE FUNCTION set_product_published(
  p_restaurant_id uuid,
  p_product_id    uuid,
  p_published     boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF member_role(p_restaurant_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Solo los propietarios pueden publicar productos'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE products
  SET is_published = p_published, updated_at = now()
  WHERE id = p_product_id AND restaurant_id = p_restaurant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Producto no encontrado'
      USING ERRCODE = 'no_data_found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION set_product_published(uuid, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_product_published(uuid, uuid, boolean) TO authenticated;

-- ── archive_category ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_category_active(
  p_restaurant_id uuid,
  p_category_id   uuid,
  p_active        boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF member_role(p_restaurant_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Solo los propietarios pueden modificar categorías'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE categories
  SET is_active = p_active, updated_at = now()
  WHERE id = p_category_id AND restaurant_id = p_restaurant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Categoría no encontrada'
      USING ERRCODE = 'no_data_found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION set_category_active(uuid, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_category_active(uuid, uuid, boolean) TO authenticated;
