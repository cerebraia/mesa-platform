-- ============================================================
-- Mesa Platform · Datos de prueba — aislamiento multiempresa
-- ============================================================
-- SOLO para entorno local de desarrollo.
-- NO aplicar en producción ni en la base de datos de staging.
--
-- Procedimiento:
--   1. Iniciar Supabase local: supabase start
--   2. Aplicar migraciones: supabase db reset (aplica migraciones + seed)
--      O manualmente: psql $DB_URL -f supabase/seeds/test_seed.sql
--   3. Crear los usuarios en Supabase Auth antes de este seed,
--      usar los UUIDs reales en las INSERTs de abajo.
--      supabase --local users create \
--        --email owner-alfa@test.local --password test1234
--      (repetir para cada usuario de prueba)
--   4. Sustituir los placeholders <uuid-*> con los UUIDs reales.
--
-- Usuarios de prueba necesarios:
--   owner-alfa@test.local     → <uuid-owner-alfa>
--   attention-alfa@test.local → <uuid-attention-alfa>
--   kitchen-alfa@test.local   → <uuid-kitchen-alfa>
--   owner-beta@test.local     → <uuid-owner-beta>
--   admin@test.local          → <uuid-admin>
-- ============================================================

-- Dos restaurantes con IDs fijos para facilitar las pruebas.
INSERT INTO restaurants (id, name, slug, currency, timezone, status)
VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001',
   'Restaurante Alfa', 'restaurante-alfa', 'USD', 'America/Caracas', 'active'),
  ('bbbbbbbb-0000-0000-0000-000000000002',
   'Restaurante Beta', 'restaurante-beta', 'USD', 'America/Caracas', 'active')
ON CONFLICT DO NOTHING;

-- Dominios de plataforma para cada restaurante.
INSERT INTO restaurant_domains (host, restaurant_id, kind, verified)
VALUES
  ('restaurante-alfa.tuplataforma.com',
   'aaaaaaaa-0000-0000-0000-000000000001', 'platform_subdomain', true),
  ('restaurante-beta.tuplataforma.com',
   'bbbbbbbb-0000-0000-0000-000000000002', 'platform_subdomain', true)
ON CONFLICT DO NOTHING;

-- ── Sustituir UUIDs reales antes de ejecutar ──────────────────
-- Descomentar y reemplazar <uuid-*> con los UUIDs de auth.users.

-- Primer administrador de plataforma (service_role omite RLS).
-- INSERT INTO platform_admins (user_id, created_by)
-- VALUES ('<uuid-admin>', NULL)
-- ON CONFLICT DO NOTHING;

-- Miembros de Restaurante Alfa.
-- INSERT INTO restaurant_members (restaurant_id, user_id, role, status)
-- VALUES
--   ('aaaaaaaa-0000-0000-0000-000000000001', '<uuid-owner-alfa>',     'owner',     'active'),
--   ('aaaaaaaa-0000-0000-0000-000000000001', '<uuid-attention-alfa>', 'attention', 'active'),
--   ('aaaaaaaa-0000-0000-0000-000000000001', '<uuid-kitchen-alfa>',   'kitchen',   'active')
-- ON CONFLICT DO NOTHING;

-- Miembro de Restaurante Beta (solo owner para las pruebas de aislamiento).
-- INSERT INTO restaurant_members (restaurant_id, user_id, role, status)
-- VALUES
--   ('bbbbbbbb-0000-0000-0000-000000000002', '<uuid-owner-beta>', 'owner', 'active')
-- ON CONFLICT DO NOTHING;
