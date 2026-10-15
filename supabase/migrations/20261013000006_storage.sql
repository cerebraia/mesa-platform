-- ============================================================
-- Mesa Platform · Migración 006 — Storage bucket para imágenes
-- ============================================================
-- Bucket público "product-images":
--   · Acceso de lectura público (imágenes del menú son públicas).
--   · Solo owners pueden subir, actualizar y eliminar archivos.
--   · Rutas: {restaurant_id}/{product_id}-{uuid}.{ext}
--     El primer segmento identifica el restaurante para RLS.
--   · Validación de tipo MIME y tamaño se realiza también en el
--     servidor de aplicación (route handler) antes de llamar a
--     la API de Storage.
-- ============================================================

-- Crear (o actualizar) el bucket de imágenes de productos.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880,  -- 5 MiB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ── Storage RLS ───────────────────────────────────────────────
-- El bucket es público, pero la escritura requiere ser owner.
-- La ruta empieza con {restaurant_id}/ para identificar el negocio.

-- Lectura pública: el bucket ya es público, esta política es adicional.
CREATE POLICY "product_images_storage_select" ON storage.objects
  FOR SELECT TO anon
  USING (bucket_id = 'product-images');

CREATE POLICY "product_images_storage_select_auth" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'product-images');

-- Upload: solo owners del restaurante indicado en el primer segmento.
-- Ejemplo de path: "aaaaaaaa-0000-.../producto-uuid.webp"
CREATE POLICY "product_images_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND member_role(
      regexp_replace(name, '^([0-9a-f\-]{36})\/.*$', '\1')::uuid
    ) = 'owner'
  );

-- Actualizar metadatos del objeto (upsert de imagen).
CREATE POLICY "product_images_storage_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'product-images'
    AND member_role(
      regexp_replace(name, '^([0-9a-f\-]{36})\/.*$', '\1')::uuid
    ) = 'owner'
  )
  WITH CHECK (
    bucket_id = 'product-images'
    AND member_role(
      regexp_replace(name, '^([0-9a-f\-]{36})\/.*$', '\1')::uuid
    ) = 'owner'
  );

-- Eliminar: solo owner del restaurante.
CREATE POLICY "product_images_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'product-images'
    AND member_role(
      regexp_replace(name, '^([0-9a-f\-]{36})\/.*$', '\1')::uuid
    ) = 'owner'
  );
