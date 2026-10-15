-- ============================================================
-- Mesa Platform · Migración 015 — Tablas de pedidos
-- ============================================================
-- Entidades: order_counters, orders, order_items,
--            order_item_options, order_status_events.
--
-- Decisiones de modelo:
-- · order_counters: contador atómico por restaurante; evita
--   lagunas en order_number usando ON CONFLICT DO UPDATE.
-- · orders: los campos snapshot (product_name, variant_name,
--   delivery_zone_name, payment_method_name) preservan la
--   información en el momento del pedido, inmune a cambios
--   posteriores en el catálogo.
-- · order_items: product_id y variant_id son snapshots —
--   sin FK al catálogo — para que los productos eliminados
--   no rompan pedidos históricos.
-- · order_item_options: ídem para option_group_id/option_id.
-- · Idempotencia: (restaurant_id, idempotency_key) UNIQUE +
--   cart_hash evitan pedidos duplicados y permiten reintentos
--   seguros desde el cliente.
-- · access_token_hash: hash del token que permite al comprador
--   consultar su propio pedido sin estar autenticado.
-- · ip_hash: almacenado para auditoría de rate limiting;
--   nullable, nunca se expone en respuestas públicas.
-- · Dinero en centavos (integer).
-- ============================================================

-- ── order_counters ───────────────────────────────────────────
-- Contador atómico por restaurante. Actualizado con
-- ON CONFLICT DO UPDATE SET last_number = last_number + 1
-- dentro de place_order para garantizar atomicidad.
CREATE TABLE order_counters (
  restaurant_id uuid    NOT NULL
                        REFERENCES restaurants(id) ON DELETE CASCADE,
  last_number   integer NOT NULL DEFAULT 0,

  PRIMARY KEY (restaurant_id)
);

-- ── orders ───────────────────────────────────────────────────
CREATE TABLE orders (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id         uuid        NOT NULL REFERENCES restaurants(id),

  -- Secuencia legible; junto con restaurant_id es única.
  order_number          integer,
  -- Clave de idempotencia proporcionada por el cliente.
  idempotency_key       text        NOT NULL,
  -- Hash del contenido del carrito para validación de idempotencia.
  cart_hash             text        NOT NULL,

  -- Datos del cliente.
  customer_name         text        NOT NULL
                        CHECK (char_length(customer_name) BETWEEN 1 AND 100),
  customer_phone        text        NOT NULL
                        CHECK (char_length(customer_phone) BETWEEN 5 AND 30),

  -- Modalidad de entrega.
  modality              text        NOT NULL
                        CHECK (modality IN ('pickup', 'delivery')),

  -- Snapshot de la zona de delivery.
  delivery_zone_id      uuid        REFERENCES delivery_zones(id),
  delivery_zone_name    text,
  delivery_address      text        CHECK (char_length(delivery_address) <= 300),
  delivery_fee_cents    integer     NOT NULL DEFAULT 0
                        CHECK (delivery_fee_cents >= 0),

  -- Snapshot del método de pago.
  payment_method_id     uuid        REFERENCES payment_methods(id),
  payment_method_name   text,
  payment_method_type   text,

  -- Notas del cliente.
  notes                 text        CHECK (char_length(notes) <= 500),

  -- Estado del pedido.
  status                text        NOT NULL DEFAULT 'received'
                        CHECK (status IN (
                          'received', 'accepted', 'preparing',
                          'ready', 'on_the_way', 'completed',
                          'rejected', 'cancelled'
                        )),

  -- Estado del pago.
  payment_status        text        NOT NULL DEFAULT 'pending'
                        CHECK (payment_status IN ('pending', 'confirmed', 'refunded')),

  -- Totales calculados en el servidor y almacenados como snapshot.
  subtotal_cents        integer     NOT NULL CHECK (subtotal_cents >= 0),
  total_cents           integer     NOT NULL CHECK (total_cents >= 0),

  -- Token de acceso para consulta pública sin autenticación.
  access_token_hash     text        NOT NULL,

  -- Hash de IP para auditoría de rate limiting (nunca expuesto al cliente).
  ip_hash               text,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  UNIQUE (restaurant_id, idempotency_key),
  UNIQUE (restaurant_id, order_number)
);

CREATE INDEX orders_restaurant_idx        ON orders (restaurant_id);
CREATE INDEX orders_status_idx            ON orders (restaurant_id, status);
CREATE INDEX orders_access_token_idx      ON orders (access_token_hash);
CREATE INDEX orders_created_at_idx        ON orders (restaurant_id, created_at DESC);

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── order_items ──────────────────────────────────────────────
-- Líneas del pedido. product_id y variant_id son snapshots —
-- sin FK — para preservar historial ante cambios de catálogo.
CREATE TABLE order_items (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          uuid        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  restaurant_id     uuid        NOT NULL REFERENCES restaurants(id),

  -- Snapshot de producto (sin FK al catálogo).
  product_id        uuid        NOT NULL,
  product_name      text        NOT NULL,

  -- Snapshot de variante (nullable).
  variant_id        uuid,
  variant_name      text,

  -- Precios calculados en el servidor.
  unit_price_cents  integer     NOT NULL CHECK (unit_price_cents >= 0),
  quantity          integer     NOT NULL CHECK (quantity BETWEEN 1 AND 20),
  subtotal_cents    integer     NOT NULL CHECK (subtotal_cents >= 0),

  -- Orden de presentación dentro del pedido.
  position          integer     NOT NULL DEFAULT 0
);

CREATE INDEX order_items_order_idx      ON order_items (order_id);
CREATE INDEX order_items_restaurant_idx ON order_items (restaurant_id);

-- ── order_item_options ───────────────────────────────────────
-- Opciones seleccionadas para cada línea. Snapshots sin FK
-- al catálogo por las mismas razones que order_items.
CREATE TABLE order_item_options (
  id                  uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id       uuid    NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  restaurant_id       uuid    NOT NULL REFERENCES restaurants(id),

  -- Snapshot del grupo y la opción (sin FK al catálogo).
  option_group_id     uuid    NOT NULL,
  option_group_name   text    NOT NULL,
  option_id           uuid    NOT NULL,
  option_name         text    NOT NULL,

  -- Diferencial de precio (positivo = recargo, negativo = descuento).
  price_delta_cents   integer NOT NULL DEFAULT 0
);

CREATE INDEX order_item_options_item_idx       ON order_item_options (order_item_id);
CREATE INDEX order_item_options_restaurant_idx ON order_item_options (restaurant_id);

-- ── order_status_events ──────────────────────────────────────
-- Log inmutable de transiciones de estado.
-- No tiene updated_at: los eventos de historial nunca se modifican.
CREATE TABLE order_status_events (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      uuid        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  restaurant_id uuid        NOT NULL REFERENCES restaurants(id),

  status        text        NOT NULL,
  note          text        CHECK (char_length(note) <= 500),

  -- UUID del miembro que realizó la acción (nullable para acciones del sistema).
  created_by    uuid,

  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX order_status_events_order_idx ON order_status_events (order_id);
