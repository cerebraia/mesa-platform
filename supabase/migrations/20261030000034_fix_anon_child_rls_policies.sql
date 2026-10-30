-- Migration 034: Fix broken anon RLS policies for catalog child tables
--
-- Migration 032 re-introduced the bug that migration 010 had fixed:
-- EXISTS subqueries inside the USING clause of child table policies
-- referenced products.is_published, products.is_available (revoked by
-- migration 009) and products.deleted_at (never granted to anon).
--
-- PostgreSQL allows RLS USING predicates to reference the queried table's
-- own columns without column-level SELECT, but cross-table subqueries DO
-- require column privileges on the referenced table. When anon executes
-- a nested PostgREST query (e.g. categories→products→product_variants),
-- the product_variants USING clause triggers an EXISTS on products with
-- revoked columns → permission error → 500 on all public catalog pages.
--
-- Fix: revert child policies to the approach established in migration 010
-- (omit revoked columns from EXISTS subqueries; rely on products_anon_select
-- to do the filtering). The products_anon_select policy CAN keep
-- "deleted_at IS NULL" because it references its own table's columns.

-- ── product_images ────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "product_images_anon_select" ON product_images;
CREATE POLICY "product_images_anon_select" ON product_images
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE id = product_id
      -- products_anon_select RLS restricts to is_published=true,
      -- is_available=true, deleted_at IS NULL transparently.
    )
  );

-- ── product_variants ──────────────────────────────────────────────────────

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

-- ── option_groups ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "option_groups_anon_select" ON option_groups;
CREATE POLICY "option_groups_anon_select" ON option_groups
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE id = product_id
    )
  );

-- ── options ───────────────────────────────────────────────────────────────
-- Migration 032 renamed the options policy to "option_groups_anon_select_options".
-- Drop that and restore the chain: options → option_groups (whose RLS
-- already enforces the products filter).

DROP POLICY IF EXISTS "option_groups_anon_select_options" ON options;
DROP POLICY IF EXISTS "options_anon_select"               ON options;
CREATE POLICY "options_anon_select" ON options
  FOR SELECT TO anon
  USING (
    is_available = true
    AND EXISTS (
      SELECT 1 FROM option_groups
      WHERE id = option_group_id
      -- option_groups_anon_select RLS already chains to products.
    )
  );
