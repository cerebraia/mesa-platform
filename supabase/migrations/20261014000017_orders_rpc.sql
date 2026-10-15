-- ============================================================
-- Mesa Platform · Migración 017 — RPCs de pedidos
-- ============================================================
-- place_order:     crea un pedido validado de forma atómica.
-- get_order_by_token: devuelve el estado del pedido al cliente
--                  usando el hash de su token de acceso.
--
-- Ambas funciones son SECURITY DEFINER para poder escribir o
-- leer tablas con RLS sin requerir que anon tenga privilegios
-- directos sobre ellas.
-- auth.uid() sigue reflejando al usuario real que llama
-- (anon → NULL, authenticated → su UUID).
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- place_order
-- ════════════════════════════════════════════════════════════
-- Flujo:
--   1. Validar parámetros básicos.
--   2. Idempotencia: si ya existe un pedido con el mismo
--      (restaurant_id, idempotency_key), devolver el pedido
--      existente si cart_hash coincide; error si difiere.
--   3. Verificar que el restaurante esté activo y abierto.
--   4. Validar modalidad y, si es delivery, la zona.
--   5. Validar método de pago.
--   6. Iterar items para validar y calcular subtotal.
--   7. Verificar mínimo de pedido para delivery.
--   8. Incrementar contador atómico de orden.
--   9. Insertar orders, order_items, order_item_options, evento.
--  10. Retornar jsonb con resultado.
-- ============================================================
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

REVOKE ALL ON FUNCTION place_order(
  uuid, text, text, text, text, text,
  uuid, text, uuid, text, jsonb, text, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION place_order(
  uuid, text, text, text, text, text,
  uuid, text, uuid, text, jsonb, text, text
) TO anon;

GRANT EXECUTE ON FUNCTION place_order(
  uuid, text, text, text, text, text,
  uuid, text, uuid, text, jsonb, text, text
) TO authenticated;

-- ════════════════════════════════════════════════════════════
-- get_order_by_token
-- ════════════════════════════════════════════════════════════
-- Devuelve el estado completo del pedido al portador del token.
-- No expone ip_hash ni access_token_hash en la respuesta.
-- Las instrucciones de pago se incluyen porque el cliente las
-- necesita para completar el pago.
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION get_order_by_token(p_token_hash text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order             RECORD;
  v_payment_instructions text;
  v_items_json        jsonb;
  v_item_rec          RECORD;
  v_item_options_json jsonb;
  v_opt_rec           RECORD;
BEGIN
  -- Buscar pedido por token
  SELECT
    id, order_number, restaurant_id, modality,
    delivery_zone_name, delivery_address, delivery_fee_cents,
    payment_method_id, payment_method_name, payment_method_type,
    notes, status, payment_status,
    subtotal_cents, total_cents, created_at
  INTO v_order
  FROM orders
  WHERE access_token_hash = p_token_hash;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Instrucciones de pago (privadas; solo se muestran al comprador con token)
  SELECT instructions
  INTO v_payment_instructions
  FROM payment_methods
  WHERE id = v_order.payment_method_id;

  -- Construir array de items con sus opciones anidadas
  v_items_json := '[]'::jsonb;

  FOR v_item_rec IN
    SELECT
      oi.id,
      oi.product_id,
      oi.product_name,
      oi.variant_id,
      oi.variant_name,
      oi.unit_price_cents,
      oi.quantity,
      oi.subtotal_cents,
      oi.position
    FROM order_items oi
    WHERE oi.order_id = v_order.id
    ORDER BY oi.position
  LOOP
    -- Opciones de este item
    v_item_options_json := '[]'::jsonb;

    FOR v_opt_rec IN
      SELECT
        oio.option_group_id,
        oio.option_group_name,
        oio.option_id,
        oio.option_name,
        oio.price_delta_cents
      FROM order_item_options oio
      WHERE oio.order_item_id = v_item_rec.id
    LOOP
      v_item_options_json := v_item_options_json || jsonb_build_array(
        jsonb_build_object(
          'option_group_id',   v_opt_rec.option_group_id,
          'option_group_name', v_opt_rec.option_group_name,
          'option_id',         v_opt_rec.option_id,
          'option_name',       v_opt_rec.option_name,
          'price_delta_cents', v_opt_rec.price_delta_cents
        )
      );
    END LOOP;

    v_items_json := v_items_json || jsonb_build_array(
      jsonb_build_object(
        'id',               v_item_rec.id,
        'product_id',       v_item_rec.product_id,
        'product_name',     v_item_rec.product_name,
        'variant_id',       v_item_rec.variant_id,
        'variant_name',     v_item_rec.variant_name,
        'unit_price_cents', v_item_rec.unit_price_cents,
        'quantity',         v_item_rec.quantity,
        'subtotal_cents',   v_item_rec.subtotal_cents,
        'options',          v_item_options_json
      )
    );
  END LOOP;

  RETURN jsonb_build_object(
    'id',                    v_order.id,
    'order_number',          v_order.order_number,
    'restaurant_id',         v_order.restaurant_id,
    'modality',              v_order.modality,
    'delivery_zone_name',    v_order.delivery_zone_name,
    'delivery_address',      v_order.delivery_address,
    'delivery_fee_cents',    v_order.delivery_fee_cents,
    'payment_method_name',   v_order.payment_method_name,
    'payment_method_type',   v_order.payment_method_type,
    'payment_instructions',  v_payment_instructions,
    'notes',                 v_order.notes,
    'status',                v_order.status,
    'payment_status',        v_order.payment_status,
    'subtotal_cents',        v_order.subtotal_cents,
    'total_cents',           v_order.total_cents,
    'created_at',            v_order.created_at,
    'items',                 v_items_json
  );
END;
$$;

REVOKE ALL ON FUNCTION get_order_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_order_by_token(text) TO anon;
GRANT EXECUTE ON FUNCTION get_order_by_token(text) TO authenticated;
