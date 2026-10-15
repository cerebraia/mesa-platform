-- ============================================================
-- Mesa Platform · Migración 003 — RLS y permisos
-- ============================================================
-- Habilita Row Level Security en las cuatro tablas y define
-- políticas mínimas para la fase 2.
--
-- Principios aplicados:
--   · Las políticas que consultan restaurant_members usan las
--     funciones SECURITY DEFINER de la migración 002, nunca
--     una subconsulta directa (evita recursión y doble evaluación
--     de RLS sobre la misma tabla).
--   · Ninguna política confía en user_metadata editable.
--   · El usuario anónimo (anon) no puede leer tablas privadas.
--   · Ningún usuario puede concederse permisos de plataforma.
--   · Los cambios de rol en restaurant_members requieren ser
--     platform_admin (en fase 3 se añade gestión por owner).
--   · El campo 'verified' de dominios solo se activa mediante
--     operación de platform_admin.
--   · INSERT en restaurants es exclusivo de platform_admin;
--     las creaciones de negocio las inicia Luis desde el panel.
--   · DELETE está bloqueado; la suspensión usa UPDATE status.
--
-- Resumen por tabla:
--   restaurants        SELECT auth / UPDATE auth / INSERT auth
--   restaurant_members SELECT auth / INSERT auth / UPDATE auth / DELETE auth
--   platform_admins    SELECT auth / INSERT auth / DELETE auth
--   restaurant_domains SELECT auth / INSERT auth / UPDATE auth / DELETE auth
-- ============================================================

-- ── Activar RLS ───────────────────────────────────────────────
ALTER TABLE restaurants        ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_admins    ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_domains ENABLE ROW LEVEL SECURITY;

-- Asegurar que el propietario de la tabla (postgres/service_role)
-- no queda afectado: service_role siempre omite RLS en Supabase.
-- Los GRANTs de abajo abren las operaciones necesarias al rol
-- 'authenticated'; RLS filtra qué filas son accesibles.
-- El rol 'anon' no recibe ningún GRANT en estas tablas.

-- ── Permisos de tabla ─────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE ON restaurants        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON restaurant_members TO authenticated;
GRANT SELECT, INSERT, DELETE         ON platform_admins    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON restaurant_domains TO authenticated;

-- ════════════════════════════════════════════════════════════
-- restaurants
-- ════════════════════════════════════════════════════════════

-- SELECT: miembro activo del restaurante o platform_admin.
-- is_active_member() es SECURITY DEFINER: no dispara RLS de
-- restaurant_members, evitando recursión cruzada.
CREATE POLICY "restaurants_select" ON restaurants
  FOR SELECT TO authenticated
  USING (
    is_platform_admin()
    OR is_active_member(id)
  );

-- INSERT: solo platform_admin puede crear restaurantes.
CREATE POLICY "restaurants_insert" ON restaurants
  FOR INSERT TO authenticated
  WITH CHECK (is_platform_admin());

-- UPDATE: platform_admin o dueño activo del restaurante.
-- La restricción de columnas sensibles (status) se aplica en
-- la capa de aplicación; RLS solo controla acceso a la fila.
CREATE POLICY "restaurants_update" ON restaurants
  FOR UPDATE TO authenticated
  USING (
    is_platform_admin()
    OR member_role(id) = 'owner'
  )
  WITH CHECK (
    is_platform_admin()
    OR member_role(id) = 'owner'
  );

-- DELETE: bloqueado para todos los roles autenticados.
-- La suspensión del negocio usa UPDATE status = 'suspended'.
-- (Sin política FOR DELETE → acceso denegado.)

-- ── Protección de campos exclusivos de plataforma ─────────────
-- RLS protege filas, no columnas. Este trigger protege 'status'
-- de cambios por usuarios que no sean platform_admin.
-- Se añade aquí porque depende de is_platform_admin() (migración 002).
-- SECURITY INVOKER: corre como el usuario que ejecuta el UPDATE;
-- puede llamar is_platform_admin() porque authenticated tiene EXECUTE.
CREATE OR REPLACE FUNCTION guard_restaurant_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Solo los administradores de plataforma pueden cambiar el estado del restaurante.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

