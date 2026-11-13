-- ============================================================
-- Reparación idempotente de prueba-barbara
-- Mecanismo autorizado: simula la sesión autenticada del admin
-- configurando request.jwt.claims con el UUID de un platform_admin.
-- Esto es exactamente lo que hace el cliente supabase con sesión
-- autenticada — sin deshabilitar triggers ni relajar RLS.
-- ============================================================
-- Ejecutar en Supabase SQL Editor (corre como postgres superuser).
-- ============================================================

DO $$
DECLARE
  v_admin_id      uuid;
  v_restaurant_id uuid;
  v_status        text;
  v_plan_id       uuid;
BEGIN

  -- ── 1. Obtener un UUID de platform_admin real ─────────────
  SELECT user_id INTO v_admin_id FROM platform_admins LIMIT 1;
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró ningún platform_admin en la tabla platform_admins';
  END IF;
  RAISE NOTICE 'Admin encontrado: %', v_admin_id;

  -- ── 2. Simular sesión autenticada del admin ───────────────
  -- set_config configura request.jwt.claims para esta transacción.
  -- auth.uid() leerá el campo "sub" y devolverá v_admin_id.
  -- is_platform_admin() verificará platform_admins WHERE user_id = auth.uid()
  -- → retorna true → guard_restaurant_status no bloquea el UPDATE.
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_admin_id::text, 'role', 'authenticated')::text,
    true  -- local: solo aplica a esta transacción
  );

  -- ── 3. Verificar que is_platform_admin() ahora retorna true ──
  IF NOT EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'La configuración de JWT claims falló — is_platform_admin() sigue siendo false';
  END IF;
  RAISE NOTICE 'is_platform_admin() = true verificado';

  -- ── 4. Localizar prueba-barbara ───────────────────────────
  SELECT id, status INTO v_restaurant_id, v_status
  FROM restaurants
  WHERE slug = 'prueba-barbara'
    AND deleted_at IS NULL;

  IF v_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró el negocio con slug=prueba-barbara (o está eliminado)';
  END IF;
  RAISE NOTICE 'Negocio: id=%, status=%', v_restaurant_id, v_status;

  -- ── 5. Activar si no está activo ──────────────────────────
  -- El trigger guard_restaurant_status (BEFORE UPDATE) verificará
  -- is_platform_admin() — que ya retorna true por el paso 2.
  IF v_status <> 'active' THEN
    UPDATE restaurants
    SET status = 'active', updated_at = now()
    WHERE id = v_restaurant_id;
    RAISE NOTICE 'Estado cambiado: % → active', v_status;
  ELSE
    RAISE NOTICE 'Ya estaba active, sin cambio';
  END IF;

  -- ── 6. Garantizar restaurant_config (idempotente) ─────────
  INSERT INTO restaurant_config (restaurant_id, orders_enabled)
  VALUES (v_restaurant_id, true)
  ON CONFLICT (restaurant_id) DO NOTHING;
  RAISE NOTICE 'restaurant_config: ok';

  -- ── 7. Garantizar suscripción activa ──────────────────────
  -- Solo crea si no hay ninguna activa — sin duplicados.
  IF NOT EXISTS (
    SELECT 1 FROM subscriptions
    WHERE restaurant_id = v_restaurant_id
      AND status = 'active'
      AND (ends_at IS NULL OR ends_at > now())
  ) THEN
    SELECT id INTO v_plan_id
    FROM plans
    WHERE plan_code = 'inicio' AND is_active = true
    LIMIT 1;

    IF v_plan_id IS NOT NULL THEN
      INSERT INTO subscriptions (restaurant_id, plan_id, status, starts_at)
      VALUES (v_restaurant_id, v_plan_id, 'active', now());
      RAISE NOTICE 'Suscripción creada con plan inicio';
    ELSE
      RAISE NOTICE 'ADVERTENCIA: plan inicio no encontrado, suscripción no creada';
    END IF;
  ELSE
    RAISE NOTICE 'Suscripción activa ya existe, sin cambio';
  END IF;

  RAISE NOTICE '=== Reparación completada para prueba-barbara (%) ===', v_restaurant_id;

END$$;


-- ── Verificación final (solo lectura) ─────────────────────────
SELECT
  r.id,
  r.slug,
  r.status,
  r.deleted_at,
  rc.orders_enabled,
  s.status   AS sub_status,
  p.plan_code,
  p.price_cents
FROM restaurants r
LEFT JOIN restaurant_config rc ON rc.restaurant_id = r.id
LEFT JOIN subscriptions s ON s.restaurant_id = r.id
  AND s.status = 'active'
  AND (s.ends_at IS NULL OR s.ends_at > now())
LEFT JOIN plans p ON p.id = s.plan_id
WHERE r.slug = 'prueba-barbara';
