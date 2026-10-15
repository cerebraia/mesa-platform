-- ============================================================
-- Mesa Platform · Migración 019 — Operaciones de pedidos v2
-- ============================================================
-- Razones de esta migración:
--
-- 1. advance_order_status y confirm_order_payment pasan a
--    retornar jsonb en lugar de text.
--    · Permite distinguir éxito, idempotencia y conflicto sin
--      recurrir a errores de excepción para flujos normales.
--    · Cambia el tipo de retorno, lo que exige DROP + CREATE.
--
-- 2. Ambas funciones aceptan el estado esperado del cliente:
--    p_expected_status y p_expected_payment_status.
--    · Si el estado actual != esperado, devuelven conflicto
--      con el estado vigente en lugar de un error de excepción.
--    · Esto cubre el caso de UI desactualizada sin tratar el
--      conflicto como un error irrecuperable.
--
-- 3. Idempotencia explícita para doble-clic / reintento:
--    · Si el estado actual ya es el estado destino, devuelven
--      idempotent=true sin crear un segundo evento de historial.
--    · Garantiza que dos clics rápidos no duplican transiciones.
--
-- 4. El campo p_note y p_expected_status mantienen DEFAULT NULL
--    para no romper llamadas anteriores.
-- ============================================================

-- ── Eliminar versiones anteriores ─────────────────────────────
-- El tipo de retorno cambia (text → jsonb), lo que impide
-- CREATE OR REPLACE sin DROP previo.

DROP FUNCTION IF EXISTS advance_order_status(uuid, uuid, text, text);
DROP FUNCTION IF EXISTS confirm_order_payment(uuid, uuid, boolean, text);

-- ════════════════════════════════════════════════════════════
-- advance_order_status — v2
-- ════════════════════════════════════════════════════════════
-- Respuesta jsonb:
--   { success, conflict, idempotent, current_status, message? }
--
--   success=true  + idempotent=false  → transición aplicada
--   success=true  + idempotent=true   → ya estaba en ese estado
--   success=false + conflict=true     → estado actual ≠ esperado
--   (excepción)                       → error de permiso/validación

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
  IF v_current_status = p_new_status THEN
    RETURN jsonb_build_object(
      'success',        true,
      'conflict',       false,
      'idempotent',     true,
      'current_status', v_current_status
    );
  END IF;

  -- ── 4. Conflicto: estado actual ≠ estado esperado ─────────
  -- El empleado abrió el pedido cuando estaba en p_expected_status,
  -- pero otro operador lo cambió antes de que llegara esta acción.
  IF p_expected_status IS NOT NULL AND v_current_status != p_expected_status THEN
    RETURN jsonb_build_object(
      'success',        false,
      'conflict',       true,
      'idempotent',     false,
      'current_status', v_current_status,
      'message',        'El estado del pedido cambió. Actualiza la vista antes de continuar.'
    );
  END IF;

  -- ── 5. Verificar estado terminal ─────────────────────────
  IF v_current_status IN ('completed', 'rejected', 'cancelled') THEN
    RAISE EXCEPTION 'El pedido está en un estado terminal (%) y no puede avanzar',
      v_current_status
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- ── 6. Cancelación (solo owner, requiere nota) ────────────
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
    -- ── 7. Validar transición por rol y estado ────────────────
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

  -- ── 8. Actualizar estado ──────────────────────────────────
  UPDATE orders
  SET status = p_new_status, updated_at = now()
  WHERE id = p_order_id AND restaurant_id = p_restaurant_id;

  -- ── 9. Registrar evento (historial inmutable) ─────────────
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
-- confirm_order_payment — v2
-- ════════════════════════════════════════════════════════════
-- Respuesta jsonb:
--   { success, conflict, idempotent, payment_status, message? }

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
  IF v_current_payment_status = v_target_status THEN
    RETURN jsonb_build_object(
      'success',        true,
      'conflict',       false,
      'idempotent',     true,
      'payment_status', v_current_payment_status
    );
  END IF;

  -- ── Conflicto: estado actual ≠ esperado ───────────────────
  IF p_expected_payment_status IS NOT NULL
     AND v_current_payment_status != p_expected_payment_status THEN
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
