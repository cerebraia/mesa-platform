-- ============================================================
-- Mesa Platform · Migración 005 — RLS del catálogo
-- ============================================================
-- Dos capas de acceso:
--
--   authenticated (panel privado):
--     SELECT  → cualquier miembro activo del restaurante.
--     INSERT/UPDATE/DELETE → solo owner del restaurante.
--     platform_admin tiene acceso total.
--
--   anon (menú público):
--     SELECT  → solo contenido publicado / activo.
--     Sin escritura.
--
-- Cache de rutas públicas: las claves deben incluir restaurant_id
-- y el estado de publicación para no compartir caché entre negocios.
-- ============================================================

-- ── Habilitar RLS ─────────────────────────────────────────────
ALTER TABLE categories      ENABLE ROW LEVEL SECURITY;
ALTER TABLE products        ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images  ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE option_groups   ENABLE ROW LEVEL SECURITY;
ALTER TABLE options         ENABLE ROW LEVEL SECURITY;

-- ── Permisos de tabla ─────────────────────────────────────────
-- authenticated: CRUD completo (RLS filtra por rol).
GRANT SELECT, INSERT, UPDATE, DELETE ON categories       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON products         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON product_images   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON product_variants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON option_groups    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON options          TO authenticated;

-- anon: solo lectura de contenido público.
GRANT SELECT ON categories       TO anon;
GRANT SELECT ON products         TO anon;
GRANT SELECT ON product_images   TO anon;
GRANT SELECT ON product_variants TO anon;
GRANT SELECT ON option_groups    TO anon;
GRANT SELECT ON options          TO anon;

-- El menú público también necesita leer el perfil del restaurante.
GRANT SELECT ON restaurants TO anon;

-- ════════════════════════════════════════════════════════════
-- categories
-- ════════════════════════════════════════════════════════════

-- Authenticated: miembro activo o platform_admin.
CREATE POLICY "categories_auth_select" ON categories
  FOR SELECT TO authenticated
  USING (is_platform_admin() OR is_active_member(restaurant_id));

-- Owner escribe; platform_admin puede hacer mantenimiento.
CREATE POLICY "categories_owner_insert" ON categories
  FOR INSERT TO authenticated
  WITH CHECK (is_platform_admin() OR member_role(restaurant_id) = 'owner');

CREATE POLICY "categories_owner_update" ON categories
  FOR UPDATE TO authenticated
  USING    (is_platform_admin() OR member_role(restaurant_id) = 'owner')
  WITH CHECK (is_platform_admin() OR member_role(restaurant_id) = 'owner');

CREATE POLICY "categories_owner_delete" ON categories
  FOR DELETE TO authenticated
  USING (is_platform_admin() OR member_role(restaurant_id) = 'owner');

-- Anon: solo categorías activas de restaurantes activos.
CREATE POLICY "categories_anon_select" ON categories
  FOR SELECT TO anon
  USING (is_active = true);

-- ════════════════════════════════════════════════════════════
-- restaurants (nueva política pública — aditiva a las existentes)
-- ════════════════════════════════════════════════════════════

-- Anon puede leer restaurantes activos para el menú público.
-- Solo campos públicos se exponen en la consulta del menú.
CREATE POLICY "restaurants_anon_select" ON restaurants
  FOR SELECT TO anon
  USING (status = 'active');

-- ════════════════════════════════════════════════════════════
-- products
-- ════════════════════════════════════════════════════════════

CREATE POLICY "products_auth_select" ON products
  FOR SELECT TO authenticated
  USING (is_platform_admin() OR is_active_member(restaurant_id));

CREATE POLICY "products_owner_insert" ON products
  FOR INSERT TO authenticated
  WITH CHECK (is_platform_admin() OR member_role(restaurant_id) = 'owner');

CREATE POLICY "products_owner_update" ON products
  FOR UPDATE TO authenticated
  USING    (is_platform_admin() OR member_role(restaurant_id) = 'owner')
  WITH CHECK (is_platform_admin() OR member_role(restaurant_id) = 'owner');

CREATE POLICY "products_owner_delete" ON products
  FOR DELETE TO authenticated
  USING (is_platform_admin() OR member_role(restaurant_id) = 'owner');

-- Anon: solo productos publicados y disponibles.
CREATE POLICY "products_anon_select" ON products
  FOR SELECT TO anon
  USING (is_published = true AND is_available = true);

-- ════════════════════════════════════════════════════════════
-- product_images
-- ════════════════════════════════════════════════════════════

