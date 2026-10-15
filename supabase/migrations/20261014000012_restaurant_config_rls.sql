-- ============================================================
-- Mesa Platform · Migración 012 — RLS configuración
-- ============================================================
-- Patrón establecido en migraciones 008-009:
-- · Revocar ALL de anon (Supabase lo concede por defecto).
-- · Conceder solo columnas públicas a anon.
-- · Authenticated: CRUD para owner / SELECT para demás miembros.
-- · platform_admin: acceso total.
--
-- Nota sobre timezone:
--   La columna restaurants.timezone puede ser actualizada por el owner
--   mediante la política restaurants_update ya existente. No se necesita
--   modificación adicional para habilitarlo.
-- ============================================================

-- ── Habilitar RLS ─────────────────────────────────────────────
ALTER TABLE restaurant_config  ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_hours     ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_zones     ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods    ENABLE ROW LEVEL SECURITY;

-- ── Revocar privilegios por defecto de anon ───────────────────
REVOKE ALL ON restaurant_config FROM anon;
REVOKE ALL ON business_hours    FROM anon;
REVOKE ALL ON delivery_zones    FROM anon;
REVOKE ALL ON payment_methods   FROM anon;

-- ── Permisos authenticated ────────────────────────────────────
GRANT SELECT, INSERT, UPDATE ON restaurant_config TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON business_hours  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON delivery_zones  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON payment_methods TO authenticated;

-- ════════════════════════════════════════════════════════════
-- restaurant_config
-- ════════════════════════════════════════════════════════════

CREATE POLICY "rc_auth_select" ON restaurant_config
  FOR SELECT TO authenticated
  USING (is_platform_admin() OR is_active_member(restaurant_id));

-- Solo owner actualiza configuración; platform_admin puede hacer ajustes.
CREATE POLICY "rc_owner_insert" ON restaurant_config
  FOR INSERT TO authenticated
  WITH CHECK (is_platform_admin() OR member_role(restaurant_id) = 'owner');

CREATE POLICY "rc_owner_update" ON restaurant_config
  FOR UPDATE TO authenticated
  USING    (is_platform_admin() OR member_role(restaurant_id) = 'owner')
  WITH CHECK (is_platform_admin() OR member_role(restaurant_id) = 'owner');

-- Anon: columnas públicas del menú.
-- closed_until y updated_at son campos internos de gestión.
GRANT SELECT (
  restaurant_id, description, logo_path, cover_path, primary_color,
  phone, whatsapp, instagram_url, facebook_url, twitter_url,
  address, pickup_enabled, pickup_address, pickup_notes,
  delivery_enabled, is_temporarily_closed, closed_message
) ON restaurant_config TO anon;

CREATE POLICY "rc_anon_select" ON restaurant_config
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM restaurants WHERE id = restaurant_id
      -- restaurants RLS (restaurants_anon_select) restricts to active restaurants.
    )
  );

-- ════════════════════════════════════════════════════════════
-- business_hours
-- ════════════════════════════════════════════════════════════

CREATE POLICY "bh_auth_select" ON business_hours
  FOR SELECT TO authenticated
  USING (is_platform_admin() OR is_active_member(restaurant_id));

CREATE POLICY "bh_owner_insert" ON business_hours
  FOR INSERT TO authenticated
  WITH CHECK (is_platform_admin() OR member_role(restaurant_id) = 'owner');

CREATE POLICY "bh_owner_update" ON business_hours
  FOR UPDATE TO authenticated
  USING    (is_platform_admin() OR member_role(restaurant_id) = 'owner')
  WITH CHECK (is_platform_admin() OR member_role(restaurant_id) = 'owner');

CREATE POLICY "bh_owner_delete" ON business_hours
  FOR DELETE TO authenticated
  USING (is_platform_admin() OR member_role(restaurant_id) = 'owner');

-- Anon: horarios necesarios para calcular abierto/cerrado.
-- Todos los campos son públicos (sin timestamps sensibles).
GRANT SELECT (id, restaurant_id, day_of_week, opens_at, closes_at, is_active)
  ON business_hours TO anon;

CREATE POLICY "bh_anon_select" ON business_hours
  FOR SELECT TO anon
  USING (
    is_active = true
    AND EXISTS (SELECT 1 FROM restaurants WHERE id = restaurant_id)
  );

-- ════════════════════════════════════════════════════════════
-- delivery_zones
-- ════════════════════════════════════════════════════════════

CREATE POLICY "dz_auth_select" ON delivery_zones
  FOR SELECT TO authenticated
  USING (is_platform_admin() OR is_active_member(restaurant_id));

CREATE POLICY "dz_owner_insert" ON delivery_zones
  FOR INSERT TO authenticated
  WITH CHECK (is_platform_admin() OR member_role(restaurant_id) = 'owner');

CREATE POLICY "dz_owner_update" ON delivery_zones
  FOR UPDATE TO authenticated
  USING    (is_platform_admin() OR member_role(restaurant_id) = 'owner')
  WITH CHECK (is_platform_admin() OR member_role(restaurant_id) = 'owner');

CREATE POLICY "dz_owner_delete" ON delivery_zones
  FOR DELETE TO authenticated
  USING (is_platform_admin() OR member_role(restaurant_id) = 'owner');

-- Anon: zonas activas para selección del comprador.
-- is_active, timestamps y campos internos no expuestos.
GRANT SELECT (id, restaurant_id, name, fee_cents, minimum_order_cents, position)
  ON delivery_zones TO anon;

CREATE POLICY "dz_anon_select" ON delivery_zones
  FOR SELECT TO anon
  USING (
    is_active = true
    AND EXISTS (SELECT 1 FROM restaurants WHERE id = restaurant_id)
  );

-- ════════════════════════════════════════════════════════════
-- payment_methods
-- ════════════════════════════════════════════════════════════

CREATE POLICY "pm_auth_select" ON payment_methods
  FOR SELECT TO authenticated
  USING (is_platform_admin() OR is_active_member(restaurant_id));

CREATE POLICY "pm_owner_insert" ON payment_methods
  FOR INSERT TO authenticated
  WITH CHECK (is_platform_admin() OR member_role(restaurant_id) = 'owner');

CREATE POLICY "pm_owner_update" ON payment_methods
  FOR UPDATE TO authenticated
  USING    (is_platform_admin() OR member_role(restaurant_id) = 'owner')
  WITH CHECK (is_platform_admin() OR member_role(restaurant_id) = 'owner');

CREATE POLICY "pm_owner_delete" ON payment_methods
  FOR DELETE TO authenticated
  USING (is_platform_admin() OR member_role(restaurant_id) = 'owner');

-- Anon: nombre y tipo para mostrar en checkout. Instrucciones NUNCA públicas.
GRANT SELECT (id, restaurant_id, name, type, position)
  ON payment_methods TO anon;

CREATE POLICY "pm_anon_select" ON payment_methods
  FOR SELECT TO anon
  USING (
    is_active = true
    AND EXISTS (SELECT 1 FROM restaurants WHERE id = restaurant_id)
  );
