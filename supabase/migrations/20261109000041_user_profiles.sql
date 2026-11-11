-- ============================================================
-- Mesa Platform · Migración 041 — Perfiles de usuario
-- ============================================================
-- Almacena nombre y apellido de las cuentas de Auth.
-- Gestionado exclusivamente por platform_admin; no afecta permisos.
--
-- Decisiones:
--   · user_id es la clave primaria y referencia a auth.users;
--     ON DELETE CASCADE evita huérfanos.
--   · Columnas nullable: el perfil es opcional. Existir sin
--     first_name/last_name es válido.
--   · NOT STORED en user_metadata (editable por el usuario). El
--     nombre vive en esta tabla del esquema público con RLS.
--   · INSERT/UPDATE solo accesible para platform_admin (via
--     service_role en las Server Actions; authenticated queda
--     bloqueado por las políticas para escribir filas ajenas).
--   · SELECT: cada usuario ve su propio registro; platform_admin
--     ve todos (necesario para la vista /admin/usuarios).
-- ============================================================

CREATE TABLE user_profiles (
  user_id    uuid        PRIMARY KEY
             REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text        CHECK (first_name IS NULL
                             OR char_length(trim(first_name)) BETWEEN 1 AND 100),
  last_name  text        CHECK (last_name  IS NULL
                             OR char_length(trim(last_name))  BETWEEN 1 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  user_profiles            IS 'Optional first/last name for Auth users. Managed by platform_admin only.';
COMMENT ON COLUMN user_profiles.user_id    IS 'References auth.users(id). Cascade-deleted with the Auth user.';
COMMENT ON COLUMN user_profiles.first_name IS 'Given name. NULL when not yet set.';
COMMENT ON COLUMN user_profiles.last_name  IS 'Family name. NULL when not yet set.';

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Anon has no access; authenticated only via RLS policies below.
REVOKE ALL ON user_profiles FROM anon;
GRANT SELECT, INSERT, UPDATE ON user_profiles TO authenticated;

-- SELECT: propio registro o platform_admin.
CREATE POLICY "user_profiles_select" ON user_profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_platform_admin());

-- INSERT: solo platform_admin. Las Server Actions usan
-- service_role (omite RLS); esta política protege la ruta
-- authenticated en caso de acceso directo a la API.
CREATE POLICY "user_profiles_insert" ON user_profiles
  FOR INSERT TO authenticated
  WITH CHECK (is_platform_admin());

-- UPDATE: solo platform_admin, y no el propio registro para
-- evitar que un admin se reescriba el nombre via authenticated.
CREATE POLICY "user_profiles_update" ON user_profiles
  FOR UPDATE TO authenticated
  USING  (is_platform_admin())
  WITH CHECK (is_platform_admin());
