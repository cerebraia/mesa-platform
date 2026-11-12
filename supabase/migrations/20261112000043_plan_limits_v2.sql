-- ============================================================
-- Mesa Platform · Migración 043 — plan_limits_v2
-- ============================================================
-- Contexto: migration 026 (product_image_fit) sobreescribió
-- upsert_product y eliminó accidentalmente el advisory lock y el
-- check de límite de migration 023. Esta migración los restaura
-- y amplía la protección a todos los caminos de creación.
--
-- Cambios:
--   1. upsert_product   — restaura advisory lock + límite;
--                         cuenta solo productos NO eliminados.
--   2. restore_product  — añade advisory lock + límite;
--                         al alcanzar el máximo bloquea la restauración.
--   3. restore_product_admin — variante service_role de restore_product.
--   4. upsert_product_admin  — variante service_role de upsert_product,
--                              para scripts de importación.
--   5. get_plan_usage   — corrige product_count (excluye eliminados).
--
-- Criterio de conteo:
--   Solo se cuentan filas con deleted_at IS NULL.
--   Productos en papelera no ocupan cupo; restaurarlos sí lo hace.
-- ============================================================

-- ── 1. upsert_product (versión definitiva) ───────────────────
-- Combina: advisory lock + límite (migration 023) +
--          image_fit (migration 026) + conteo sin eliminados.

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
  v_product_id   uuid;
  v_pos          int;
  v_is_new       boolean;
  v_max_products integer;
  v_count        integer;
BEGIN
  IF member_role(p_restaurant_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Solo los propietarios pueden modificar el catálogo'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Detectar si es producto nuevo o edición
  v_product_id := NULLIF(TRIM(COALESCE(p_product->>'id', '')), '')::uuid;

  IF v_product_id IS NULL THEN
    v_is_new := true;
  ELSE
    SELECT NOT EXISTS(
      SELECT 1 FROM products
      WHERE id = v_product_id AND restaurant_id = p_restaurant_id
    ) INTO v_is_new;
  END IF;

  -- ── Verificar límite solo en creación ────────────────────────
  IF v_is_new THEN
    -- Advisory lock por restaurante: serializa creaciones concurrentes
    PERFORM pg_advisory_xact_lock(
      hashtext('mesa:product_limit'),
      hashtext(p_restaurant_id::text)
    );

    SELECT p.max_products INTO v_max_products
    FROM subscriptions s
    JOIN plans p ON p.id = s.plan_id
    WHERE s.restaurant_id = p_restaurant_id
      AND s.status = 'active'
      AND (s.ends_at IS NULL OR s.ends_at > now())
    ORDER BY s.starts_at DESC
    LIMIT 1;

    IF FOUND AND v_max_products IS NOT NULL THEN
      SELECT COUNT(*) INTO v_count
      FROM products
      WHERE restaurant_id = p_restaurant_id
        AND deleted_at IS NULL;

      IF v_count >= v_max_products THEN
        RAISE EXCEPTION
          'Límite de productos: el plan permite hasta % y ya hay %. Para crear más, solicita un cambio de plan.',
          v_max_products, v_count
          USING ERRCODE = 'check_violation', HINT = 'PRODUCT_LIMIT_REACHED';
      END IF;
    END IF;
  END IF;

  -- ── Upsert del producto ──────────────────────────────────────
  IF v_product_id IS NOT NULL THEN
    UPDATE products SET
      category_id       = (p_product->>'category_id')::uuid,
      name              = p_product->>'name',
      description       = NULLIF(p_product->>'description', ''),
      base_price_cents  = NULLIF(p_product->>'base_price_cents', '')::int,
      promo_price_cents = NULLIF(p_product->>'promo_price_cents', '')::int,
      is_available      = COALESCE((p_product->>'is_available')::boolean, true),
      is_published      = COALESCE((p_product->>'is_published')::boolean, false),
      position          = COALESCE((p_product->>'position')::int, 0),
      image_fit         = NULLIF(p_product->>'image_fit', ''),
      updated_at        = now()
    WHERE id = v_product_id
      AND restaurant_id = p_restaurant_id
    RETURNING id INTO v_product_id;

    IF v_product_id IS NULL THEN
      RAISE EXCEPTION 'Producto no encontrado o no pertenece a este restaurante'
        USING ERRCODE = 'no_data_found';
    END IF;
  ELSE
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
      NULLIF(p_product->>'base_price_cents', '')::int,
      NULLIF(p_product->>'promo_price_cents', '')::int,
      COALESCE((p_product->>'is_available')::boolean, true),
      COALESCE((p_product->>'is_published')::boolean, false),
      COALESCE((p_product->>'position')::int, v_pos),
      NULLIF(p_product->>'image_fit', '')
    )
    RETURNING id INTO v_product_id;
  END IF;

  -- ── Variantes ────────────────────────────────────────────────
  DELETE FROM product_variants WHERE product_id = v_product_id AND restaurant_id = p_restaurant_id;
  INSERT INTO product_variants (product_id, restaurant_id, name, price_cents, is_available, position)
  SELECT v_product_id, p_restaurant_id,
    v->>'name',
    (v->>'price_cents')::int,
    COALESCE((v->>'is_available')::boolean, true),
    ordinality - 1
  FROM jsonb_array_elements(p_variants) WITH ORDINALITY AS t(v, ordinality);

  -- ── Grupos de opciones + opciones ────────────────────────────
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

