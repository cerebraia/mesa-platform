-- ============================================================
-- Mesa Platform · Migración 023 — Planes comerciales
-- ============================================================
-- 1. Añade plan_code (slug estable) y allowed_roles a plans.
-- 2. Siembra los tres planes comerciales de forma idempotente.
--    ON CONFLICT actualiza nombre/precio/descripción; no toca
--    suscripciones ni condiciones históricas contratadas.
-- 3. Crea get_plan_usage: uso actual del restaurante (owner/attention/kitchen).
-- 4. Añade trigger check_member_limit_on_change en restaurant_members:
--    bloquea INSERT/UPDATE que activaría un miembro si se excede el cupo
--    o el rol no está permitido por el plan vigente.
-- 5. Reemplaza upsert_product (migración 007) para verificar el límite
--    de productos al crear uno nuevo; protegido con advisory lock por
--    restaurante para prevenir creaciones concurrentes que superen el límite.
--    La edición de productos existentes no está limitada.
--
-- Tratamiento del conteo de productos:
--   Se cuenta CADA FILA de la tabla products (restaurant_id = ?)
--   independientemente de is_published o is_available.
--   product_variants y option_groups son sub-entidades del producto y
--   NO consumen cupo adicional.
-- ============================================================

-- ── 1. Columnas nuevas en plans ──────────────────────────────

ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS plan_code    text,
  ADD COLUMN IF NOT EXISTS allowed_roles text[] DEFAULT NULL;

-- Restricción UNIQUE en plan_code (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'plans_plan_code_key' AND conrelid = 'plans'::regclass
  ) THEN
    ALTER TABLE plans ADD CONSTRAINT plans_plan_code_key UNIQUE (plan_code);
  END IF;
END$$;

-- ── 2. Planes comerciales vigentes ──────────────────────────
-- Idempotente: ON CONFLICT (plan_code) DO UPDATE actualiza
-- campos comerciales sin tocar registros existentes de suscripciones.

INSERT INTO plans (
  plan_code, name, description,
  price_cents, currency, max_products, max_members,
  allowed_roles, is_active, is_test
)
VALUES
  (
    'inicio',
    'Mesa Inicio',
    'Todo lo que necesitas para publicar tu menú y recibir pedidos.',
    1900, 'USD', 50, 1,
    ARRAY['owner'],
    true, false
  ),
  (
    'negocio',
    'Mesa Negocio',
    'Para equipos que necesitan más espacio y roles especializados.',
    3900, 'USD', 200, 5,
    ARRAY['owner','attention','kitchen'],
    true, false
  ),
  (
    'acompanado',
    'Mesa Acompañado',
    'Más capacidad y ayuda directa de nuestro equipo para tu catálogo.',
    6900, 'USD', 400, 10,
    ARRAY['owner','attention','kitchen'],
    true, false
  )
ON CONFLICT (plan_code) DO UPDATE
  SET name          = EXCLUDED.name,
      description   = EXCLUDED.description,
      price_cents   = EXCLUDED.price_cents,
      max_products  = EXCLUDED.max_products,
      max_members   = EXCLUDED.max_members,
      allowed_roles = EXCLUDED.allowed_roles,
      is_active     = EXCLUDED.is_active;

