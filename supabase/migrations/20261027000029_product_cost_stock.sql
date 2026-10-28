-- Migration 029: Product cost and stock tracking columns
-- Adds internal cost/stock fields to products and product_variants.
-- Also adds stock_adjustment_log to track stock changes over time.

-- ── Add columns to products ────────────────────────────────────────────────

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS cost_cents      integer,
  ADD COLUMN IF NOT EXISTS stock_quantity  integer,
  ADD COLUMN IF NOT EXISTS stock_alert     integer;

-- REVOKE cost/stock columns from anon (internal data — not shown in public catalog)
REVOKE SELECT (cost_cents, stock_quantity, stock_alert) ON products FROM anon;

-- ── Add columns to product_variants ───────────────────────────────────────

ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS cost_cents      integer,
  ADD COLUMN IF NOT EXISTS stock_quantity  integer,
  ADD COLUMN IF NOT EXISTS stock_alert     integer;

-- REVOKE from anon
REVOKE SELECT (cost_cents, stock_quantity, stock_alert) ON product_variants FROM anon;

-- ── stock_adjustment_log ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stock_adjustment_log (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   uuid        NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  product_id      uuid        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id      uuid        REFERENCES product_variants(id) ON DELETE SET NULL,
  delta           integer     NOT NULL,
  reason          text,
  new_quantity    integer     NOT NULL,
  created_by      uuid        REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stock_adj_log_product_idx
  ON stock_adjustment_log (product_id, created_at DESC);

CREATE INDEX IF NOT EXISTS stock_adj_log_restaurant_idx
  ON stock_adjustment_log (restaurant_id, created_at DESC);

-- ── RLS on stock_adjustment_log ────────────────────────────────────────────

ALTER TABLE stock_adjustment_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON stock_adjustment_log FROM anon;

GRANT SELECT, INSERT ON stock_adjustment_log TO authenticated;

CREATE POLICY "stock_adj_log_select"
  ON stock_adjustment_log
  FOR SELECT
  TO authenticated
  USING (
    is_platform_admin()
    OR member_role(restaurant_id) = 'owner'
  );

CREATE POLICY "stock_adj_log_insert"
  ON stock_adjustment_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    member_role(restaurant_id) = 'owner'
  );
