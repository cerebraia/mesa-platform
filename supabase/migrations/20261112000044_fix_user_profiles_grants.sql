-- ============================================================
-- Mesa Platform · Migración 044 — Corregir permisos de user_profiles
-- ============================================================
-- Contexto: al crear la tabla en Supabase se otorgaron todos los
-- privilegios a authenticated (y vía PUBLIC). La migración 041 solo
-- añadió los permisos necesarios (SELECT, INSERT, UPDATE) pero no
-- revocó los innecesarios: DELETE, REFERENCES, TRIGGER, TRUNCATE.
--
-- Permisos necesarios:
--   authenticated  → SELECT, INSERT, UPDATE
--     SELECT: leer el propio perfil (política user_profiles_select).
--     INSERT/UPDATE: necesarios para la política aunque el camino
--     real use service_role (platform_admin las tiene vía RLS).
--   anon           → ninguno (sin cambio, ya no tiene).
--   service_role   → todos (sin cambio; usa bypass de RLS).
--
-- Esta migración SOLO revoca; no vuelve a otorgar permisos existentes.
-- ============================================================

-- ── 1. Limpiar herencia de PUBLIC ──────────────────────────────
-- Por si algún grant llegó vía PUBLIC en algún entorno.
REVOKE DELETE, REFERENCES, TRIGGER, TRUNCATE
  ON user_profiles FROM PUBLIC;

-- ── 2. Revocar de authenticated los permisos innecesarios ──────
REVOKE DELETE, REFERENCES, TRIGGER, TRUNCATE
  ON user_profiles FROM authenticated;

-- ── 3. Verificación inline ─────────────────────────────────────
DO $$
DECLARE
  v_del   boolean;
  v_trunc boolean;
  v_trig  boolean;
  v_ref   boolean;
  v_sel   boolean;
  v_ins   boolean;
  v_upd   boolean;
BEGIN
  SELECT
    has_table_privilege('authenticated','user_profiles','delete'),
    has_table_privilege('authenticated','user_profiles','truncate'),
    has_table_privilege('authenticated','user_profiles','trigger'),
    has_table_privilege('authenticated','user_profiles','references'),
    has_table_privilege('authenticated','user_profiles','select'),
    has_table_privilege('authenticated','user_profiles','insert'),
    has_table_privilege('authenticated','user_profiles','update')
  INTO v_del, v_trunc, v_trig, v_ref, v_sel, v_ins, v_upd;

  IF v_del OR v_trunc OR v_trig OR v_ref THEN
    RAISE EXCEPTION
      'user_profiles: authenticated aún tiene privilegios innecesarios (del=%, trunc=%, trig=%, ref=%)',
      v_del, v_trunc, v_trig, v_ref;
  END IF;

  IF NOT (v_sel AND v_ins AND v_upd) THEN
    RAISE EXCEPTION
      'user_profiles: authenticated perdió privilegios necesarios (sel=%, ins=%, upd=%)',
      v_sel, v_ins, v_upd;
  END IF;

  RAISE NOTICE 'user_profiles grants OK — authenticated: select=%, insert=%, update=%; delete=%, truncate=%, trigger=%, references=%',
    v_sel, v_ins, v_upd, v_del, v_trunc, v_trig, v_ref;
END$$;
