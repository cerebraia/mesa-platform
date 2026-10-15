-- ============================================================
-- Mesa Platform · Migración 018 — Operaciones de pedidos
-- ============================================================
-- Cambios:
--
-- 1. Revoca EXECUTE de place_order a anon.
--    La creación de pedidos pasa exclusivamente por /api/orders
--    (Next.js server-side), que aplica rate-limit y validaciones
--    adicionales. Anon nunca llama place_order directamente.
--
-- 2. Restricción de columnas en orders y order_status_events.
--    RLS limita filas, pero no columnas. Cocina no debe ver
--    datos de contacto ni de pago. Se revoca SELECT de tabla
--    y se concede solo columnas públicas al rol authenticated.
--    Los datos privados se exponen únicamente a través de RPCs
--    que verifican el rol de la aplicación.
--
-- 3. advance_order_status — transiciones controladas de estado.
--    Valida rol, estado actual y transición permitida. Registra
--    evento en order_status_events. Usa SELECT … FOR UPDATE
--    para proteger contra actualizaciones concurrentes.
--
-- 4. confirm_order_payment — confirmación manual del pago.
--    Owner y atención confirman; solo owner puede corregir.
--    Registra evento en historial.
--
-- 5. get_orders_for_panel — listado de pedidos por rol.
--    Cocina recibe solo campos para preparación, sin PII.
--    Owner y atención reciben datos completos con filtros.
--
-- 6. get_order_full_detail — detalle completo de un pedido.
--    Cocina: campos de preparación únicamente.
--    Owner / atención: todos los campos + historial de estados.
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- 1. Revocar place_order de anon
-- ════════════════════════════════════════════════════════════
-- El checkout ocurre íntegramente en el servidor (POST /api/orders
-- con service role). Anon nunca debe llamar place_order
-- directamente, lo que evitaría el rate-limit del endpoint.

REVOKE EXECUTE ON FUNCTION place_order(
  uuid, text, text, text, text, text,
  uuid, text, uuid, text, jsonb, text, text
) FROM anon;

-- ════════════════════════════════════════════════════════════
-- 2. Restricción de columnas en orders
-- ════════════════════════════════════════════════════════════
-- Columnas públicas (todos los miembros activos del restaurante):
--   id, restaurant_id, order_number, status, modality,
--   subtotal_cents, total_cents, delivery_fee_cents,
--   delivery_zone_name, payment_method_name, payment_method_type,
--   payment_status, created_at, updated_at
--
-- Columnas privadas (owner/atención vía RPC únicamente):
--   customer_name, customer_phone, delivery_address, notes,
--   delivery_zone_id, payment_method_id,
--   idempotency_key, cart_hash, access_token_hash, ip_hash

REVOKE SELECT ON orders FROM authenticated;

GRANT SELECT (
  id, restaurant_id, order_number, status, modality,
  subtotal_cents, total_cents, delivery_fee_cents,
  delivery_zone_name,
  payment_method_name, payment_method_type,
  payment_status,
  created_at, updated_at
) ON orders TO authenticated;

-- ════════════════════════════════════════════════════════════
-- 3. Restricción de columnas en order_status_events
-- ════════════════════════════════════════════════════════════
-- Columnas públicas: id, order_id, restaurant_id, status, created_at
-- Privadas (owner/atención vía RPC): note, created_by

REVOKE SELECT ON order_status_events FROM authenticated;

GRANT SELECT (id, order_id, restaurant_id, status, created_at)
  ON order_status_events TO authenticated;

-- ════════════════════════════════════════════════════════════
-- 4. advance_order_status
-- ════════════════════════════════════════════════════════════
-- Transiciones permitidas por rol:
--
--  received  → accepted   owner, atención
--  received  → rejected   owner, atención  (requiere nota)
--  accepted  → preparing  owner, atención, cocina
--  preparing → ready      owner, atención, cocina
--  ready     → completed  owner, atención  (retiro)
--  ready     → on_the_way owner, atención  (delivery)
--  on_the_way→ completed  owner, atención
--  cualquiera→ cancelled  owner  (requiere nota; no desde terminal)
--
-- Estados terminales: completed, rejected, cancelled.
-- No se puede avanzar desde un estado terminal.
-- SELECT … FOR UPDATE impide conflictos de concurrencia:
-- si dos empleados actúan a la vez, el segundo recibe el estado
-- actual y un error de transición inválida.

