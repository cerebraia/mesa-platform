-- Migration 040: add original_path to product_images
--
-- Stores the first-uploaded file path so "Encuadrar" is reversible:
--   original_path  — first original upload; never deleted until the whole image is removed
--   storage_path   — current display version (original OR cleaned-after-frame)
--   thumbnail_path — 1:1 cropped square for catalog cards
--
-- When original_path IS NULL: image was never framed (storage_path is the original).
-- When original_path IS NOT NULL: image has been framed; "Restaurar" can recover it.
--
-- Column is owner-only (panel). anon SELECT on product_images is restricted to
-- specific columns via RLS (see migration 010 / 034), so no extra REVOKE needed.

ALTER TABLE product_images
  ADD COLUMN IF NOT EXISTS original_path TEXT DEFAULT NULL;

COMMENT ON COLUMN product_images.original_path IS
  'First original upload path. Set on first Encuadrar. Never deleted until removeProductImage.';