-- El trigger solo se activa cuando status realmente cambia (WHEN).
CREATE TRIGGER restaurants_guard_status
  BEFORE UPDATE ON restaurants
  FOR EACH ROW
  WHEN (NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION guard_restaurant_status();

-- ════════════════════════════════════════════════════════════
-- restaurant_members
-- ════════════════════════════════════════════════════════════

-- SELECT: cada usuario ve solo su propio registro o, si es
-- platform_admin, todos los registros.
-- Esta política NO usa is_active_member() para evitar recursión:
-- la comprobación directa user_id = auth.uid() no consulta
-- restaurant_members de nuevo.
CREATE POLICY "restaurant_members_select" ON restaurant_members
  FOR SELECT TO authenticated
  USING (
    is_platform_admin()
    OR user_id = auth.uid()
  );

-- INSERT: solo platform_admin (fase 2).
-- En fase 3 se añadirá una política que permita a los owners
-- invitar miembros con rol 'attention' o 'kitchen'.
CREATE POLICY "restaurant_members_insert" ON restaurant_members
  FOR INSERT TO authenticated
  WITH CHECK (is_platform_admin());

-- UPDATE: solo platform_admin, y nunca sobre el propio registro
-- (nadie puede cambiar su propio rol mediante una llamada autenticada).
CREATE POLICY "restaurant_members_update" ON restaurant_members
  FOR UPDATE TO authenticated
  USING (
    is_platform_admin()
    AND user_id <> auth.uid()
  )
  WITH CHECK (is_platform_admin());

-- DELETE: solo platform_admin, y nunca el propio registro.
CREATE POLICY "restaurant_members_delete" ON restaurant_members
  FOR DELETE TO authenticated
  USING (
    is_platform_admin()
    AND user_id <> auth.uid()
  );

-- ════════════════════════════════════════════════════════════
-- platform_admins
-- ════════════════════════════════════════════════════════════

-- SELECT: solo los propios platform_admins pueden ver la tabla.
-- is_platform_admin() es SECURITY DEFINER; no hay recursión porque
-- la función lee platform_admins omitiendo RLS.
CREATE POLICY "platform_admins_select" ON platform_admins
  FOR SELECT TO authenticated
  USING (is_platform_admin());

-- INSERT: un platform_admin puede añadir a otro,
-- pero no puede añadirse a sí mismo si ya existe.
-- El primer admin se crea mediante service_role (omite RLS).
CREATE POLICY "platform_admins_insert" ON platform_admins
  FOR INSERT TO authenticated
  WITH CHECK (
    is_platform_admin()
    AND user_id <> auth.uid()
  );

-- DELETE: un platform_admin puede eliminar a otro,
-- pero no a sí mismo (requiere al menos otro admin activo para operar).
CREATE POLICY "platform_admins_delete" ON platform_admins
  FOR DELETE TO authenticated
  USING (
    is_platform_admin()
    AND user_id <> auth.uid()
  );

-- UPDATE: bloqueado. Los registros de platform_admins no tienen
-- campos mutables en la fase 2.

-- ════════════════════════════════════════════════════════════
-- restaurant_domains
-- ════════════════════════════════════════════════════════════

-- SELECT: miembro activo del restaurante o platform_admin.
CREATE POLICY "restaurant_domains_select" ON restaurant_domains
  FOR SELECT TO authenticated
  USING (
    is_platform_admin()
    OR is_active_member(restaurant_id)
  );

-- INSERT: solo platform_admin puede registrar dominios.
CREATE POLICY "restaurant_domains_insert" ON restaurant_domains
  FOR INSERT TO authenticated
  WITH CHECK (is_platform_admin());

-- UPDATE: solo platform_admin. Garantiza que 'verified' solo se
-- activa mediante una operación administrativa autorizada.
CREATE POLICY "restaurant_domains_update" ON restaurant_domains
  FOR UPDATE TO authenticated
  USING    (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- DELETE: solo platform_admin.
CREATE POLICY "restaurant_domains_delete" ON restaurant_domains
  FOR DELETE TO authenticated
  USING (is_platform_admin());