CREATE OR REPLACE FUNCTION advance_order_status(
  p_order_id      uuid,
  p_restaurant_id uuid,
  p_new_status    text,
  p_note          text DEFAULT NULL
)
RETURNS text
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

  -- ── 2. Leer estado actual con bloqueo de fila ─────────────
  -- FOR UPDATE asegura que dos llamadas concurrentes no vean
  -- el mismo estado e inserten transiciones contradictorias.
  SELECT status, modality
  INTO v_current_status, v_modality
  FROM orders
  WHERE id = p_order_id AND restaurant_id = p_restaurant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido no encontrado'
      USING ERRCODE = 'no_data_found';
  END IF;

  -- ── 3. Verificar que no es un estado terminal ─────────────
  IF v_current_status IN ('completed', 'rejected', 'cancelled') THEN
    RAISE EXCEPTION 'El pedido está en un estado terminal (%) y no puede avanzar',
      v_current_status
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- ── 4. Cancelación (caso especial, solo owner) ────────────
  IF p_new_status = 'cancelled' THEN
    IF v_role != 'owner' THEN
      RAISE EXCEPTION 'Solo el propietario puede cancelar pedidos'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF p_note IS NULL OR char_length(trim(p_note)) < 3 THEN
      RAISE EXCEPTION 'La cancelación requiere un motivo (mínimo 3 caracteres)'
        USING ERRCODE = 'invalid_parameter_value';
    END IF;
    -- Cancelación permitida desde cualquier estado no terminal
    v_valid := true;

  ELSIF p_new_status = 'rejected' THEN
    -- Solo desde received
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
    -- ── 5. Validar transición por rol y estado ────────────────
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
    RAISE EXCEPTION 'Transición no permitida: "%" → "%" para rol "%"',
      v_current_status, p_new_status, v_role
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- ── 6. Actualizar estado ──────────────────────────────────
  UPDATE orders
  SET status = p_new_status, updated_at = now()
  WHERE id = p_order_id AND restaurant_id = p_restaurant_id;

  -- ── 7. Registrar evento (historial inmutable) ─────────────
  INSERT INTO order_status_events (order_id, restaurant_id, status, note, created_by)
  VALUES (p_order_id, p_restaurant_id, p_new_status, p_note, auth.uid());

  RETURN p_new_status;
END;
$$;

