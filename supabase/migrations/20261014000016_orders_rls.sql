-- ============================================================
-- Mesa Platform · Migración 016 — RLS de pedidos
-- ============================================================
-- Modelo de acceso:
--
--   anon (clientes sin cuenta):
--     Sin acceso directo a ninguna tabla de pedidos.
--     El checkout pasa íntegramente por la función RPC
--     place_order (SECURITY DEFINER) — nunca por escritura
--     directa del rol anon.
--     La consulta del estado del pedido usa get_order_by_token
--     (SECURITY DEFINER) con el hash del token — nunca SELECT
--     directo por anon.
--
--   authenticated (miembros del panel):
--     SELECT en orders, order_items, order_item_options y
--     order_status_events: miembro activo del restaurante o
--     platform_admin.
--     Sin INSERT directo en orders: solo place_order puede
--     insertar, garantizando que los totales y validaciones
--     del servidor no se salten.
--     order_counters: acceso CRUD para authenticated porque
--     place_order los necesita como SECURITY DEFINER y el
--     propietario de la función es postgres; las políticas RLS
--     aquí actúan como segunda barrera.
--
-- Nota: el patrón REVOKE ALL + GRANT selectivo es consistente
-- con el resto de migraciones del proyecto. Supabase concede
-- ALL a anon por defecto sobre tablas nuevas; revocarlo aquí
-- es la única garantía de que anon no tenga acceso residual.
-- ============================================================

-- ── Habilitar RLS ─────────────────────────────────────────────
ALTER TABLE order_counters       ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders               ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_item_options   ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_events  ENABLE ROW LEVEL SECURITY;

-- ── Eliminar cualquier privilegio residual de anon ────────────
-- Supabase concede ALL PRIVILEGES a anon sobre tablas nuevas de
-- forma predeterminada. Se revoca explícitamente en todas.
REVOKE ALL ON order_counters      FROM anon;
REVOKE ALL ON orders              FROM anon;
REVOKE ALL ON order_items         FROM anon;
REVOKE ALL ON order_item_options  FROM anon;
REVOKE ALL ON order_status_events FROM anon;

-- ── Eliminar privilegios residuales de authenticated ──────────
-- Se revoca para reconstruir con precisión solo los necesarios.
REVOKE ALL ON order_counters      FROM authenticated;
REVOKE ALL ON orders              FROM authenticated;
REVOKE ALL ON order_items         FROM authenticated;
REVOKE ALL ON order_item_options  FROM authenticated;
REVOKE ALL ON order_status_events FROM authenticated;

-- ── Conceder permisos selectivos a authenticated ──────────────

-- orders: los miembros del panel solo leen; place_order inserta.
GRANT SELECT ON orders TO authenticated;

-- order_items / order_item_options / order_status_events: solo lectura.
GRANT SELECT ON order_items          TO authenticated;
GRANT SELECT ON order_item_options   TO authenticated;
GRANT SELECT ON order_status_events  TO authenticated;

-- order_counters: CRUD completo porque place_order (SECURITY DEFINER)
-- lo manipula internamente y RLS actúa como segunda barrera.
GRANT SELECT, INSERT, UPDATE, DELETE ON order_counters TO authenticated;

-- ════════════════════════════════════════════════════════════
-- Políticas RLS para authenticated
-- ════════════════════════════════════════════════════════════

-- ── orders ───────────────────────────────────────────────────
-- Lectura: miembro activo del restaurante o platform_admin.
-- Sin política INSERT: solo place_order (SECURITY DEFINER) puede
-- crear órdenes, lo que garantiza la ejecución de todas las
-- validaciones y cálculos del servidor.
CREATE POLICY "orders_auth_select" ON orders
  FOR SELECT TO authenticated
  USING (
    is_platform_admin()
    OR is_active_member(restaurant_id)
  );

-- ── order_items ──────────────────────────────────────────────
CREATE POLICY "order_items_auth_select" ON order_items
  FOR SELECT TO authenticated
  USING (
    is_platform_admin()
    OR is_active_member(restaurant_id)
  );

-- ── order_item_options ───────────────────────────────────────
CREATE POLICY "order_item_options_auth_select" ON order_item_options
  FOR SELECT TO authenticated
  USING (
    is_platform_admin()
    OR is_active_member(restaurant_id)
  );

-- ── order_status_events ──────────────────────────────────────
CREATE POLICY "order_status_events_auth_select" ON order_status_events
  FOR SELECT TO authenticated
  USING (
    is_platform_admin()
    OR is_active_member(restaurant_id)
  );

-- ── order_counters ───────────────────────────────────────────
-- SELECT, INSERT, UPDATE: necesario para place_order SECURITY DEFINER.
-- DELETE se revoca implícitamente al no crear política para ello.
CREATE POLICY "order_counters_auth_select" ON order_counters
  FOR SELECT TO authenticated
  USING (
    is_platform_admin()
    OR is_active_member(restaurant_id)
  );

CREATE POLICY "order_counters_auth_insert" ON order_counters
  FOR INSERT TO authenticated
  WITH CHECK (
    is_platform_admin()
    OR is_active_member(restaurant_id)
  );

CREATE POLICY "order_counters_auth_update" ON order_counters
  FOR UPDATE TO authenticated
  USING (
    is_platform_admin()
    OR is_active_member(restaurant_id)
  )
  WITH CHECK (
    is_platform_admin()
    OR is_active_member(restaurant_id)
  );
