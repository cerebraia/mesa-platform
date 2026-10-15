-- ============================================================
-- Mesa Platform · Migración 010 — Corrección de subqueries en RLS
-- ============================================================
-- Las políticas anon de product_images, product_variants,
-- option_groups y options contienen subconsultas EXISTS que
-- referencian products.is_published y products.is_available.
-- Tras la migración 009 (columnas revocadas), estas subconsultas
-- fallan porque son consultas visibles al usuario (no predicados
-- de fila), y anon no tiene SELECT en esas columnas.
--
-- Solución: eliminar las referencias explícitas a is_published
-- e is_available de las subconsultas. Las políticas de products
-- ya filtran a is_published = true AND is_available = true como
-- predicado de fila (RLS transparente, no requiere privilegio
-- de columna), por lo que la subconsulta EXISTS solo necesita
-- comprobar que el product_id existe en products.
--
-- El resultado es equivalente en seguridad: solo se devuelven
-- imágenes/variantes/grupos/opciones de productos publicados y
-- disponibles, pero sin que anon necesite SELECT en esos campos.
-- ============================================================

-- ── product_images ────────────────────────────────────────────
DROP POLICY IF EXISTS "product_images_anon_select" ON product_images;
CREATE POLICY "product_images_anon_select" ON product_images
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE id = product_id
      -- products RLS (products_anon_select) automatically restricts
      -- to is_published = true AND is_available = true via row predicate.
    )
  );

-- ── product_variants ──────────────────────────────────────────
-- is_available = true is a per-row predicate — works without column SELECT.
-- The EXISTS subquery no longer references revoked columns.
DROP POLICY IF EXISTS "product_variants_anon_select" ON product_variants;
CREATE POLICY "product_variants_anon_select" ON product_variants
  FOR SELECT TO anon
  USING (
    is_available = true
    AND EXISTS (
      SELECT 1 FROM products
      WHERE id = product_id
    )
  );

-- ── option_groups ─────────────────────────────────────────────
DROP POLICY IF EXISTS "option_groups_anon_select" ON option_groups;
CREATE POLICY "option_groups_anon_select" ON option_groups
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE id = product_id
    )
  );

-- ── options ───────────────────────────────────────────────────
-- is_available = true per-row predicate works without column SELECT.
-- The option_groups → products chain is walked without explicit
-- is_published/is_available references; RLS on each table filters.
DROP POLICY IF EXISTS "options_anon_select" ON options;
CREATE POLICY "options_anon_select" ON options
  FOR SELECT TO anon
  USING (
    is_available = true
    AND EXISTS (
      SELECT 1 FROM option_groups
      WHERE id = option_group_id
      -- option_groups RLS already restricts to published products.
    )
  );