REVOKE ALL ON FUNCTION advance_order_status(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION advance_order_status(uuid, uuid, text, text) TO authenticated;

-- ════════════════════════════════════════════════════════════
-- 5. confirm_order_payment
-- ════════════════════════════════════════════════════════════
-- Owner y atención confirman el pago manualmente.
-- Corregir un pago ya confirmado (p_confirmed = false) requiere
-- ser owner y proporcionar un motivo.
-- No se confirma automáticamente al seleccionar transferencia
-- ni al abrir WhatsApp.
-- La política sobre entregar pedidos con pago pendiente es
-- explícita: el sistema no bloquea ni permite automáticamente;
-- el restaurante decide. Ningún campo del sistema cambia el
-- estado del pedido basándose en el estado del pago.

CREATE OR REPLACE FUNCTION confirm_order_payment(
  p_order_id      uuid,
  p_restaurant_id uuid,
  p_confirmed     boolean,
  p_note          text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role                   text;
  v_current_payment_status text;
  v_order_status           text;
  v_new_payment_status     text;
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

  -- Corregir pago confirmado: solo owner, con motivo
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

  v_new_payment_status := CASE WHEN p_confirmed THEN 'confirmed' ELSE 'pending' END;

  UPDATE orders
  SET payment_status = v_new_payment_status, updated_at = now()
  WHERE id = p_order_id AND restaurant_id = p_restaurant_id;

  INSERT INTO order_status_events (order_id, restaurant_id, status, note, created_by)
  VALUES (
    p_order_id,
    p_restaurant_id,
    'payment_' || v_new_payment_status,
    p_note,
    auth.uid()
  );

  RETURN v_new_payment_status;
END;
$$;

REVOKE ALL ON FUNCTION confirm_order_payment(uuid, uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION confirm_order_payment(uuid, uuid, boolean, text) TO authenticated;

-- ════════════════════════════════════════════════════════════
-- 6. get_orders_for_panel
-- ════════════════════════════════════════════════════════════
-- Retorna pedidos filtrados según el rol del llamante.
-- Cocina recibe solo campos para preparación, sin PII.
-- Owner y atención reciben todos los campos, con filtros.

CREATE OR REPLACE FUNCTION get_orders_for_panel(
  p_restaurant_id  uuid,
  p_status         text    DEFAULT NULL,
  p_payment_status text    DEFAULT NULL,
  p_modality       text    DEFAULT NULL,
  p_date_from      date    DEFAULT NULL,
  p_date_to        date    DEFAULT NULL,
  p_page           integer DEFAULT 1,
  p_per_page       integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role    text;
  v_orders  jsonb;
  v_limit   integer;
  v_offset  integer;
BEGIN
  v_role := member_role(p_restaurant_id);
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Acceso denegado: sin membresía activa'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_limit  := LEAST(COALESCE(p_per_page, 50), 100);
  v_offset := GREATEST(0, COALESCE(p_page, 1) - 1) * v_limit;

  IF v_role = 'kitchen' THEN
    -- Cocina: solo pedidos en cola de preparación, sin PII
    SELECT jsonb_agg(
      jsonb_build_object(
        'id',             sub.id,
        'order_number',   sub.order_number,
        'status',         sub.status,
        'modality',       sub.modality,
        'subtotal_cents', sub.subtotal_cents,
        'total_cents',    sub.total_cents,
        'created_at',     sub.created_at
      ) ORDER BY sub.created_at
    )
    INTO v_orders
    FROM (
      SELECT id, order_number, status, modality, subtotal_cents, total_cents, created_at
      FROM orders
      WHERE restaurant_id = p_restaurant_id
        AND status IN ('accepted', 'preparing')
        AND (p_status IS NULL OR status = p_status)
      ORDER BY created_at
      LIMIT v_limit OFFSET v_offset
    ) sub;

  ELSE
    -- Owner / atención: listado completo con filtros
    SELECT jsonb_agg(
      jsonb_build_object(
        'id',                  sub.id,
        'order_number',        sub.order_number,
        'status',              sub.status,
        'modality',            sub.modality,
        'customer_name',       sub.customer_name,
        'customer_phone',      sub.customer_phone,
        'delivery_zone_name',  sub.delivery_zone_name,
        'delivery_fee_cents',  sub.delivery_fee_cents,
        'payment_method_name', sub.payment_method_name,
        'payment_method_type', sub.payment_method_type,
        'payment_status',      sub.payment_status,
        'subtotal_cents',      sub.subtotal_cents,
        'total_cents',         sub.total_cents,
        'created_at',          sub.created_at,
        'updated_at',          sub.updated_at
      ) ORDER BY sub.created_at DESC
    )
    INTO v_orders
    FROM (
      SELECT
        id, order_number, status, modality,
        customer_name, customer_phone,
        delivery_zone_name, delivery_fee_cents,
        payment_method_name, payment_method_type, payment_status,
        subtotal_cents, total_cents, created_at, updated_at
      FROM orders
      WHERE restaurant_id = p_restaurant_id
        AND (p_status IS NULL OR status = p_status)
        AND (p_payment_status IS NULL OR payment_status = p_payment_status)
        AND (p_modality IS NULL OR modality = p_modality)
        AND (p_date_from IS NULL
             OR created_at >= p_date_from::timestamptz)
        AND (p_date_to IS NULL
             OR created_at < (p_date_to + INTERVAL '1 day')::timestamptz)
      ORDER BY created_at DESC
      LIMIT v_limit OFFSET v_offset
    ) sub;
  END IF;

  RETURN jsonb_build_object(
    'orders', COALESCE(v_orders, '[]'::jsonb),
    'role',   v_role
  );
END;
$$;

REVOKE ALL ON FUNCTION get_orders_for_panel(uuid, text, text, text, date, date, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_orders_for_panel(uuid, text, text, text, date, date, integer, integer) TO authenticated;

-- ════════════════════════════════════════════════════════════
-- 7. get_order_full_detail
-- ════════════════════════════════════════════════════════════
-- Detalle completo de un pedido con items, opciones e historial.
-- Cocina: solo campos de preparación, sin datos de contacto
--         ni de pago.
-- Owner / atención: todos los campos incluyendo datos personales,
--                   instrucciones de pago e historial completo.

CREATE OR REPLACE FUNCTION get_order_full_detail(
  p_order_id      uuid,
  p_restaurant_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role                 text;
  v_order_id             uuid;
  v_order_number         integer;
  v_status               text;
  v_modality             text;
  v_customer_name        text;
  v_customer_phone       text;
  v_delivery_zone_name   text;
  v_delivery_address     text;
  v_delivery_fee_cents   integer;
  v_payment_method_id    uuid;
  v_payment_method_name  text;
  v_payment_method_type  text;
  v_payment_instructions text;
  v_notes                text;
  v_payment_status       text;
  v_subtotal_cents       integer;
  v_total_cents          integer;
  v_created_at           timestamptz;
  v_updated_at           timestamptz;
  v_items                jsonb;
  v_events               jsonb;
BEGIN
  v_role := member_role(p_restaurant_id);
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Acceso denegado'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- ── Cocina: solo campos de preparación ────────────────────
  IF v_role = 'kitchen' THEN
    SELECT id, order_number, status, modality,
           subtotal_cents, total_cents, created_at
    INTO v_order_id, v_order_number, v_status, v_modality,
         v_subtotal_cents, v_total_cents, v_created_at
    FROM orders
    WHERE id = p_order_id AND restaurant_id = p_restaurant_id;

    IF NOT FOUND THEN RETURN NULL; END IF;

    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id',           oi.id,
        'product_name', oi.product_name,
        'variant_name', oi.variant_name,
        'quantity',     oi.quantity,
        'position',     oi.position,
        'options',      COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'option_group_name', oio.option_group_name,
            'option_name',       oio.option_name
          ))
          FROM order_item_options oio
          WHERE oio.order_item_id = oi.id
        ), '[]'::jsonb)
      ) ORDER BY oi.position
    ), '[]'::jsonb)
    INTO v_items
    FROM order_items oi
    WHERE oi.order_id = p_order_id;

    RETURN jsonb_build_object(
      'id',             v_order_id,
      'order_number',   v_order_number,
      'status',         v_status,
      'modality',       v_modality,
      'subtotal_cents', v_subtotal_cents,
      'total_cents',    v_total_cents,
      'created_at',     v_created_at,
      'items',          v_items,
      'role',           v_role
    );
  END IF;

  -- ── Owner / atención: detalle completo ────────────────────
  SELECT
    id, order_number, status, modality,
    customer_name, customer_phone,
    delivery_zone_name, delivery_address, delivery_fee_cents,
    payment_method_id, payment_method_name, payment_method_type,
    notes, payment_status, subtotal_cents, total_cents,
    created_at, updated_at
  INTO
    v_order_id, v_order_number, v_status, v_modality,
    v_customer_name, v_customer_phone,
    v_delivery_zone_name, v_delivery_address, v_delivery_fee_cents,
    v_payment_method_id, v_payment_method_name, v_payment_method_type,
    v_notes, v_payment_status, v_subtotal_cents, v_total_cents,
    v_created_at, v_updated_at
  FROM orders
  WHERE id = p_order_id AND restaurant_id = p_restaurant_id;

  IF NOT FOUND THEN RETURN NULL; END IF;

  -- Instrucciones de pago actuales (no snapshot en el pedido)
  SELECT instructions INTO v_payment_instructions
  FROM payment_methods WHERE id = v_payment_method_id;

  -- Items con precios
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id',               oi.id,
      'product_name',     oi.product_name,
      'variant_name',     oi.variant_name,
      'unit_price_cents', oi.unit_price_cents,
      'quantity',         oi.quantity,
      'subtotal_cents',   oi.subtotal_cents,
      'position',         oi.position,
      'options',          COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'option_group_name', oio.option_group_name,
          'option_name',       oio.option_name,
          'price_delta_cents', oio.price_delta_cents
        ))
        FROM order_item_options oio
        WHERE oio.order_item_id = oi.id
      ), '[]'::jsonb)
    ) ORDER BY oi.position
  ), '[]'::jsonb)
  INTO v_items
  FROM order_items oi
  WHERE oi.order_id = p_order_id;

  -- Historial de estados (note y created_by restringidos vía RPC)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'status',     ose.status,
      'note',       ose.note,
      'created_by', ose.created_by,
      'created_at', ose.created_at
    ) ORDER BY ose.created_at
  ), '[]'::jsonb)
  INTO v_events
  FROM order_status_events ose
  WHERE ose.order_id = p_order_id;

  RETURN jsonb_build_object(
    'id',                    v_order_id,
    'order_number',          v_order_number,
    'status',                v_status,
    'modality',              v_modality,
    'customer_name',         v_customer_name,
    'customer_phone',        v_customer_phone,
    'delivery_zone_name',    v_delivery_zone_name,
    'delivery_address',      v_delivery_address,
    'delivery_fee_cents',    v_delivery_fee_cents,
    'payment_method_name',   v_payment_method_name,
    'payment_method_type',   v_payment_method_type,
    'payment_instructions',  v_payment_instructions,
    'notes',                 v_notes,
    'payment_status',        v_payment_status,
    'subtotal_cents',        v_subtotal_cents,
    'total_cents',           v_total_cents,
    'created_at',            v_created_at,
    'updated_at',            v_updated_at,
    'items',                 v_items,
    'status_events',         v_events,
    'role',                  v_role
  );
END;
$$;

REVOKE ALL ON FUNCTION get_order_full_detail(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_order_full_detail(uuid, uuid) TO authenticated;
