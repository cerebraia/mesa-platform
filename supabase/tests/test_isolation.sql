-- ============================================================
-- Mesa Platform · Pruebas de aislamiento RLS
-- ============================================================
-- Requisitos previos:
--   · supabase start (Supabase local corriendo)
--   · Migraciones aplicadas: supabase db reset
--   · Seed de prueba ejecutado con UUIDs reales
--   · Sustituir las constantes del bloque siguiente
--
-- Ejecución:
--   psql "postgresql://postgres:postgres@localhost:54322/postgres" \
--     -v OWNER_ALFA='<uuid>' \
--     -v ATTENTION_ALFA='<uuid>' \
--     -v OWNER_BETA='<uuid>' \
--     -v ADMIN='<uuid>' \
--     -f supabase/tests/test_isolation.sql
--
-- Resultado esperado:
--   Cada bloque imprime "OK" si la prueba pasa, "FALLO" si no.
--   Ningún bloque debe lanzar una excepción no controlada.
-- ============================================================

-- ── Constantes (sustituir manualmente si no se usa -v) ────────
\set RESTAURANT_ALFA 'aaaaaaaa-0000-0000-0000-000000000001'
\set RESTAURANT_BETA 'bbbbbbbb-0000-0000-0000-000000000002'
-- \set OWNER_ALFA     '<uuid-owner-alfa>'
-- \set ATTENTION_ALFA '<uuid-attention-alfa>'
-- \set OWNER_BETA     '<uuid-owner-beta>'
-- \set ADMIN          '<uuid-admin>'

-- ============================================================
-- Prueba 1: owner de Alfa no puede ver datos de Beta
-- Resultado esperado: 0 filas de Beta, 1 fila de Alfa.
-- ============================================================
BEGIN;
  SELECT set_config(
    'request.jwt.claims',
    json_build_object('sub', :'OWNER_ALFA', 'role', 'authenticated')::text,
    true
  );
  SET LOCAL ROLE authenticated;

  -- Debe devolver exactamente 1 fila (solo Alfa).
  DO $$
  DECLARE v_count int;
  BEGIN
    SELECT count(*) INTO v_count FROM restaurants;
    IF v_count = 1 THEN
      RAISE NOTICE 'Prueba 1a PASS: owner de Alfa ve solo 1 restaurante.';
    ELSE
      RAISE WARNING 'Prueba 1a FALLO: owner de Alfa ve % restaurantes.', v_count;
    END IF;
  END;
  $$;

  -- Debe devolver 0 filas (no tiene acceso a Beta).
  DO $$
  DECLARE v_count int;
  BEGIN
    SELECT count(*) INTO v_count
    FROM restaurants
    WHERE id = 'bbbbbbbb-0000-0000-0000-000000000002';
    IF v_count = 0 THEN
      RAISE NOTICE 'Prueba 1b PASS: owner de Alfa no puede ver Restaurante Beta.';
    ELSE
      RAISE WARNING 'Prueba 1b FALLO: owner de Alfa ve Restaurante Beta.';
    END IF;
  END;
  $$;
ROLLBACK;

-- ============================================================
-- Prueba 2: owner de Alfa no puede insertar miembros (fase 2)
-- Resultado esperado: INSERT falla (sin política INSERT para no-admin).
-- ============================================================
BEGIN;
  SELECT set_config(
    'request.jwt.claims',
    json_build_object('sub', :'OWNER_ALFA', 'role', 'authenticated')::text,
    true
  );
  SET LOCAL ROLE authenticated;

  DO $$
  BEGIN
    BEGIN
      INSERT INTO restaurant_members (restaurant_id, user_id, role, status)
      VALUES (
        'aaaaaaaa-0000-0000-0000-000000000001',
        gen_random_uuid(),
        'kitchen',
        'active'
      );
      RAISE WARNING 'Prueba 2 FALLO: owner de Alfa pudo insertar un miembro.';
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Prueba 2 PASS: INSERT de miembro denegado para owner de Alfa (%).',
        SQLERRM;
    END;
  END;
  $$;
ROLLBACK;

-- ============================================================
-- Prueba 3: owner de Alfa no puede ver membresías de Beta
-- Resultado esperado: SELECT en restaurant_members filtra a user_id propio.
-- ============================================================
BEGIN;
  SELECT set_config(
    'request.jwt.claims',
    json_build_object('sub', :'OWNER_ALFA', 'role', 'authenticated')::text,
    true
  );
  SET LOCAL ROLE authenticated;

  DO $$
  DECLARE v_count int;
  BEGIN
    SELECT count(*) INTO v_count
    FROM restaurant_members
    WHERE restaurant_id = 'bbbbbbbb-0000-0000-0000-000000000002';
    IF v_count = 0 THEN
      RAISE NOTICE 'Prueba 3 PASS: owner de Alfa no ve membresías de Beta.';
    ELSE
      RAISE WARNING 'Prueba 3 FALLO: owner de Alfa ve % membresías de Beta.', v_count;
    END IF;
  END;
  $$;
