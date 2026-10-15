-- ============================================================
-- Mesa Platform · Migración 002 — Funciones auxiliares
-- ============================================================
-- Todas las funciones que consultan tablas con RLS se definen
-- como SECURITY DEFINER con search_path fijo para evitar:
--   a) Recursión en políticas RLS.
--   b) Inyección de search_path (CWE-1321 en SQL).
--
-- La seguridad de is_platform_admin() e is_active_member()
-- descansa en que SECURITY DEFINER las ejecuta con los
-- privilegios del propietario de la función (postgres), lo que
-- les permite leer las tablas omitiendo RLS. auth.uid() sigue
-- leyendo los claims del JWT del usuario que hace la solicitud.
--
-- REVOKE + GRANT restringe la ejecución al rol 'authenticated'.
-- El rol 'anon' no puede llamar a estas funciones.
-- ============================================================

-- ── Trigger: actualizar updated_at ───────────────────────────
-- SECURITY INVOKER: no necesita privilegios elevados.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER restaurants_updated_at
  BEFORE UPDATE ON public.restaurants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── is_platform_admin() ──────────────────────────────────────
-- Devuelve true si el usuario autenticado está en platform_admins.
-- Usada en políticas RLS de restaurants, restaurant_members,
-- platform_admins y restaurant_domains.
-- No confía en user_metadata ni en claims editables por el usuario.
CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_admins
    WHERE user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION is_platform_admin() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION is_platform_admin() TO authenticated;

-- ── is_active_member(restaurant_id) ─────────────────────────
-- Devuelve true si el usuario autenticado tiene membresía activa
-- en el restaurante indicado.
-- Usada en políticas RLS de restaurants y restaurant_domains
-- para evitar que esas políticas consulten restaurant_members
-- directamente (lo cual desencadenaría sus propias políticas RLS).
CREATE OR REPLACE FUNCTION is_active_member(p_restaurant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.restaurant_members
    WHERE restaurant_id = p_restaurant_id
      AND user_id       = auth.uid()
      AND status        = 'active'
  );
$$;

REVOKE ALL ON FUNCTION is_active_member(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION is_active_member(uuid) TO authenticated;

-- ── member_role(restaurant_id) ───────────────────────────────
-- Devuelve el rol activo del usuario en el restaurante, o NULL
-- si no tiene membresía activa.
-- Usada en la política UPDATE de restaurants para permitir que
-- los owners actualicen su restaurante.
CREATE OR REPLACE FUNCTION member_role(p_restaurant_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.restaurant_members
  WHERE restaurant_id = p_restaurant_id
    AND user_id       = auth.uid()
    AND status        = 'active'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION member_role(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION member_role(uuid) TO authenticated;