CREATE POLICY "product_images_auth_select" ON product_images
  FOR SELECT TO authenticated
  USING (is_platform_admin() OR is_active_member(restaurant_id));

CREATE POLICY "product_images_owner_insert" ON product_images
  FOR INSERT TO authenticated
  WITH CHECK (is_platform_admin() OR member_role(restaurant_id) = 'owner');

CREATE POLICY "product_images_owner_update" ON product_images
  FOR UPDATE TO authenticated
  USING    (is_platform_admin() OR member_role(restaurant_id) = 'owner')
  WITH CHECK (is_platform_admin() OR member_role(restaurant_id) = 'owner');

CREATE POLICY "product_images_owner_delete" ON product_images
  FOR DELETE TO authenticated
  USING (is_platform_admin() OR member_role(restaurant_id) = 'owner');

-- Anon: imágenes de productos publicados.
CREATE POLICY "product_images_anon_select" ON product_images
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE id = product_id AND is_published = true AND is_available = true
    )
  );

-- ════════════════════════════════════════════════════════════
-- product_variants
-- ════════════════════════════════════════════════════════════

CREATE POLICY "product_variants_auth_select" ON product_variants
  FOR SELECT TO authenticated
  USING (is_platform_admin() OR is_active_member(restaurant_id));

CREATE POLICY "product_variants_owner_insert" ON product_variants
  FOR INSERT TO authenticated
  WITH CHECK (is_platform_admin() OR member_role(restaurant_id) = 'owner');

CREATE POLICY "product_variants_owner_update" ON product_variants
  FOR UPDATE TO authenticated
  USING    (is_platform_admin() OR member_role(restaurant_id) = 'owner')
  WITH CHECK (is_platform_admin() OR member_role(restaurant_id) = 'owner');

CREATE POLICY "product_variants_owner_delete" ON product_variants
  FOR DELETE TO authenticated
  USING (is_platform_admin() OR member_role(restaurant_id) = 'owner');

CREATE POLICY "product_variants_anon_select" ON product_variants
  FOR SELECT TO anon
  USING (
    is_available = true
    AND EXISTS (
      SELECT 1 FROM products
      WHERE id = product_id AND is_published = true AND is_available = true
    )
  );

-- ════════════════════════════════════════════════════════════
-- option_groups
-- ════════════════════════════════════════════════════════════

CREATE POLICY "option_groups_auth_select" ON option_groups
  FOR SELECT TO authenticated
  USING (is_platform_admin() OR is_active_member(restaurant_id));

CREATE POLICY "option_groups_owner_insert" ON option_groups
  FOR INSERT TO authenticated
  WITH CHECK (is_platform_admin() OR member_role(restaurant_id) = 'owner');

CREATE POLICY "option_groups_owner_update" ON option_groups
  FOR UPDATE TO authenticated
  USING    (is_platform_admin() OR member_role(restaurant_id) = 'owner')
  WITH CHECK (is_platform_admin() OR member_role(restaurant_id) = 'owner');

CREATE POLICY "option_groups_owner_delete" ON option_groups
  FOR DELETE TO authenticated
  USING (is_platform_admin() OR member_role(restaurant_id) = 'owner');

CREATE POLICY "option_groups_anon_select" ON option_groups
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE id = product_id AND is_published = true AND is_available = true
    )
  );

-- ════════════════════════════════════════════════════════════
-- options
-- ════════════════════════════════════════════════════════════

CREATE POLICY "options_auth_select" ON options
  FOR SELECT TO authenticated
  USING (is_platform_admin() OR is_active_member(restaurant_id));

CREATE POLICY "options_owner_insert" ON options
  FOR INSERT TO authenticated
  WITH CHECK (is_platform_admin() OR member_role(restaurant_id) = 'owner');

CREATE POLICY "options_owner_update" ON options
  FOR UPDATE TO authenticated
  USING    (is_platform_admin() OR member_role(restaurant_id) = 'owner')
  WITH CHECK (is_platform_admin() OR member_role(restaurant_id) = 'owner');

CREATE POLICY "options_owner_delete" ON options
  FOR DELETE TO authenticated
  USING (is_platform_admin() OR member_role(restaurant_id) = 'owner');

CREATE POLICY "options_anon_select" ON options
  FOR SELECT TO anon
  USING (
    is_available = true
    AND EXISTS (
      SELECT 1 FROM option_groups og
      JOIN products p ON p.id = og.product_id
      WHERE og.id = option_group_id
        AND p.is_published = true
        AND p.is_available = true
    )
  );
