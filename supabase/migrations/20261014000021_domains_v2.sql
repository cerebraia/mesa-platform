-- ============================================================
-- Mesa Platform · Migración 021 — Dominios v2
-- ============================================================
-- Cambios:
--
-- 1. restaurant_domains: añade columnas status, requested_by,
--    reviewed_by y updated_at.
--
-- 2. Trigger sync_domain_status: mantiene verified = (status='active')
--    y actualiza updated_at en cada INSERT/UPDATE.
--
-- 3. RLS INSERT: propietario puede registrar solicitudes
--    (kind='custom', status='requested'). La verificación real la
--    hace el administrador manualmente.
--
-- 4. RPC get_restaurant_slug_by_host: resolución de dominio para
--    el middleware de enrutamiento. Accesible a anon.
--
-- 5. RPC manage_restaurant_domain: activa o desconecta un dominio
--    (solo platform_admin). Registra auditoría sin secretos.
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- 1. Nuevas columnas en restaurant_domains
-- ════════════════════════════════════════════════════════════

ALTER TABLE restaurant_domains
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'requested'
  CHECK (status IN ('requested', 'pending_verification', 'active', 'disconnected'));

ALTER TABLE restaurant_domains
  ADD COLUMN IF NOT EXISTS requested_by uuid
  REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE restaurant_domains
  ADD COLUMN IF NOT EXISTS reviewed_by uuid
  REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE restaurant_domains
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Migrar datos existentes: verified=true → status='active'
UPDATE restaurant_domains
  SET status = 'active'
  WHERE verified = true AND status = 'requested';

-- Índice parcial en host para la ruta caliente del middleware
CREATE INDEX IF NOT EXISTS restaurant_domains_active_host_idx
  ON restaurant_domains (host)
  WHERE status = 'active';


-- ════════════════════════════════════════════════════════════
-- 2. Trigger: sincroniza verified con status y actualiza
--    updated_at en cada cambio.
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION sync_domain_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.verified   := (NEW.status = 'active');
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS restaurant_domains_sync ON restaurant_domains;

CREATE TRIGGER restaurant_domains_sync
  BEFORE INSERT OR UPDATE ON restaurant_domains
  FOR EACH ROW EXECUTE FUNCTION sync_domain_status();


-- ════════════════════════════════════════════════════════════
-- 3. RLS INSERT — propietario puede solicitar un dominio propio
-- ════════════════════════════════════════════════════════════

-- Eliminar la política de inserción actual (solo admins).
DROP POLICY IF EXISTS "restaurant_domains_insert" ON restaurant_domains;

-- La nueva política permite a los propietarios registrar solicitudes
-- de tipo 'custom' con estado inicial 'requested'.
-- El campo verified es controlado por trigger; no puede forzarse a true.
CREATE POLICY "restaurant_domains_insert" ON restaurant_domains
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Admin puede insertar con cualquier estado
    is_platform_admin()
    OR
    -- Propietario: solo dominios personalizados en estado 'requested'
    (
      member_role(restaurant_id) = 'owner'
      AND kind = 'custom'
      AND status = 'requested'
      AND verified = false   -- trigger garantiza esto; CHECK refuerza
    )
  );

-- Los propietarios también pueden cancelar sus propias solicitudes
-- pendientes (DELETE sobre sus dominios no-activos).
DROP POLICY IF EXISTS "restaurant_domains_delete" ON restaurant_domains;

CREATE POLICY "restaurant_domains_delete" ON restaurant_domains
  FOR DELETE TO authenticated
  USING (
    is_platform_admin()
    OR
    (
      member_role(restaurant_id) = 'owner'
      AND status IN ('requested', 'disconnected')
    )
  );

-- UPDATE: solo admins pueden cambiar estado y datos de verificación.
-- (política existente ya restringe a platform_admin; la redeclaramos
-- para dejarla explícita junto al resto de cambios de esta migración.)
DROP POLICY IF EXISTS "restaurant_domains_update" ON restaurant_domains;

CREATE POLICY "restaurant_domains_update" ON restaurant_domains
  FOR UPDATE TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());


-- ════════════════════════════════════════════════════════════
-- 4. RPC get_restaurant_slug_by_host
-- ════════════════════════════════════════════════════════════
-- Usada por el middleware de Next.js para resolver qué restaurante
-- corresponde a un host dado. Devuelve el slug si:
--   - El dominio está en estado 'active'.
--   - El restaurante vinculado está en status 'active'.
-- Devuelve NULL en cualquier otro caso.
--
-- Accesible a anon: el slug es información pública (aparece en /r/[slug]).
-- No devuelve restaurant_id ni ningún dato privado.
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_restaurant_slug_by_host(p_host text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.slug
  FROM restaurant_domains rd
  JOIN restaurants r ON r.id = rd.restaurant_id
  WHERE rd.host   = lower(trim(p_host))
    AND rd.status = 'active'
    AND r.status  = 'active'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION get_restaurant_slug_by_host(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_restaurant_slug_by_host(text) TO anon;
GRANT EXECUTE ON FUNCTION get_restaurant_slug_by_host(text) TO authenticated;


-- ════════════════════════════════════════════════════════════
-- 5. RPC manage_restaurant_domain (solo platform_admin)
-- ════════════════════════════════════════════════════════════
-- Activa, desconecta o marca como pendiente de verificación.
-- Registra auditoría en admin_audit_log (sin secretos).
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION manage_restaurant_domain(
  p_domain_id   uuid,
  p_new_status  text   -- 'active' | 'pending_verification' | 'disconnected'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_domain_row  restaurant_domains%ROWTYPE;
  v_admin_id    uuid;
BEGIN
  -- Solo platform_admin puede ejecutar esta función
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Acceso denegado: se requiere platform_admin'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_new_status NOT IN ('active', 'pending_verification', 'disconnected') THEN
    RAISE EXCEPTION 'Estado no válido: %', p_new_status
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT * INTO v_domain_row FROM restaurant_domains WHERE id = p_domain_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dominio no encontrado'
      USING ERRCODE = 'no_data_found';
  END IF;

  v_admin_id := auth.uid();

  UPDATE restaurant_domains
  SET status = p_new_status, reviewed_by = v_admin_id
  WHERE id = p_domain_id;

  -- Auditoría sin secretos
  INSERT INTO admin_audit_log (admin_user_id, action, target_type, target_id, details)
  VALUES (
    v_admin_id,
    'manage_domain',
    'restaurant',
    v_domain_row.restaurant_id,
    jsonb_build_object(
      'domain_id',   p_domain_id,
      'host',        v_domain_row.host,
      'kind',        v_domain_row.kind,
      'old_status',  v_domain_row.status,
      'new_status',  p_new_status
    )
  );

  RETURN jsonb_build_object(
    'success',    true,
    'domain_id',  p_domain_id,
    'new_status', p_new_status
  );
END;
$$;

REVOKE ALL ON FUNCTION manage_restaurant_domain(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION manage_restaurant_domain(uuid, text) TO authenticated;
