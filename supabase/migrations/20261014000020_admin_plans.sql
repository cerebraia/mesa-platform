-- ============================================================
-- Mesa Platform · Migración 020 — Planes y suscripciones
-- ============================================================
-- Cambios:
--
-- 1. advance_order_status: requiere p_expected_status no nulo
--    para transiciones no idempotentes (evita actualizaciones
--    "ciegas" desde UI potencialmente desactualizada).
--
-- 2. confirm_order_payment: requiere p_expected_payment_status
--    no nulo para confirmaciones no idempotentes.
--
-- 3. is_restaurant_open: devuelve false si el restaurante no
--    tiene status = 'active', además del NOT FOUND original.
--
-- 4. Nuevas tablas: plans, subscriptions, subscription_payments,
--    admin_audit_log.
--
-- 5. RLS para las nuevas tablas.
--
-- 6. place_order: verifica suscripción del restaurante. Solo
--    bloquea si el restaurante tiene suscripciones registradas
--    pero ninguna está vigente (modo "onboarding libre" sigue
--    funcionando sin suscripción).
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- 1. advance_order_status — v3
-- ════════════════════════════════════════════════════════════
-- Único cambio respecto a v2 (migración 019):
--   Después del bloque de idempotencia, se exige que
--   p_expected_status sea no nulo. Las llamadas idempotentes
--   (estado actual = estado destino) siguen funcionando con
--   p_expected_status = NULL porque retornan antes de este check.
-- ════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS advance_order_status(uuid, uuid, text, text, text);