-- ── 2. restore_product (versión con límite) ──────────────────
-- Los productos eliminados no ocupan cupo; restaurarlos sí lo hace.
-- Usa el mismo advisory lock que upsert_product para serializar.

CREATE OR REPLACE FUNCTION restore_product(
  p_restaurant_id uuid,
  p_product_id    uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_products integer;
  v_count        integer;
BEGIN
  IF member_role(p_restaurant_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Solo el propietario puede restaurar productos'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext('mesa:product_limit'),
    hashtext(p_restaurant_id::text)
  );

  SELECT p.max_products INTO v_max_products
  FROM subscriptions s
  JOIN plans p ON p.id = s.plan_id
  WHERE s.restaurant_id = p_restaurant_id
    AND s.status = 'active'
    AND (s.ends_at IS NULL OR s.ends_at > now())
  ORDER BY s.starts_at DESC
  LIMIT 1;

  IF FOUND AND v_max_products IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count
    FROM products
    WHERE restaurant_id = p_restaurant_id
      AND deleted_at IS NULL;

    IF v_count >= v_max_products THEN
      RAISE EXCEPTION
        'Límite de productos: el plan permite hasta % y ya tienes % activos. Elimina o borra un producto antes de restaurar.',
        v_max_products, v_count
        USING ERRCODE = 'check_violation', HINT = 'PRODUCT_LIMIT_REACHED';
    END IF;
  END IF;

  UPDATE products
  SET
    deleted_at   = NULL,
    deleted_by   = NULL,
    is_published = false,
    updated_at   = now()
  WHERE id            = p_product_id
    AND restaurant_id = p_restaurant_id
    AND deleted_at IS NOT NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Producto no encontrado o no estaba eliminado'
      USING ERRCODE = 'no_data_found';
  END IF;
END;
$$;

-- restore_product solo necesita authenticated (el owner llama desde el panel)
REVOKE ALL ON FUNCTION restore_product(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION restore_product(uuid, uuid) TO authenticated;

-- ── 3. restore_product_admin (variante service_role) ─────────
-- Para el panel de administración: misma lógica de límite sin
-- verificar member_role (el caller ya es platform_admin).

CREATE OR REPLACE FUNCTION restore_product_admin(
  p_restaurant_id uuid,
  p_product_id    uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_products integer;
  v_count        integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM restaurants
    WHERE id = p_restaurant_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Restaurante no encontrado'
      USING ERRCODE = 'no_data_found';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext('mesa:product_limit'),
    hashtext(p_restaurant_id::text)
  );

  SELECT p.max_products INTO v_max_products
  FROM subscriptions s
  JOIN plans p ON p.id = s.plan_id
  WHERE s.restaurant_id = p_restaurant_id
    AND s.status = 'active'
    AND (s.ends_at IS NULL OR s.ends_at > now())
  ORDER BY s.starts_at DESC
  LIMIT 1;

  IF FOUND AND v_max_products IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count
    FROM products
    WHERE restaurant_id = p_restaurant_id
      AND deleted_at IS NULL;

    IF v_count >= v_max_products THEN
      RAISE EXCEPTION
        'Límite de productos: el plan permite hasta % y ya hay % activos.',
        v_max_products, v_count
        USING ERRCODE = 'check_violation', HINT = 'PRODUCT_LIMIT_REACHED';
    END IF;
  END IF;

  UPDATE products
  SET
    deleted_at   = NULL,
    deleted_by   = NULL,
    is_published = false,
    updated_at   = now()
  WHERE id            = p_product_id
    AND restaurant_id = p_restaurant_id
    AND deleted_at IS NOT NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Producto no encontrado o no estaba eliminado'
      USING ERRCODE = 'no_data_found';
  END IF;
END;
$$;

REVOKE ALL     ON FUNCTION restore_product_admin(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION restore_product_admin(uuid, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION restore_product_admin(uuid, uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION restore_product_admin(uuid, uuid) TO service_role;

-- ── 4. upsert_product_admin (variante service_role) ──────────
-- Para scripts de importación: misma lógica de límite + advisory lock
-- sin verificar member_role. Solo accesible con service_role.

CREATE OR REPLACE FUNCTION upsert_product_admin(
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
  v_product_id   uuid;
  v_pos          int;
  v_is_new       boolean;
  v_max_products integer;
  v_count        integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM restaurants
    WHERE id = p_restaurant_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Restaurante no encontrado'
      USING ERRCODE = 'no_data_found';
  END IF;

  v_product_id := NULLIF(TRIM(COALESCE(p_product->>'id', '')), '')::uuid;

  IF v_product_id IS NULL THEN
    v_is_new := true;
  ELSE
    SELECT NOT EXISTS(
      SELECT 1 FROM products
      WHERE id = v_product_id AND restaurant_id = p_restaurant_id
    ) INTO v_is_new;
  END IF;

  IF v_is_new THEN
    PERFORM pg_advisory_xact_lock(
      hashtext('mesa:product_limit'),
      hashtext(p_restaurant_id::text)
    );

    SELECT p.max_products INTO v_max_products
    FROM subscriptions s
    JOIN plans p ON p.id = s.plan_id
    WHERE s.restaurant_id = p_restaurant_id
      AND s.status = 'active'
      AND (s.ends_at IS NULL OR s.ends_at > now())
    ORDER BY s.starts_at DESC
    LIMIT 1;

    IF FOUND AND v_max_products IS NOT NULL THEN
      SELECT COUNT(*) INTO v_count
      FROM products
      WHERE restaurant_id = p_restaurant_id
        AND deleted_at IS NULL;

      IF v_count >= v_max_products THEN
        RAISE EXCEPTION
          'Límite de productos (import): el plan permite hasta % y ya hay % activos. Solicita un cambio de plan.',
          v_max_products, v_count
          USING ERRCODE = 'check_violation', HINT = 'PRODUCT_LIMIT_REACHED';
      END IF;
    END IF;
  END IF;

  IF v_product_id IS NOT NULL THEN
    UPDATE products SET
      category_id       = (p_product->>'category_id')::uuid,
      name              = p_product->>'name',
      description       = NULLIF(p_product->>'description', ''),
      base_price_cents  = NULLIF(p_product->>'base_price_cents', '')::int,
      promo_price_cents = NULLIF(p_product->>'promo_price_cents', '')::int,
      is_available      = COALESCE((p_product->>'is_available')::boolean, true),
      is_published      = COALESCE((p_product->>'is_published')::boolean, false),
      position          = COALESCE((p_product->>'position')::int, 0),
      image_fit         = NULLIF(p_product->>'image_fit', ''),
      updated_at        = now()
    WHERE id = v_product_id
      AND restaurant_id = p_restaurant_id
    RETURNING id INTO v_product_id;

    IF v_product_id IS NULL THEN
      RAISE EXCEPTION 'Producto no encontrado o no pertenece a este restaurante'
        USING ERRCODE = 'no_data_found';
    END IF;
  ELSE
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
      NULLIF(p_product->>'base_price_cents', '')::int,
      NULLIF(p_product->>'promo_price_cents', '')::int,
      COALESCE((p_product->>'is_available')::boolean, true),
      COALESCE((p_product->>'is_published')::boolean, false),
      COALESCE((p_product->>'position')::int, v_pos),
      NULLIF(p_product->>'image_fit', '')
    )
    RETURNING id INTO v_product_id;
  END IF;

  DELETE FROM product_variants WHERE product_id = v_product_id AND restaurant_id = p_restaurant_id;
  INSERT INTO product_variants (product_id, restaurant_id, name, price_cents, is_available, position)
  SELECT v_product_id, p_restaurant_id,
    v->>'name',
    (v->>'price_cents')::int,
    COALESCE((v->>'is_available')::boolean, true),
    ordinality - 1
  FROM jsonb_array_elements(p_variants) WITH ORDINALITY AS t(v, ordinality);

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

REVOKE ALL     ON FUNCTION upsert_product_admin(uuid, jsonb, jsonb, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION upsert_product_admin(uuid, jsonb, jsonb, jsonb) FROM authenticated;
REVOKE EXECUTE ON FUNCTION upsert_product_admin(uuid, jsonb, jsonb, jsonb) FROM anon;
GRANT  EXECUTE ON FUNCTION upsert_product_admin(uuid, jsonb, jsonb, jsonb) TO service_role;

-- ── 5. get_plan_usage — corregir conteo de productos ─────────
-- Excluye productos con deleted_at IS NOT NULL del conteo.

CREATE OR REPLACE FUNCTION get_plan_usage(p_restaurant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role   text;
  v_result jsonb;
BEGIN
  v_role := member_role(p_restaurant_id);
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Sin acceso a este restaurante'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT jsonb_build_object(
    'product_count',        (SELECT COUNT(*)::int FROM products
                             WHERE restaurant_id = p_restaurant_id
                               AND deleted_at IS NULL),
    'member_count',         (SELECT COUNT(*)::int FROM restaurant_members
                             WHERE restaurant_id = p_restaurant_id AND status = 'active'),
    'plan_code',            p.plan_code,
    'plan_name',            p.name,
    'max_products',         p.max_products,
    'max_members',          p.max_members,
    'price_cents',          p.price_cents,
    'currency',             p.currency,
    'subscription_status',  s.status,
    'subscription_ends_at', s.ends_at
  )
  INTO v_result
  FROM subscriptions s
  JOIN plans p ON p.id = s.plan_id
  WHERE s.restaurant_id = p_restaurant_id
    AND s.status = 'active'
    AND (s.ends_at IS NULL OR s.ends_at > now())
  ORDER BY s.starts_at DESC
  LIMIT 1;

  IF v_result IS NULL THEN
    SELECT jsonb_build_object(
      'product_count',        (SELECT COUNT(*)::int FROM products
                               WHERE restaurant_id = p_restaurant_id
                                 AND deleted_at IS NULL),
      'member_count',         (SELECT COUNT(*)::int FROM restaurant_members
                               WHERE restaurant_id = p_restaurant_id AND status = 'active'),
      'plan_code',            NULL,
      'plan_name',            NULL,
      'max_products',         NULL,
      'max_members',          NULL,
      'price_cents',          NULL,
      'currency',             NULL,
      'subscription_status',  NULL,
      'subscription_ends_at', NULL
    ) INTO v_result;
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION get_plan_usage(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_plan_usage(uuid) TO authenticated;