ROLLBACK;

-- ============================================================
-- Prueba 4: ningún usuario autenticado puede asignarse platform_admin
-- Resultado esperado: INSERT en platform_admins falla.
-- ============================================================
BEGIN;
  SELECT set_config(
    'request.jwt.claims',
    json_build_object('sub', :'OWNER_ALFA', 'role', 'authenticated')::text,
    true
  );
  SET LOCAL ROLE authenticated;

  DO $$
  BEGIN
    BEGIN
      INSERT INTO platform_admins (user_id)
      VALUES (:'OWNER_ALFA');
      RAISE WARNING 'Prueba 4 FALLO: usuario se asignó platform_admin.';
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Prueba 4 PASS: INSERT en platform_admins denegado (%).', SQLERRM;
    END;
  END;
  $$;
ROLLBACK;

-- ============================================================
-- Prueba 5: attention de Alfa no puede gestionar miembros
-- Resultado esperado: INSERT de miembro denegado; solo ve su propia membresía.
-- ============================================================
BEGIN;
  SELECT set_config(
    'request.jwt.claims',
    json_build_object('sub', :'ATTENTION_ALFA', 'role', 'authenticated')::text,
    true
  );
  SET LOCAL ROLE authenticated;

  -- Solo debe ver su propia membresía en Alfa (1 fila).
  DO $$
  DECLARE v_count int;
  BEGIN
    SELECT count(*) INTO v_count FROM restaurant_members;
    IF v_count = 1 THEN
      RAISE NOTICE 'Prueba 5a PASS: attention de Alfa ve solo su membresía.';
    ELSE
      RAISE WARNING 'Prueba 5a FALLO: attention de Alfa ve % membresías.', v_count;
    END IF;
  END;
  $$;

  -- INSERT debe fallar.
  DO $$
  BEGIN
    BEGIN
      INSERT INTO restaurant_members (restaurant_id, user_id, role, status)
      VALUES (
        'aaaaaaaa-0000-0000-0000-000000000001',
        gen_random_uuid(),
        'kitchen',
        'active'
      );
      RAISE WARNING 'Prueba 5b FALLO: attention de Alfa pudo insertar un miembro.';
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Prueba 5b PASS: INSERT de miembro denegado para attention (%).', SQLERRM;
    END;
  END;
  $$;
ROLLBACK;

-- ============================================================
-- Prueba 6: usuario anónimo no puede leer datos privados
-- Resultado esperado: 0 filas en todas las tablas (RLS),
-- o permission denied si anon no tiene GRANT (ambos son PASS).
-- ============================================================
BEGIN;
  SET LOCAL ROLE anon;

  DO $$
  DECLARE
    v_r  int := 0;
    v_rm int := 0;
    v_pa int := 0;
    v_rd int := 0;
    v_has_access boolean := true;
  BEGIN
    BEGIN
      SELECT count(*) INTO v_r  FROM restaurants;
      SELECT count(*) INTO v_rm FROM restaurant_members;
      SELECT count(*) INTO v_pa FROM platform_admins;
      SELECT count(*) INTO v_rd FROM restaurant_domains;
    EXCEPTION WHEN insufficient_privilege THEN
      v_has_access := false;
      RAISE NOTICE 'Prueba 6 PASS: anon denegado a nivel de tabla (permission denied).';
    END;

    IF v_has_access THEN
      IF v_r = 0 AND v_rm = 0 AND v_pa = 0 AND v_rd = 0 THEN
        RAISE NOTICE 'Prueba 6 PASS: anon no ve datos (RLS bloqueó todo).';
      ELSE
        RAISE WARNING
          'Prueba 6 FALLO: anon ve % restaurants, % members, % admins, % domains.',
          v_r, v_rm, v_pa, v_rd;
      END IF;
    END IF;
  END;
  $$;
ROLLBACK;

-- ============================================================
-- Prueba 7: platform_admin puede ver todos los datos
-- Resultado esperado: ≥2 restaurantes, todas las membresías.
-- ============================================================
BEGIN;
  SELECT set_config(
    'request.jwt.claims',
    json_build_object('sub', :'ADMIN', 'role', 'authenticated')::text,
    true
  );
  SET LOCAL ROLE authenticated;

  DO $$
  DECLARE v_r int; v_rm int;
  BEGIN
    SELECT count(*) INTO v_r  FROM restaurants;
    SELECT count(*) INTO v_rm FROM restaurant_members;
    IF v_r >= 2 AND v_rm >= 4 THEN
      RAISE NOTICE 'Prueba 7 PASS: admin ve % restaurantes y % miembros.', v_r, v_rm;
    ELSE
      RAISE WARNING 'Prueba 7: admin ve % restaurantes y % miembros (revisar seed).', v_r, v_rm;
    END IF;
  END;
  $$;
