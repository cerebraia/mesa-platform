-- ============================================================
-- Mesa Platform · Migración 011 — Configuración del restaurante
-- ============================================================
-- Cuatro tablas nuevas; ninguna modifica las existentes.
--
--   restaurant_config   1:1 con restaurants — identidad y operación
--   business_hours      1:N — intervalos de horario por día de semana
--   delivery_zones      1:N — zonas de delivery con tarifa y mínimo
--   payment_methods     1:N — medios de pago con instrucciones privadas
--
-- Decisiones de modelo:
-- · restaurant_config.restaurant_id es PK (garantiza 1:1).
-- · Horarios: closes_at < opens_at indica cruce de medianoche
--   (ej. 22:00 → 02:00). Varios intervalos por día son válidos.
-- · Dinero en centavos.
-- · payment_methods.instructions es campo privado; no se expone a anon.
-- · status, currency y suscripción siguen reservados a plataforma.
-- ============================================================

-- ── restaurant_config ────────────────────────────────────────
CREATE TABLE restaurant_config (
  restaurant_id         uuid        PRIMARY KEY
                        REFERENCES restaurants(id) ON DELETE CASCADE,
  description           text        CHECK (char_length(description)     <= 300),
  logo_path             text        CHECK (char_length(logo_path)        <= 500),
  cover_path            text        CHECK (char_length(cover_path)       <= 500),
  primary_color         text        CHECK (primary_color ~ '^#[0-9a-fA-F]{6}$'),
  phone                 text        CHECK (char_length(phone)            <= 30),
  whatsapp              text        CHECK (char_length(whatsapp)         <= 30),
  instagram_url         text        CHECK (char_length(instagram_url)    <= 200),
  facebook_url          text        CHECK (char_length(facebook_url)     <= 200),
  twitter_url           text        CHECK (char_length(twitter_url)      <= 200),
  address               text        CHECK (char_length(address)          <= 300),
  pickup_enabled        boolean     NOT NULL DEFAULT false,
  pickup_address        text        CHECK (char_length(pickup_address)   <= 300),
  pickup_notes          text        CHECK (char_length(pickup_notes)     <= 500),
  delivery_enabled      boolean     NOT NULL DEFAULT false,
  is_temporarily_closed boolean     NOT NULL DEFAULT false,
  closed_until          timestamptz,
  closed_message        text        CHECK (char_length(closed_message)   <= 200),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- ── business_hours ───────────────────────────────────────────
-- day_of_week: 0=domingo … 6=sábado (igual que EXTRACT(DOW ...)).
-- Varios intervalos por día son válidos (ej. almuerzo + cena).
-- Cruce de medianoche: closes_at < opens_at (ej. 22:00 → 02:00).
CREATE TABLE business_hours (
  id            uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid      NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  day_of_week   smallint  NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  opens_at      time      NOT NULL,
  closes_at     time      NOT NULL,
  is_active     boolean   NOT NULL DEFAULT true,
  UNIQUE (restaurant_id, day_of_week, opens_at)
);

CREATE INDEX business_hours_restaurant_idx ON business_hours (restaurant_id);

-- ── delivery_zones ────────────────────────────────────────────
CREATE TABLE delivery_zones (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id        uuid        NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name                 text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  fee_cents            integer     NOT NULL CHECK (fee_cents >= 0),
  minimum_order_cents  integer     NOT NULL DEFAULT 0
                       CHECK (minimum_order_cents >= 0),
  is_active            boolean     NOT NULL DEFAULT true,
  position             integer     NOT NULL DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX delivery_zones_restaurant_idx ON delivery_zones (restaurant_id);
CREATE INDEX delivery_zones_active_idx     ON delivery_zones (restaurant_id)
  WHERE is_active = true;

-- ── payment_methods ───────────────────────────────────────────
-- instructions: privado — se mostrará al comprador en el checkout,
-- no debe incluirse en consultas públicas generales del menú.
CREATE TABLE payment_methods (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid        NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name          text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  type          text        NOT NULL
                CHECK (type IN ('cash','transfer','mobile_payment','card','other')),
  instructions  text        CHECK (char_length(instructions) <= 1000),
  is_active     boolean     NOT NULL DEFAULT true,
  position      integer     NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX payment_methods_restaurant_idx ON payment_methods (restaurant_id);

-- ── updated_at triggers ───────────────────────────────────────
CREATE TRIGGER restaurant_config_updated_at
  BEFORE UPDATE ON restaurant_config
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER delivery_zones_updated_at
  BEFORE UPDATE ON delivery_zones
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER payment_methods_updated_at
  BEFORE UPDATE ON payment_methods
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
