-- ============================================================
-- Mesa Platform · Migración 008 — Seguridad de columnas para anon
-- ============================================================
-- Supabase concede ALL PRIVILEGES a anon en todas las tablas del
-- schema public por defecto (ALTER DEFAULT PRIVILEGES). Esto hace
-- que anon pueda intentar INSERT/UPDATE/DELETE (bloqueados por RLS
-- al no existir políticas WITH CHECK para anon) y ver columnas
-- internas de gestión (timestamps, flags de publicación, config).
--
-- Esta migración corrige el estado sin tocar la lógica de negocio:
--
--   1. Tablas privadas (members, admins, domains):
--      REVOKE ALL desde anon. RLS ya bloquea filas; revocar el
--      privilegio devuelve "permission denied" en lugar de "0 rows",
--      comunicando explícitamente que el recurso no es público.
--
--   2. Tablas del catálogo y restaurants:
--      REVOKE INSERT, UPDATE, DELETE — anon nunca debe escribir.
--      REVOKE SELECT en columnas internas: timestamps, flags de
--      estado (is_active, is_published, is_available), y timezone.
--      Se conserva restaurant_id en tablas hijo porque es parte de
--      la FK compuesta que PostgREST usa internamente para el join.
--
-- Tras esta migración, anon solo puede:
--   · SELECT campos públicos del menú (sin timestamps ni flags).
--   · No puede escribir en ninguna tabla.
--   · No puede acceder a tablas privadas en absoluto.
-- ============================================================

-- ── Tablas privadas: revocar todo acceso para anon ────────────
REVOKE ALL ON restaurant_members  FROM anon;
REVOKE ALL ON platform_admins     FROM anon;
REVOKE ALL ON restaurant_domains  FROM anon;

-- ── Catálogo: solo lectura, sin campos internos ───────────────

-- restaurants: mantener id, name, slug, status, currency
REVOKE INSERT, UPDATE, DELETE ON restaurants FROM anon;
REVOKE SELECT (timezone, created_at, updated_at) ON restaurants FROM anon;

-- categories: mantener id, restaurant_id, name, position
REVOKE INSERT, UPDATE, DELETE ON categories FROM anon;
REVOKE SELECT (is_active, created_at, updated_at) ON categories FROM anon;

-- products: mantener id, restaurant_id, category_id, name, description,
--           base_price_cents, promo_price_cents, position
REVOKE INSERT, UPDATE, DELETE ON products FROM anon;
REVOKE SELECT (is_published, is_available, created_at, updated_at) ON products FROM anon;

-- product_images: mantener id, product_id, restaurant_id, storage_path, alt_text, position
-- restaurant_id se mantiene porque la FK compuesta lo requiere para el join de PostgREST.
REVOKE INSERT, UPDATE, DELETE ON product_images FROM anon;
REVOKE SELECT (created_at) ON product_images FROM anon;

-- product_variants: mantener id, product_id, restaurant_id, name, price_cents, position
-- is_available siempre es true para las filas devueltas (RLS lo filtra).
REVOKE INSERT, UPDATE, DELETE ON product_variants FROM anon;
REVOKE SELECT (is_available, created_at, updated_at) ON product_variants FROM anon;

-- option_groups: mantener id, product_id, restaurant_id, name, min_selections, max_selections, position
REVOKE INSERT, UPDATE, DELETE ON option_groups FROM anon;
REVOKE SELECT (created_at, updated_at) ON option_groups FROM anon;

-- options: mantener id, option_group_id, restaurant_id, name, price_delta_cents, position
-- is_available siempre es true para las filas devueltas (RLS lo filtra).
REVOKE INSERT, UPDATE, DELETE ON options FROM anon;
REVOKE SELECT (is_available, created_at, updated_at) ON options FROM anon;