-- ── 3. get_plan_usage ─────────────────────────────────────────
-- Devuelve uso actual y límites del plan vigente.
-- Accesible a cualquier miembro activo del restaurante.

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

  -- Suscripción activa vigente
  SELECT jsonb_build_object(
    'product_count',        (SELECT COUNT(*)::int FROM products        WHERE restaurant_id = p_restaurant_id),
    'member_count',         (SELECT COUNT(*)::int FROM restaurant_members WHERE restaurant_id = p_restaurant_id AND status = 'active'),
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
    -- Sin suscripción activa: modo onboarding libre, sin límites
    SELECT jsonb_build_object(
      'product_count',        (SELECT COUNT(*)::int FROM products        WHERE restaurant_id = p_restaurant_id),
      'member_count',         (SELECT COUNT(*)::int FROM restaurant_members WHERE restaurant_id = p_restaurant_id AND status = 'active'),
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

-- ── 4. Trigger: límites de miembros ──────────────────────────
-- Dispara en BEFORE INSERT y BEFORE UPDATE en restaurant_members.
-- Sólo actúa cuando el resultado sería un miembro activo.
-- UPDATE de un ya-activo: solo verifica que el nuevo rol esté permitido.
-- Sin suscripción activa (onboarding): sin límites.

CREATE OR REPLACE FUNCTION check_member_limit_on_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_members  integer;
  v_allowed      text[];
  v_active_count integer;
  v_plan_name    text;
BEGIN
  -- Solo aplica cuando el resultado será un miembro activo
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;

  -- Obtener plan vigente del restaurante
  SELECT p.max_members, p.allowed_roles, p.name
  INTO v_max_members, v_allowed, v_plan_name
  FROM subscriptions s
  JOIN plans p ON p.id = s.plan_id
  WHERE s.restaurant_id = NEW.restaurant_id
    AND s.status = 'active'
    AND (s.ends_at IS NULL OR s.ends_at > now())
  ORDER BY s.starts_at DESC
  LIMIT 1;

  -- Sin suscripción activa = onboarding libre = sin límites
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Verificar que el rol esté permitido por el plan
  IF v_allowed IS NOT NULL AND NOT (NEW.role = ANY(v_allowed)) THEN
    RAISE EXCEPTION
      'El plan "%" no incluye el rol "%". Actualiza el plan para añadir roles de atención y cocina.',
      v_plan_name, NEW.role
      USING ERRCODE = 'check_violation', HINT = 'MEMBER_ROLE_NOT_ALLOWED';
  END IF;

  -- Si es UPDATE de un miembro ya activo, el conteo no aumenta; solo verificamos el rol (arriba).
  IF TG_OP = 'UPDATE' AND OLD.status = 'active' THEN
    RETURN NEW;
  END IF;

  -- Contar miembros activos actuales excluyendo el registro en curso (para UPDATE de reactivación)
  SELECT COUNT(*)
  INTO v_active_count
  FROM restaurant_members
  WHERE restaurant_id = NEW.restaurant_id
    AND status = 'active'
    AND id IS DISTINCT FROM NEW.id;

  IF v_max_members IS NOT NULL AND v_active_count >= v_max_members THEN
    RAISE EXCEPTION
      'El plan "%" permite hasta % usuario(s) activo(s). Ya hay %. Para añadir más usuarios, solicita un cambio de plan.',
      v_plan_name, v_max_members, v_active_count
      USING ERRCODE = 'check_violation', HINT = 'MEMBER_LIMIT_REACHED';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_member_limit ON restaurant_members;
CREATE TRIGGER trg_check_member_limit
  BEFORE INSERT OR UPDATE ON restaurant_members
  FOR EACH ROW EXECUTE FUNCTION check_member_limit_on_change();

-- ── 5. upsert_product actualizado ────────────────────────────
-- Reemplaza la definición de migración 007.
-- Añade verificación de límite de productos en creación nueva.
-- Advisory lock por restaurante previene race conditions cuando
-- dos peticiones concurrentes llegan con el último cupo disponible.
-- La edición de productos existentes nunca está limitada.

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
  v_id           uuid;
  v_group_id     uuid;
  v_grp          jsonb;
  v_opt          jsonb;
  v_pos          integer;
  v_category     uuid;
  v_product_id   uuid;
  v_is_new       boolean;
  v_max_products integer;
  v_count        integer;
BEGIN
  -- ── Autorización ──────────────────────────────────────────
  IF member_role(p_restaurant_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Solo los propietarios pueden modificar el catálogo'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_category   := (p_product->>'category_id')::uuid;
  v_product_id := NULLIF(NULLIF(p_product->>'id', ''), 'null')::uuid;

  -- ── Detectar si es producto nuevo ─────────────────────────
  IF v_product_id IS NULL THEN
    v_is_new := true;
  ELSE
    SELECT NOT EXISTS(
      SELECT 1 FROM products
      WHERE id = v_product_id AND restaurant_id = p_restaurant_id
    ) INTO v_is_new;
  END IF;

  -- ── Verificar límite de productos (solo en creación) ──────
  IF v_is_new THEN
    -- Advisory lock por restaurante: previene que dos transacciones
    -- concurrentes pasen ambas el check de conteo con el último cupo.
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

    -- Sin suscripción = onboarding libre = sin límite de productos
    IF FOUND AND v_max_products IS NOT NULL THEN
      SELECT COUNT(*) INTO v_count
      FROM products WHERE restaurant_id = p_restaurant_id;

      IF v_count >= v_max_products THEN
        RAISE EXCEPTION
          'Límite de productos: el plan permite hasta % y ya hay %. Para crear más, solicita un cambio de plan.',
          v_max_products, v_count
          USING ERRCODE = 'check_violation', HINT = 'PRODUCT_LIMIT_REACHED';
      END IF;
    END IF;
  END IF;

  -- ── Validar categoría ──────────────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM categories
    WHERE id = v_category AND restaurant_id = p_restaurant_id
  ) THEN
    RAISE EXCEPTION 'La categoría no pertenece a este restaurante'
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  -- ── Upsert del producto ────────────────────────────────────
  INSERT INTO products (
    id, restaurant_id, category_id, name, description,
    base_price_cents, promo_price_cents, is_available, is_published, position
  ) VALUES (
    COALESCE(v_product_id, gen_random_uuid()),
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

  -- ── Reemplazar variantes ───────────────────────────────────
  DELETE FROM product_variants WHERE product_id = v_id;

  v_pos := 0;
  FOR v_grp IN SELECT * FROM jsonb_array_elements(p_variants)
  LOOP
    INSERT INTO product_variants (
      restaurant_id, product_id, name, price_cents, is_available, position
    ) VALUES (
      p_restaurant_id, v_id,
      v_grp->>'name',
      (v_grp->>'price_cents')::integer,
      COALESCE((v_grp->>'is_available')::boolean, true),
      v_pos
    );
    v_pos := v_pos + 1;
  END LOOP;

  -- ── Reemplazar grupos de opciones ──────────────────────────
  DELETE FROM option_groups WHERE product_id = v_id;

  v_pos := 0;
  FOR v_grp IN SELECT * FROM jsonb_array_elements(p_option_groups)
  LOOP
    INSERT INTO option_groups (
      restaurant_id, product_id, name, min_selections, max_selections, position
    ) VALUES (
      p_restaurant_id, v_id,
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
          p_restaurant_id, v_group_id,
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
