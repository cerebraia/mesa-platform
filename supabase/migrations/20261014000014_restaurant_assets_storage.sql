-- ============================================================
-- Mesa Platform · Migración 014 — Storage bucket para assets
-- ============================================================
-- Bucket "restaurant-assets": logos y portadas del restaurante.
-- · Público (las imágenes del menú son accesibles por los clientes).
-- · Solo owners pueden subir, reemplazar y eliminar archivos.
-- · Rutas: {restaurant_id}/logo/{uuid}.{ext}
--          {restaurant_id}/cover/{uuid}.{ext}
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'restaurant-assets',
  'restaurant-assets',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "restaurant_assets_select" ON storage.objects
  FOR SELECT TO anon
  USING (bucket_id = 'restaurant-assets');

CREATE POLICY "restaurant_assets_select_auth" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'restaurant-assets');

CREATE POLICY "restaurant_assets_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'restaurant-assets'
    AND member_role(
      regexp_replace(name, '^([0-9a-f\-]{36})\/.*$', '\1')::uuid
    ) = 'owner'
  );

CREATE POLICY "restaurant_assets_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'restaurant-assets'
    AND member_role(
      regexp_replace(name, '^([0-9a-f\-]{36})\/.*$', '\1')::uuid
    ) = 'owner'
  )
  WITH CHECK (
    bucket_id = 'restaurant-assets'
    AND member_role(
      regexp_replace(name, '^([0-9a-f\-]{36})\/.*$', '\1')::uuid
    ) = 'owner'
  );

CREATE POLICY "restaurant_assets_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'restaurant-assets'
    AND member_role(
      regexp_replace(name, '^([0-9a-f\-]{36})\/.*$', '\1')::uuid
    ) = 'owner'
  );
