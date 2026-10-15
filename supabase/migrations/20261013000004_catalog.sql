-- ============================================================
-- Mesa Platform · Migración 004 — Tablas de catálogo
-- ============================================================
-- Entidades: categories, products, product_images,
--            product_variants, option_groups, options.
--
-- Diseño de integridad multiempresa:
--   Cada tabla lleva restaurant_id. Las relaciones padre→hijo
--   usan claves foráneas compuestas (id, restaurant_id) para que
--   PostgreSQL garantice que category, product, option_group y
--   option pertenezcan siempre al mismo restaurante.
--   Esto complementa RLS y evita referencias cruzadas incluso si
--   alguien elude la capa de aplicación.
--
-- Dinero en centavos (integer). Nunca float.
-- Orden gestionado por columna `position` (integer, 0-indexed).
-- ============================================================

-- ── categories ──────────────────────────────────────────────
CREATE TABLE categories (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid        NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name          text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  position      integer     NOT NULL DEFAULT 0,
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  -- Composite UNIQUE enables cross-restaurant FK checks from child tables.
  UNIQUE (id, restaurant_id)
);

CREATE INDEX categories_restaurant_idx ON categories (restaurant_id);
CREATE INDEX categories_active_idx     ON categories (restaurant_id) WHERE is_active = true;

-- ── products ────────────────────────────────────────────────
CREATE TABLE products (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id     uuid        NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  category_id       uuid        NOT NULL,
  name              text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 150),
  description       text        CHECK (char_length(description) <= 500),
  base_price_cents  integer     NOT NULL CHECK (base_price_cents >= 0),
  promo_price_cents integer     CHECK (promo_price_cents >= 0),
  is_available      boolean     NOT NULL DEFAULT true,
  is_published      boolean     NOT NULL DEFAULT false,
  position          integer     NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  -- Promo price must be lower than base price when set.
  CONSTRAINT products_promo_lt_base CHECK (
    promo_price_cents IS NULL OR promo_price_cents < base_price_cents
  ),

  -- Composite FK: ensures category belongs to the same restaurant.
  CONSTRAINT products_category_restaurant_fk
    FOREIGN KEY (category_id, restaurant_id)
    REFERENCES categories(id, restaurant_id)
    ON DELETE RESTRICT,

  -- Composite UNIQUE enables cross-restaurant FK checks from child tables.
  UNIQUE (id, restaurant_id)
);

CREATE INDEX products_restaurant_idx    ON products (restaurant_id);
CREATE INDEX products_category_idx      ON products (category_id);
CREATE INDEX products_published_idx     ON products (restaurant_id) WHERE is_published = true;

-- ── product_images ──────────────────────────────────────────
-- storage_path: path inside the 'product-images' Storage bucket.
-- Example: "{restaurant_id}/{product_id}/{uuid}.webp"
CREATE TABLE product_images (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    uuid        NOT NULL,
  restaurant_id uuid        NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  storage_path  text        NOT NULL CHECK (char_length(storage_path) BETWEEN 5 AND 500),
  alt_text      text        CHECK (char_length(alt_text) <= 200),
  position      integer     NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT product_images_product_restaurant_fk
    FOREIGN KEY (product_id, restaurant_id)
    REFERENCES products(id, restaurant_id)
    ON DELETE CASCADE
);

CREATE INDEX product_images_product_idx ON product_images (product_id);

-- ── product_variants ────────────────────────────────────────
-- Price variants (e.g. "Simple" $6.50 / "Doble" $9.50).
-- If no variants exist, the product uses base_price_cents.
CREATE TABLE product_variants (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    uuid        NOT NULL,
  restaurant_id uuid        NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name          text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  price_cents   integer     NOT NULL CHECK (price_cents >= 0),
  is_available  boolean     NOT NULL DEFAULT true,
  position      integer     NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT product_variants_product_restaurant_fk
    FOREIGN KEY (product_id, restaurant_id)
    REFERENCES products(id, restaurant_id)
    ON DELETE CASCADE
);

CREATE INDEX product_variants_product_idx ON product_variants (product_id);

-- ── option_groups ────────────────────────────────────────────
-- Named selection groups per product (e.g. "Elige pan", "Extras").
CREATE TABLE option_groups (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id     uuid        NOT NULL,
  restaurant_id  uuid        NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name           text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  min_selections integer     NOT NULL DEFAULT 0 CHECK (min_selections >= 0),
  max_selections integer     NOT NULL DEFAULT 1 CHECK (max_selections >= 1),
  position       integer     NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT option_groups_min_lte_max CHECK (min_selections <= max_selections),

  CONSTRAINT option_groups_product_restaurant_fk
    FOREIGN KEY (product_id, restaurant_id)
    REFERENCES products(id, restaurant_id)
    ON DELETE CASCADE,

  UNIQUE (id, restaurant_id)
);

CREATE INDEX option_groups_product_idx ON option_groups (product_id);

-- ── options ──────────────────────────────────────────────────
-- Individual options within a group.
-- price_delta_cents: surcharge (positive) or discount (negative).
CREATE TABLE options (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  option_group_id  uuid        NOT NULL,
  restaurant_id    uuid        NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name             text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  price_delta_cents integer    NOT NULL DEFAULT 0,
  is_available     boolean     NOT NULL DEFAULT true,
  position         integer     NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT options_group_restaurant_fk
    FOREIGN KEY (option_group_id, restaurant_id)
    REFERENCES option_groups(id, restaurant_id)
    ON DELETE CASCADE
);

CREATE INDEX options_group_idx ON options (option_group_id);

-- ── updated_at triggers ──────────────────────────────────────
CREATE TRIGGER categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER product_variants_updated_at
  BEFORE UPDATE ON product_variants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER option_groups_updated_at
  BEFORE UPDATE ON option_groups
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER options_updated_at
  BEFORE UPDATE ON options
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