ROLLBACK;

-- ============================================================
-- Prueba 8: platform_admin no puede eliminar su propia entrada
-- Resultado esperado: DELETE no afecta filas (RLS filtra la fila,
-- no lanza excepción — se comprueba con GET DIAGNOSTICS).
-- ============================================================
BEGIN;
  SELECT set_config(
    'request.jwt.claims',
    json_build_object('sub', :'ADMIN', 'role', 'authenticated')::text,
    true
  );
  SET LOCAL ROLE authenticated;

  DO $$
  DECLARE v_admin uuid := :'ADMIN'; v_rows int;
  BEGIN
    DELETE FROM platform_admins WHERE user_id = v_admin;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 0 THEN
      RAISE NOTICE 'Prueba 8 PASS: admin no puede eliminarse a sí mismo (0 filas afectadas).';
    ELSE
      RAISE WARNING 'Prueba 8 FALLO: admin se eliminó a sí mismo (% filas).', v_rows;
    END IF;
  END;
  $$;
ROLLBACK;

-- ============================================================
-- Prueba 9: owner de Alfa puede actualizar su restaurante
-- Resultado esperado: UPDATE exitoso en Alfa, denegado en Beta.
-- ============================================================
BEGIN;
  SELECT set_config(
    'request.jwt.claims',
    json_build_object('sub', :'OWNER_ALFA', 'role', 'authenticated')::text,
    true
  );
  SET LOCAL ROLE authenticated;

  DO $$
  DECLARE v_rows int;
  BEGIN
    -- Actualizar nombre de Alfa (debe funcionar).
    UPDATE restaurants
    SET name = 'Restaurante Alfa Actualizado'
    WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001';
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 1 THEN
      RAISE NOTICE 'Prueba 9a PASS: owner de Alfa actualizó su restaurante.';
    ELSE
      RAISE WARNING 'Prueba 9a FALLO: owner de Alfa no pudo actualizar su restaurante.';
    END IF;

    -- Intentar actualizar Beta (debe devolver 0 filas afectadas).
    UPDATE restaurants
    SET name = 'Restaurante Beta Hackeado'
    WHERE id = 'bbbbbbbb-0000-0000-0000-000000000002';
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 0 THEN
      RAISE NOTICE 'Prueba 9b PASS: owner de Alfa no pudo modificar Restaurante Beta.';
    ELSE
      RAISE WARNING 'Prueba 9b FALLO: owner de Alfa modificó Restaurante Beta.';
    END IF;
  END;
  $$;
ROLLBACK;

-- ============================================================
-- Prueba 10: verificación de dominios solo por platform_admin
-- Resultado esperado: UPDATE de verified denegado para owner.
-- ============================================================
BEGIN;
  SELECT set_config(
    'request.jwt.claims',
    json_build_object('sub', :'OWNER_ALFA', 'role', 'authenticated')::text,
    true
  );
  SET LOCAL ROLE authenticated;

  DO $$
  DECLARE v_rows int;
  BEGIN
    UPDATE restaurant_domains
    SET verified = true
    WHERE restaurant_id = 'aaaaaaaa-0000-0000-0000-000000000001';
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 0 THEN
      RAISE NOTICE 'Prueba 10 PASS: owner de Alfa no pudo activar verified en dominios.';
    ELSE
      RAISE WARNING 'Prueba 10 FALLO: owner de Alfa activó verified en % dominios.', v_rows;
    END IF;
  END;
  $$;
ROLLBACK;

-- ============================================================
-- Prueba 11: owner no puede cambiar el campo status del restaurante
-- Resultado esperado: UPDATE de status lanza insufficient_privilege.
-- ============================================================
BEGIN;
  SELECT set_config(
    'request.jwt.claims',
    json_build_object('sub', :'OWNER_ALFA', 'role', 'authenticated')::text,
    true
  );
  SET LOCAL ROLE authenticated;

  DO $$
  BEGIN
    BEGIN
      UPDATE restaurants
      SET status = 'suspended'
      WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001';
      RAISE WARNING 'Prueba 11 FALLO: owner de Alfa pudo cambiar status del restaurante.';
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'Prueba 11 PASS: cambio de status denegado para owner (%).', SQLERRM;
    END;
  END;
  $$;
ROLLBACK;