CREATE OR REPLACE FUNCTION advance_order_status(
  p_order_id        uuid,
  p_restaurant_id   uuid,
  p_new_status      text,
  p_note            text DEFAULT NULL,
  p_expected_status text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role           text;
  v_current_status text;
  v_modality       text;
  v_valid          boolean;
BEGIN
  -- ── 1. Verificar membresía ────────────────────────────────
  v_role := member_role(p_restaurant_id);
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Acceso denegado: sin membresía activa'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- ── 2. Bloqueo de fila — serializa operaciones concurrentes
  SELECT status, modality
  INTO v_current_status, v_modality
  FROM orders
  WHERE id = p_order_id AND restaurant_id = p_restaurant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido no encontrado'
      USING ERRCODE = 'no_data_found';
  END IF;

  -- ── 3. Idempotencia: ya está en el estado destino ─────────
  -- Cubre el caso de doble-clic o reintento tras respuesta perdida.
  -- No crea un evento adicional en el historial.
  -- Retorna antes del check de p_expected_status: los reintentos
  -- idempotentes no necesitan enviar el estado esperado.
  IF v_current_status = p_new_status THEN
    RETURN jsonb_build_object(
      'success',        true,
      'conflict',       false,
      'idempotent',     true,
      'current_status', v_current_status
    );
  END IF;

  -- ── 4. Requiere estado esperado para transiciones reales ──
  -- Solo llega aquí cuando el estado actual ≠ estado destino,
  -- por lo que cualquier llamada que omita p_expected_status es
  -- una actualización ciega y se rechaza.
  IF p_expected_status IS NULL THEN
    RAISE EXCEPTION 'Se requiere el estado esperado del pedido (p_expected_status)'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- ── 5. Conflicto: estado actual ≠ estado esperado ─────────
  -- El empleado abrió el pedido cuando estaba en p_expected_status,
  -- pero otro operador lo cambió antes de que llegara esta acción.
  IF v_current_status != p_expected_status THEN
    RETURN jsonb_build_object(
      'success',        false,
      'conflict',       true,
      'idempotent',     false,
      'current_status', v_current_status,
      'message',        'El estado del pedido cambió. Actualiza la vista antes de continuar.'
    );
  END IF;

  -- ── 6. Verificar estado terminal ─────────────────────────
  IF v_current_status IN ('completed', 'rejected', 'cancelled') THEN
    RAISE EXCEPTION 'El pedido está en un estado terminal (%) y no puede avanzar',
      v_current_status
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- ── 7. Cancelación (solo owner, requiere nota) ────────────
  IF p_new_status = 'cancelled' THEN
    IF v_role != 'owner' THEN
      RAISE EXCEPTION 'Solo el propietario puede cancelar pedidos'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF p_note IS NULL OR char_length(trim(p_note)) < 3 THEN
      RAISE EXCEPTION 'La cancelación requiere un motivo (mínimo 3 caracteres)'
        USING ERRCODE = 'invalid_parameter_value';
    END IF;
    v_valid := true;

  ELSIF p_new_status = 'rejected' THEN
    IF v_current_status != 'received' THEN
      RAISE EXCEPTION 'Solo se puede rechazar un pedido en estado "recibido"'
        USING ERRCODE = 'invalid_parameter_value';
    END IF;
    IF p_note IS NULL OR char_length(trim(p_note)) < 3 THEN
      RAISE EXCEPTION 'El rechazo requiere un motivo (mínimo 3 caracteres)'
        USING ERRCODE = 'invalid_parameter_value';
    END IF;
    IF v_role NOT IN ('owner', 'attention') THEN
      RAISE EXCEPTION 'Solo owner y atención pueden rechazar pedidos'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    v_valid := true;

  ELSE
    -- ── 8. Validar transición por rol y estado ────────────────
    v_valid := CASE
      WHEN v_current_status = 'received'   AND p_new_status = 'accepted'
        THEN v_role IN ('owner', 'attention')
      WHEN v_current_status = 'accepted'   AND p_new_status = 'preparing'
        THEN v_role IN ('owner', 'attention', 'kitchen')
      WHEN v_current_status = 'preparing'  AND p_new_status = 'ready'
        THEN v_role IN ('owner', 'attention', 'kitchen')
      WHEN v_current_status = 'ready'      AND p_new_status = 'completed'
        THEN v_role IN ('owner', 'attention') AND v_modality = 'pickup'
      WHEN v_current_status = 'ready'      AND p_new_status = 'on_the_way'
        THEN v_role IN ('owner', 'attention') AND v_modality = 'delivery'
      WHEN v_current_status = 'on_the_way' AND p_new_status = 'completed'
        THEN v_role IN ('owner', 'attention')
      ELSE false
    END;
  END IF;

  IF NOT COALESCE(v_valid, false) THEN
    RAISE EXCEPTION 'Transición no permitida: "%" → "%" (rol: %)',
      v_current_status, p_new_status, v_role
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- ── 9. Actualizar estado ──────────────────────────────────
  UPDATE orders
  SET status = p_new_status, updated_at = now()
  WHERE id = p_order_id AND restaurant_id = p_restaurant_id;

  -- ── 10. Registrar evento (historial inmutable) ────────────
  INSERT INTO order_status_events (order_id, restaurant_id, status, note, created_by)
  VALUES (p_order_id, p_restaurant_id, p_new_status, p_note, auth.uid());

  RETURN jsonb_build_object(
    'success',        true,
    'conflict',       false,
    'idempotent',     false,
    'current_status', p_new_status
  );
END;
$$;

REVOKE ALL ON FUNCTION advance_order_status(uuid, uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION advance_order_status(uuid, uuid, text, text, text) TO authenticated;


-- ════════════════════════════════════════════════════════════
-- 2. confirm_order_payment — v3
-- ════════════════════════════════════════════════════════════
-- Único cambio respecto a v2 (migración 019):
--   Después del bloque de idempotencia, se exige que
--   p_expected_payment_status sea no nulo. Las llamadas
--   idempotentes retornan antes de este check.
-- ════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS confirm_order_payment(uuid, uuid, boolean, text, text);

CREATE OR REPLACE FUNCTION confirm_order_payment(
  p_order_id                uuid,
  p_restaurant_id           uuid,
  p_confirmed               boolean,
  p_note                    text    DEFAULT NULL,
  p_expected_payment_status text    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role                   text;
  v_current_payment_status text;
  v_order_status           text;
  v_target_status          text;
BEGIN
  v_role := member_role(p_restaurant_id);
  IF v_role NOT IN ('owner', 'attention') THEN
    RAISE EXCEPTION 'Solo owner y atención pueden gestionar el estado del pago'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT payment_status, status
  INTO v_current_payment_status, v_order_status
  FROM orders
  WHERE id = p_order_id AND restaurant_id = p_restaurant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido no encontrado'
      USING ERRCODE = 'no_data_found';
  END IF;

  IF v_order_status IN ('cancelled', 'rejected') THEN
    RAISE EXCEPTION 'No se puede modificar el pago de un pedido cancelado o rechazado'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  v_target_status := CASE WHEN p_confirmed THEN 'confirmed' ELSE 'pending' END;

  -- ── Idempotencia: ya está en el estado destino ────────────
  -- Retorna antes del check de p_expected_payment_status: los
  -- reintentos idempotentes no necesitan enviar el estado esperado.
  IF v_current_payment_status = v_target_status THEN
    RETURN jsonb_build_object(
      'success',        true,
      'conflict',       false,
      'idempotent',     true,
      'payment_status', v_current_payment_status
    );
  END IF;

  -- ── Requiere estado esperado para confirmaciones reales ───
  -- Solo llega aquí cuando el estado actual ≠ estado destino.
  IF p_expected_payment_status IS NULL THEN
    RAISE EXCEPTION 'Se requiere el estado de pago esperado (p_expected_payment_status)'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- ── Conflicto: estado actual ≠ esperado ───────────────────
  IF v_current_payment_status != p_expected_payment_status THEN
    RETURN jsonb_build_object(
      'success',        false,
      'conflict',       true,
      'idempotent',     false,
      'payment_status', v_current_payment_status,
      'message',        'El estado del pago cambió. Actualiza la vista.'
    );
  END IF;

  -- Revertir pago confirmado: solo owner, con motivo
  IF v_current_payment_status = 'confirmed' AND NOT p_confirmed THEN
    IF v_role != 'owner' THEN
      RAISE EXCEPTION 'Solo el propietario puede corregir un pago ya confirmado'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF p_note IS NULL OR char_length(trim(p_note)) < 3 THEN
      RAISE EXCEPTION 'Corregir un pago confirmado requiere un motivo (mínimo 3 caracteres)'
        USING ERRCODE = 'invalid_parameter_value';
    END IF;
  END IF;

  UPDATE orders
  SET payment_status = v_target_status, updated_at = now()
  WHERE id = p_order_id AND restaurant_id = p_restaurant_id;

  INSERT INTO order_status_events (order_id, restaurant_id, status, note, created_by)
  VALUES (p_order_id, p_restaurant_id, 'payment_' || v_target_status, p_note, auth.uid());

  RETURN jsonb_build_object(
    'success',        true,
    'conflict',       false,
    'idempotent',     false,
    'payment_status', v_target_status
  );
END;
$$;

REVOKE ALL ON FUNCTION confirm_order_payment(uuid, uuid, boolean, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION confirm_order_payment(uuid, uuid, boolean, text, text) TO authenticated;


-- ════════════════════════════════════════════════════════════
-- 3. is_restaurant_open — devuelve false si el restaurante
--    no está en status 'active'
-- ════════════════════════════════════════════════════════════
-- Cambio respecto a migración 013:
--   Se lee también r.status en el SELECT inicial y se añade un
--   check inmediatamente después de NOT FOUND: si el restaurante
--   existe pero no está activo, la función retorna false sin
--   consultar horarios ni configuración temporal.
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION is_restaurant_open(p_restaurant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant_status text;
  v_tz                text;
  v_is_closed         boolean;
  v_now_local         time;
  v_day               smallint;
  v_open              boolean;
BEGIN
  -- Get restaurant status, timezone and manual closure
  SELECT
    r.status,
    r.timezone,
    COALESCE(rc.is_temporarily_closed, false)
  INTO v_restaurant_status, v_tz, v_is_closed
  FROM restaurants r
  LEFT JOIN restaurant_config rc ON rc.restaurant_id = r.id
  WHERE r.id = p_restaurant_id;

  IF NOT FOUND THEN RETURN false; END IF;

  -- Restaurante no activo (onboarding, suspended, etc.)
  IF v_restaurant_status <> 'active' THEN RETURN false; END IF;

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


-- ════════════════════════════════════════════════════════════
-- 4. Nuevas tablas
-- ════════════════════════════════════════════════════════════

-- ── plans ─────────────────────────────────────────────────────
-- Catálogo de planes de suscripción. Solo admins pueden verlos y
-- gestionarlos. is_test = true marca planes que nunca se muestran
-- públicamente.
CREATE TABLE plans (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text        NOT NULL CHECK (char_length(name) BETWEEN 2 AND 100),
  description   text        CHECK (char_length(description) <= 500),
  price_cents   integer     NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  currency      text        NOT NULL DEFAULT 'USD' CHECK (char_length(currency) = 3),
  max_products  integer     CHECK (max_products > 0),
  max_members   integer     CHECK (max_members > 0),
  is_active     boolean     NOT NULL DEFAULT true,
  is_test       boolean     NOT NULL DEFAULT false,   -- test plans never shown publicly
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ── subscriptions ─────────────────────────────────────────────
-- Una suscripción vigente por restaurante determina qué puede hacer
-- el negocio. ends_at = NULL significa vigencia indefinida.
CREATE TABLE subscriptions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid        NOT NULL REFERENCES restaurants(id),
  plan_id       uuid        NOT NULL REFERENCES plans(id),
  status        text        NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'expired', 'cancelled')),
  starts_at     timestamptz NOT NULL DEFAULT now(),
  ends_at       timestamptz,                       -- NULL = indefinite
  notes         text        CHECK (char_length(notes) <= 500),
  created_by    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX subscriptions_restaurant_idx ON subscriptions (restaurant_id);
CREATE INDEX subscriptions_active_idx ON subscriptions (restaurant_id)
  WHERE status = 'active';

-- updated_at trigger usando la función set_updated_at() existente
CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── subscription_payments ─────────────────────────────────────
-- Registro de pagos manuales aplicados a una suscripción.
-- Solo admins crean registros; owners del restaurante pueden verlos.
CREATE TABLE subscription_payments (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid        NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  restaurant_id   uuid        NOT NULL REFERENCES restaurants(id),
  amount_cents    integer     NOT NULL CHECK (amount_cents > 0),
  currency        text        NOT NULL DEFAULT 'USD' CHECK (char_length(currency) = 3),
  paid_at         timestamptz NOT NULL,
  reference       text        CHECK (char_length(reference) <= 200),
  notes           text        CHECK (char_length(notes) <= 500),
  recorded_by     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX subscription_payments_sub_idx ON subscription_payments (subscription_id);
CREATE INDEX subscription_payments_restaurant_idx ON subscription_payments (restaurant_id);

-- ── admin_audit_log ───────────────────────────────────────────
-- Log de acciones administrativas. Solo service role escribe;
-- platform_admin puede leer. Sin UPDATE ni DELETE policies:
-- el registro es inmutable desde la aplicación.
CREATE TABLE admin_audit_log (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  action        text        NOT NULL CHECK (char_length(action) BETWEEN 1 AND 100),
  target_type   text        NOT NULL CHECK (target_type IN ('restaurant','subscription','payment','member','plan','system')),
  target_id     uuid,
  details       jsonb,      -- no secrets; action context only
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX admin_audit_log_time_idx ON admin_audit_log (created_at DESC);
CREATE INDEX admin_audit_log_target_idx ON admin_audit_log (target_type, target_id);


-- ════════════════════════════════════════════════════════════
-- 5. RLS para las nuevas tablas
-- ════════════════════════════════════════════════════════════

-- ── plans ─────────────────────────────────────────────────────
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

-- Supabase concede ALL a anon por defecto; revocarlo explícitamente.
REVOKE ALL ON plans FROM anon;
GRANT SELECT, INSERT, UPDATE ON plans TO authenticated;

CREATE POLICY plans_select ON plans
  FOR SELECT TO authenticated
  USING (is_platform_admin());

CREATE POLICY plans_insert ON plans
  FOR INSERT TO authenticated
  WITH CHECK (is_platform_admin());

CREATE POLICY plans_update ON plans
  FOR UPDATE TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- ── subscriptions ─────────────────────────────────────────────
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON subscriptions FROM anon;
GRANT SELECT, INSERT, UPDATE ON subscriptions TO authenticated;

-- Admins ven todo; owners ven solo sus propias suscripciones.
CREATE POLICY subscriptions_select ON subscriptions
  FOR SELECT TO authenticated
  USING (
    is_platform_admin()
    OR member_role(restaurant_id) = 'owner'
  );

CREATE POLICY subscriptions_insert ON subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (is_platform_admin());

CREATE POLICY subscriptions_update ON subscriptions
  FOR UPDATE TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- ── subscription_payments ─────────────────────────────────────
ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON subscription_payments FROM anon;
GRANT SELECT, INSERT ON subscription_payments TO authenticated;

CREATE POLICY subscription_payments_select ON subscription_payments
  FOR SELECT TO authenticated
  USING (
    is_platform_admin()
    OR member_role(restaurant_id) = 'owner'
  );

CREATE POLICY subscription_payments_insert ON subscription_payments
  FOR INSERT TO authenticated
  WITH CHECK (is_platform_admin());

-- ── admin_audit_log ───────────────────────────────────────────
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON admin_audit_log FROM anon;
-- Sin acceso directo para authenticated; solo service role escribe.
-- Se otorga SELECT únicamente para que platform_admin pueda leer
-- mediante el cliente supabase con JWT de admin.
REVOKE ALL ON admin_audit_log FROM authenticated;
GRANT SELECT ON admin_audit_log TO authenticated;

-- Solo lectura para platform_admin; escritura exclusiva de service role.
CREATE POLICY admin_audit_log_select ON admin_audit_log
  FOR SELECT TO authenticated
  USING (is_platform_admin());

-- No se crean políticas INSERT/UPDATE/DELETE para authenticated:
-- service role escribe sin pasar por RLS.


-- ════════════════════════════════════════════════════════════
-- 6. place_order — verificación de suscripción
-- ════════════════════════════════════════════════════════════
-- Único cambio respecto a migración 017:
--   Tras la validación de estado del restaurante (bloque 3),
--   se comprueba si el restaurante tiene suscripciones. Si las
--   tiene pero ninguna está vigente, el pedido se rechaza.
--   Restaurantes sin ningún registro de suscripción (onboarding,
--   período de prueba) no son bloqueados.
--
-- El GRANT a anon se omite intencionalmente: fue revocado en
-- migración 018 y debe mantenerse revocado.
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION place_order(
  p_restaurant_id    uuid,
  p_idempotency_key  text,
  p_cart_hash        text,
  p_customer_name    text,
  p_customer_phone   text,
  p_modality         text,
  p_delivery_zone_id uuid,
  p_delivery_address text,
  p_payment_method_id uuid,
  p_notes            text,
  p_items            jsonb,
  p_access_token_hash text,
  p_ip_hash          text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Resultado de idempotencia
  v_existing_id           uuid;
  v_existing_cart_hash    text;
  v_existing_order_number integer;
  v_existing_total        integer;
  v_existing_status       text;

  -- Config del restaurante
  v_restaurant_status     text;
  v_is_temporarily_closed boolean;
  v_closed_message        text;
  v_pickup_enabled        boolean;
  v_delivery_enabled      boolean;

  -- Verificación de suscripción
  v_has_subscriptions     boolean;
  v_has_active_sub        boolean;

  -- Zona de delivery
  v_zone_fee_cents        integer;
  v_zone_min_cents        integer;
  v_zone_name             text;

  -- Método de pago
  v_payment_name          text;
  v_payment_type          text;

  -- Iteración de items
  v_item                  jsonb;
  v_opt_entry             jsonb;
  v_item_idx              integer;
  v_product_id            uuid;
  v_variant_id            uuid;
  v_quantity              integer;
  v_product_name          text;
  v_product_published     boolean;
  v_product_available     boolean;
  v_product_base_price    integer;
  v_product_promo_price   integer;
  v_variant_name          text;
  v_variant_price         integer;
  v_variant_available     boolean;
  v_unit_price            integer;
  v_item_subtotal         integer;

  -- Validación de grupos de opciones
  v_grp_rec               RECORD;
  v_selected_count        integer;
  v_opt_group_id          uuid;
  v_opt_id                uuid;
  v_opt_available         boolean;
  v_opt_delta             integer;
  v_opt_group_name        text;
  v_opt_name              text;

  -- Acumuladores
  v_subtotal_cents        integer;
  v_delivery_fee_cents    integer;
  v_total_cents           integer;

  -- Resultado INSERT
  v_order_id              uuid;
  v_order_number          integer;
  v_order_item_id         uuid;
BEGIN
  -- ── 1. Validar parámetros básicos ─────────────────────────
  IF char_length(COALESCE(p_customer_name, '')) < 1
     OR char_length(p_customer_name) > 100 THEN
    RAISE EXCEPTION 'El nombre del cliente debe tener entre 1 y 100 caracteres'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF char_length(COALESCE(p_customer_phone, '')) < 5
     OR char_length(p_customer_phone) > 30 THEN
    RAISE EXCEPTION 'El teléfono debe tener entre 5 y 30 caracteres'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_modality NOT IN ('pickup', 'delivery') THEN
    RAISE EXCEPTION 'Modalidad no válida: %', p_modality
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'El pedido debe tener al menos un producto'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF jsonb_array_length(p_items) > 30 THEN
    RAISE EXCEPTION 'El pedido no puede tener más de 30 líneas'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- ── 2. Idempotencia ───────────────────────────────────────
  SELECT id, cart_hash, order_number, total_cents, status
  INTO v_existing_id, v_existing_cart_hash, v_existing_order_number,
       v_existing_total, v_existing_status
  FROM orders
  WHERE restaurant_id    = p_restaurant_id
    AND idempotency_key  = p_idempotency_key;

  IF FOUND THEN
    IF v_existing_cart_hash = p_cart_hash THEN
      -- Pedido idéntico ya procesado: devolver resultado anterior.
      RETURN jsonb_build_object(
        'order_id',           v_existing_id,
        'order_number',       v_existing_order_number,
        'subtotal_cents',     NULL,
        'delivery_fee_cents', NULL,
        'total_cents',        v_existing_total,
        'status',             v_existing_status,
        'payment_method_name', NULL,
        'payment_method_type', NULL,
        'idempotent_replay',  true
      );
    ELSE
      -- Mismo idempotency_key pero diferente carrito: conflicto.
      RAISE EXCEPTION 'Ya existe un pedido con esta clave de idempotencia pero diferente contenido'
        USING ERRCODE = 'unique_violation';
    END IF;
  END IF;

  -- ── 3. Verificar estado del restaurante ───────────────────
  SELECT r.status,
         COALESCE(rc.is_temporarily_closed, false),
         rc.closed_message
  INTO v_restaurant_status, v_is_temporarily_closed, v_closed_message
  FROM restaurants r
  LEFT JOIN restaurant_config rc ON rc.restaurant_id = r.id
  WHERE r.id = p_restaurant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Restaurante no encontrado'
      USING ERRCODE = 'no_data_found';
  END IF;

  IF v_restaurant_status <> 'active' THEN
    RAISE EXCEPTION 'El restaurante no está disponible en este momento'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF v_is_temporarily_closed THEN
    RAISE EXCEPTION '%',
      COALESCE(v_closed_message, 'El restaurante está temporalmente cerrado')
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF NOT is_restaurant_open(p_restaurant_id) THEN
    RAISE EXCEPTION 'El restaurante está cerrado en este momento'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- ── 3b. Verificar suscripción ─────────────────────────────
  -- Solo bloquea si el restaurante tiene registros de suscripción
  -- pero ninguno está vigente. Restaurantes sin ningún registro
  -- (onboarding, período de prueba) no son bloqueados aquí.
  SELECT
    EXISTS(SELECT 1 FROM subscriptions WHERE restaurant_id = p_restaurant_id),
    EXISTS(
      SELECT 1 FROM subscriptions
      WHERE restaurant_id = p_restaurant_id
        AND status = 'active'
        AND (ends_at IS NULL OR ends_at > now())
    )
  INTO v_has_subscriptions, v_has_active_sub;

  IF v_has_subscriptions AND NOT v_has_active_sub THEN
    RAISE EXCEPTION 'El restaurante no puede recibir pedidos en este momento'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- ── 4. Validar modalidad y zona/dirección de delivery ─────
  SELECT COALESCE(rc.pickup_enabled, false),
         COALESCE(rc.delivery_enabled, false)
  INTO v_pickup_enabled, v_delivery_enabled
  FROM restaurant_config rc
  WHERE rc.restaurant_id = p_restaurant_id;

  -- Si no hay restaurant_config el COALESCE ya devuelve false.
  v_pickup_enabled  := COALESCE(v_pickup_enabled, false);
  v_delivery_enabled := COALESCE(v_delivery_enabled, false);

  IF p_modality = 'pickup' AND NOT v_pickup_enabled THEN
    RAISE EXCEPTION 'El restaurante no acepta pedidos para recoger en este momento'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_modality = 'delivery' AND NOT v_delivery_enabled THEN
    RAISE EXCEPTION 'El restaurante no acepta pedidos a domicilio en este momento'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  v_delivery_fee_cents := 0;
  v_zone_name          := NULL;

  IF p_modality = 'delivery' THEN
    IF p_delivery_zone_id IS NULL THEN
      RAISE EXCEPTION 'Se requiere una zona de delivery'
        USING ERRCODE = 'invalid_parameter_value';
    END IF;

    SELECT name, fee_cents, minimum_order_cents
    INTO v_zone_name, v_zone_fee_cents, v_zone_min_cents
    FROM delivery_zones
    WHERE id            = p_delivery_zone_id
      AND restaurant_id = p_restaurant_id
      AND is_active     = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'La zona de delivery seleccionada no está disponible'
        USING ERRCODE = 'invalid_parameter_value';
    END IF;

    IF char_length(COALESCE(p_delivery_address, '')) < 5 THEN
      RAISE EXCEPTION 'La dirección de entrega debe tener al menos 5 caracteres'
        USING ERRCODE = 'invalid_parameter_value';
    END IF;

    IF char_length(p_delivery_address) > 300 THEN
      RAISE EXCEPTION 'La dirección de entrega no puede superar 300 caracteres'
        USING ERRCODE = 'invalid_parameter_value';
    END IF;

    v_delivery_fee_cents := v_zone_fee_cents;
  END IF;

  -- ── 5. Validar método de pago ─────────────────────────────
  IF p_payment_method_id IS NULL THEN
    RAISE EXCEPTION 'Se requiere un método de pago'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT name, type
  INTO v_payment_name, v_payment_type
  FROM payment_methods
  WHERE id            = p_payment_method_id
    AND restaurant_id = p_restaurant_id
    AND is_active     = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El método de pago seleccionado no está disponible'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- ── 6. Iterar items: validar y calcular subtotal ──────────
  v_subtotal_cents := 0;
  v_item_idx       := 0;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_variant_id := NULLIF(v_item->>'variant_id', '')::uuid;
    v_quantity   := COALESCE((v_item->>'quantity')::integer, 0);

    -- Validar cantidad
    IF v_quantity < 1 OR v_quantity > 20 THEN
      RAISE EXCEPTION 'La cantidad de cada producto debe estar entre 1 y 20 (producto %)',
        v_product_id
        USING ERRCODE = 'invalid_parameter_value';
    END IF;

    -- Validar producto
    SELECT name, is_published, is_available,
           base_price_cents, promo_price_cents
    INTO v_product_name, v_product_published, v_product_available,
         v_product_base_price, v_product_promo_price
    FROM products
    WHERE id            = v_product_id
      AND restaurant_id = p_restaurant_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Producto no encontrado: %', v_product_id
        USING ERRCODE = 'no_data_found';
    END IF;

    IF NOT v_product_published THEN
      RAISE EXCEPTION 'El producto % no está disponible', v_product_name
        USING ERRCODE = 'invalid_parameter_value';
    END IF;

    IF NOT v_product_available THEN
      RAISE EXCEPTION 'El producto % no está disponible en este momento', v_product_name
        USING ERRCODE = 'invalid_parameter_value';
    END IF;

    -- Determinar precio base (variante o producto)
    IF v_variant_id IS NOT NULL THEN
      SELECT name, price_cents, is_available
      INTO v_variant_name, v_variant_price, v_variant_available
      FROM product_variants
      WHERE id            = v_variant_id
        AND product_id    = v_product_id
        AND restaurant_id = p_restaurant_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Variante no encontrada para el producto %', v_product_name
          USING ERRCODE = 'no_data_found';
      END IF;

      IF NOT v_variant_available THEN
        RAISE EXCEPTION 'La variante % del producto % no está disponible',
          v_variant_name, v_product_name
          USING ERRCODE = 'invalid_parameter_value';
      END IF;

      v_unit_price := v_variant_price;
    ELSE
      v_variant_name := NULL;
      v_unit_price   := COALESCE(v_product_promo_price, v_product_base_price);
    END IF;

    -- Validar grupos de opciones del producto (min/max por grupo)
    FOR v_grp_rec IN
      SELECT og.id, og.name, og.min_selections, og.max_selections
      FROM option_groups og
      WHERE og.product_id    = v_product_id
        AND og.restaurant_id = p_restaurant_id
    LOOP
      -- Contar opciones seleccionadas de este grupo en el item actual
      SELECT COUNT(*)::integer
      INTO v_selected_count
      FROM jsonb_array_elements(COALESCE(v_item->'options', '[]'::jsonb)) AS opt_entry
      WHERE (opt_entry->>'option_group_id')::uuid = v_grp_rec.id;

      IF v_selected_count < v_grp_rec.min_selections THEN
        RAISE EXCEPTION 'El grupo de opciones "%" requiere al menos % selección(es)',
          v_grp_rec.name, v_grp_rec.min_selections
          USING ERRCODE = 'invalid_parameter_value';
      END IF;

      IF v_selected_count > v_grp_rec.max_selections THEN
        RAISE EXCEPTION 'El grupo de opciones "%" permite como máximo % selección(es)',
          v_grp_rec.name, v_grp_rec.max_selections
          USING ERRCODE = 'invalid_parameter_value';
      END IF;
    END LOOP;

    -- Validar cada opción seleccionada y sumar deltas
    FOR v_opt_entry IN
      SELECT * FROM jsonb_array_elements(COALESCE(v_item->'options', '[]'::jsonb))
    LOOP
      v_opt_group_id := (v_opt_entry->>'option_group_id')::uuid;
      v_opt_id       := (v_opt_entry->>'option_id')::uuid;

      SELECT o.price_delta_cents, o.is_available
      INTO v_opt_delta, v_opt_available
      FROM options o
      WHERE o.id              = v_opt_id
        AND o.option_group_id = v_opt_group_id
        AND o.restaurant_id   = p_restaurant_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Opción no válida (option_id=%, group_id=%)',
          v_opt_id, v_opt_group_id
          USING ERRCODE = 'no_data_found';
      END IF;

      IF NOT v_opt_available THEN
        RAISE EXCEPTION 'Una de las opciones seleccionadas no está disponible'
          USING ERRCODE = 'invalid_parameter_value';
      END IF;

      v_unit_price := v_unit_price + v_opt_delta;
    END LOOP;

    -- Protección contra precio negativo (puede ocurrir con deltas negativos)
    IF v_unit_price < 0 THEN
      v_unit_price := 0;
    END IF;

    v_item_subtotal  := v_unit_price * v_quantity;
    v_subtotal_cents := v_subtotal_cents + v_item_subtotal;
    v_item_idx       := v_item_idx + 1;
  END LOOP;

  -- ── 7. Verificar mínimo de pedido para delivery ───────────
  IF p_modality = 'delivery'
     AND v_zone_min_cents IS NOT NULL
     AND v_subtotal_cents < v_zone_min_cents THEN
    RAISE EXCEPTION 'El subtotal del pedido ($%) no alcanza el mínimo de la zona de delivery ($%)',
      v_subtotal_cents, v_zone_min_cents
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  v_total_cents := v_subtotal_cents + v_delivery_fee_cents;

  -- ── 8. Contador atómico de número de orden ────────────────
  INSERT INTO order_counters (restaurant_id, last_number)
  VALUES (p_restaurant_id, 1)
  ON CONFLICT (restaurant_id) DO UPDATE
    SET last_number = order_counters.last_number + 1
  RETURNING last_number INTO v_order_number;

  -- ── 9a. Insertar pedido ───────────────────────────────────
  INSERT INTO orders (
    restaurant_id,
    order_number,
    idempotency_key,
    cart_hash,
    customer_name,
    customer_phone,
    modality,
    delivery_zone_id,
    delivery_zone_name,
    delivery_address,
    delivery_fee_cents,
    payment_method_id,
    payment_method_name,
    payment_method_type,
    notes,
    status,
    payment_status,
    subtotal_cents,
    total_cents,
    access_token_hash,
    ip_hash
  ) VALUES (
    p_restaurant_id,
    v_order_number,
    p_idempotency_key,
    p_cart_hash,
    p_customer_name,
    p_customer_phone,
    p_modality,
    CASE WHEN p_modality = 'delivery' THEN p_delivery_zone_id ELSE NULL END,
    CASE WHEN p_modality = 'delivery' THEN v_zone_name ELSE NULL END,
    CASE WHEN p_modality = 'delivery' THEN p_delivery_address ELSE NULL END,
    v_delivery_fee_cents,
    p_payment_method_id,
    v_payment_name,
    v_payment_type,
    NULLIF(TRIM(COALESCE(p_notes, '')), ''),
    'received',
    'pending',
    v_subtotal_cents,
    v_total_cents,
    p_access_token_hash,
    p_ip_hash
  )
  RETURNING id INTO v_order_id;

  -- ── 9b. Insertar líneas del pedido (segundo pase) ─────────
  -- El segundo pase re-lee los nombres del catálogo desde la BD
  -- para garantizar consistencia incluso si el catálogo cambió
  -- durante la validación (dentro de la misma transacción, los
  -- datos son consistentes gracias al snapshot de MVCC).
  v_item_idx := 0;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_variant_id := NULLIF(v_item->>'variant_id', '')::uuid;
    v_quantity   := (v_item->>'quantity')::integer;

    -- Re-leer nombre del producto
    SELECT name, base_price_cents, promo_price_cents
    INTO v_product_name, v_product_base_price, v_product_promo_price
    FROM products
    WHERE id = v_product_id AND restaurant_id = p_restaurant_id;

    -- Calcular precio unitario nuevamente (consistente con el primer pase)
    IF v_variant_id IS NOT NULL THEN
      SELECT name, price_cents
      INTO v_variant_name, v_variant_price
      FROM product_variants
      WHERE id = v_variant_id AND product_id = v_product_id
        AND restaurant_id = p_restaurant_id;

      v_unit_price := v_variant_price;
    ELSE
      v_variant_name := NULL;
      v_unit_price   := COALESCE(v_product_promo_price, v_product_base_price);
    END IF;

    -- Re-aplicar deltas de opciones
    FOR v_opt_entry IN
      SELECT * FROM jsonb_array_elements(COALESCE(v_item->'options', '[]'::jsonb))
    LOOP
      v_opt_group_id := (v_opt_entry->>'option_group_id')::uuid;
      v_opt_id       := (v_opt_entry->>'option_id')::uuid;

      SELECT price_delta_cents INTO v_opt_delta
      FROM options
      WHERE id = v_opt_id AND option_group_id = v_opt_group_id
        AND restaurant_id = p_restaurant_id;

      v_unit_price := v_unit_price + COALESCE(v_opt_delta, 0);
    END LOOP;

    IF v_unit_price < 0 THEN v_unit_price := 0; END IF;

    v_item_subtotal := v_unit_price * v_quantity;

    INSERT INTO order_items (
      order_id, restaurant_id,
      product_id, product_name,
      variant_id, variant_name,
      unit_price_cents, quantity, subtotal_cents, position
    ) VALUES (
      v_order_id, p_restaurant_id,
      v_product_id, v_product_name,
      v_variant_id, v_variant_name,
      v_unit_price, v_quantity, v_item_subtotal, v_item_idx
    )
    RETURNING id INTO v_order_item_id;

    -- Insertar opciones de la línea
    FOR v_opt_entry IN
      SELECT * FROM jsonb_array_elements(COALESCE(v_item->'options', '[]'::jsonb))
    LOOP
      v_opt_group_id := (v_opt_entry->>'option_group_id')::uuid;
      v_opt_id       := (v_opt_entry->>'option_id')::uuid;

      -- Leer nombres del catálogo para el snapshot
      SELECT og.name, o.name, o.price_delta_cents
      INTO v_opt_group_name, v_opt_name, v_opt_delta
      FROM options o
      JOIN option_groups og ON og.id = o.option_group_id
      WHERE o.id              = v_opt_id
        AND o.option_group_id = v_opt_group_id
        AND o.restaurant_id   = p_restaurant_id;

      INSERT INTO order_item_options (
        order_item_id, restaurant_id,
        option_group_id, option_group_name,
        option_id, option_name,
        price_delta_cents
      ) VALUES (
        v_order_item_id, p_restaurant_id,
        v_opt_group_id, v_opt_group_name,
        v_opt_id, v_opt_name,
        COALESCE(v_opt_delta, 0)
      );
    END LOOP;

    v_item_idx := v_item_idx + 1;
  END LOOP;

  -- ── 9c. Evento inicial de estado ──────────────────────────
  INSERT INTO order_status_events (order_id, restaurant_id, status)
  VALUES (v_order_id, p_restaurant_id, 'received');

  -- ── 10. Retornar resultado ────────────────────────────────
  RETURN jsonb_build_object(
    'order_id',            v_order_id,
    'order_number',        v_order_number,
    'subtotal_cents',      v_subtotal_cents,
    'delivery_fee_cents',  v_delivery_fee_cents,
    'total_cents',         v_total_cents,
    'status',              'received',
    'payment_method_name', v_payment_name,
    'payment_method_type', v_payment_type,
    'idempotent_replay',   false
  );
END;
$$;

-- anon fue revocado en migración 018 y debe permanecer revocado.
REVOKE ALL ON FUNCTION place_order(
  uuid, text, text, text, text, text,
  uuid, text, uuid, text, jsonb, text, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION place_order(
  uuid, text, text, text, text, text,
  uuid, text, uuid, text, jsonb, text, text
) TO authenticated;
