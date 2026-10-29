-- Migration 031: Allow products without price (draft support)
-- Makes base_price_cents nullable so products can be saved as drafts
-- before a price is confirmed. is_published remains false for these.
-- promo_price_cents already nullable; existing NOT NULL constraint on
-- base_price_cents is the only blocker for draft products.

ALTER TABLE products
  ALTER COLUMN base_price_cents DROP NOT NULL;

-- Keep the existing >= 0 check; it only fires when value is not null
-- (PostgreSQL CHECK constraints accept NULL values by default).
-- No data loss: existing rows with integer prices are unaffected.

-- Also relax the promo price comparison constraint to handle null base
-- (existing constraint already handles this via IS NULL OR comparison,
--  so no change needed there).

COMMENT ON COLUMN products.base_price_cents IS
  'Price in cents. NULL = draft (price not yet set). is_published must be false when NULL.';
