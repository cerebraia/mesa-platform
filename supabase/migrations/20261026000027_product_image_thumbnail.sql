-- ============================================================
-- Migration 027 — product_image_thumbnail
-- Añade thumbnail_path a product_images para almacenar la
-- versión recortada 1:1 de la miniatura de catálogo.
--
--   storage_path    = imagen original (para galería ampliada)
--   thumbnail_path  = recorte 1:1 generado en el cliente (para tarjeta)
--
-- Si thumbnail_path es null, la tarjeta usa storage_path con
-- object-fit: cover (comportamiento actual, sin ruptura).
-- ============================================================

ALTER TABLE product_images
  ADD COLUMN IF NOT EXISTS thumbnail_path TEXT;

-- Anon necesita leerlo para la tarjeta del catálogo.
GRANT SELECT (thumbnail_path) ON product_images TO anon;
