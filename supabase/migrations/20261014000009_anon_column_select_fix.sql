-- ============================================================
-- Mesa Platform · Migración 009 — Columnas públicas para anon
-- ============================================================
-- La migración 008 revocó INSERT/UPDATE/DELETE de anon pero los
-- REVOKE SELECT (column) fueron no-ops: PostgreSQL no puede revocar
-- columnas individuales de un grant de tabla (ambos son objetos
-- distintos del catálogo).
--
-- La solución correcta:
--   1. REVOKE SELECT a nivel de tabla.
--   2. GRANT SELECT solo en las columnas destinadas al menú público.
--
-- Columnas que anon PUEDE leer (todas son campos del menú público):
--
--   restaurants:      id, name, slug, status, currency
--   categories:       id, restaurant_id, name, position
--   products:         id, restaurant_id, category_id, name, description,
--                     base_price_cents, promo_price_cents, position
--   product_images:   id, product_id, restaurant_id, storage_path, alt_text, position
--   product_variants: id, product_id, restaurant_id, name, price_cents, position
--   option_groups:    id, product_id, restaurant_id, name, min_selections, max_selections, position
--   options:          id, option_group_id, restaurant_id, name, price_delta_cents, position
--
-- restaurant_id / product_id / option_group_id se mantienen en las
-- tablas hijo porque PostgREST los necesita para las condiciones JOIN
-- de las claves foráneas compuestas.
--
-- Los campos omitidos:
--   · Timestamps (created_at, updated_at): business intelligence interno.
--   · is_active, is_published, is_available: siempre true en las filas
--     devueltas (RLS filtra). Ocultarlos evita que anon pueda consultar
--     el estado interno directamente.
--   · timezone: configuración interna del restaurante.
-- ============================================================

-- ── REVOKE tabla-level SELECT ────────────────────────────────
-- Esto elimina el acceso a todas las columnas; luego se concede
-- únicamente las columnas públicas.
REVOKE SELECT ON restaurants        FROM anon;
REVOKE SELECT ON categories         FROM anon;
REVOKE SELECT ON products           FROM anon;
REVOKE SELECT ON product_images     FROM anon;
REVOKE SELECT ON product_variants   FROM anon;
REVOKE SELECT ON option_groups      FROM anon;
REVOKE SELECT ON options            FROM anon;

-- ── GRANT SELECT solo en columnas públicas ───────────────────
GRANT SELECT (id, name, slug, status, currency)
  ON restaurants TO anon;

GRANT SELECT (id, restaurant_id, name, position)
  ON categories TO anon;

GRANT SELECT (id, restaurant_id, category_id, name, description,
              base_price_cents, promo_price_cents, position)
  ON products TO anon;

GRANT SELECT (id, product_id, restaurant_id, storage_path, alt_text, position)
  ON product_images TO anon;

GRANT SELECT (id, product_id, restaurant_id, name, price_cents, position)
  ON product_variants TO anon;

GRANT SELECT (id, product_id, restaurant_id, name, min_selections, max_selections, position)
  ON option_groups TO anon;

GRANT SELECT (id, option_group_id, restaurant_id, name, price_delta_cents, position)
  ON options TO anon;
