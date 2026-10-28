-- Migration 028: Financial movements
-- Tracks income, expenses, and inventory purchases per restaurant.
-- Voided movements are excluded from summary calculations.

-- ── Table ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS financial_movements (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   uuid        NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  type            text        NOT NULL CHECK (type IN ('income','expense','purchase')),
  amount_cents    integer     NOT NULL CHECK (amount_cents >= 0),
  currency        text        NOT NULL,
  concept         text        NOT NULL CHECK (char_length(concept) <= 200),
  category        text,
  movement_date   date        NOT NULL,
  notes           text,
  reference       text,
  counterpart     text,
  product_id      uuid        REFERENCES products(id) ON DELETE SET NULL,
  units           integer     CHECK (units IS NULL OR units > 0),
  is_voided       boolean     NOT NULL DEFAULT false,
  voided_at       timestamptz,
  voided_by       uuid        REFERENCES auth.users(id),
  voided_reason   text,
  created_by      uuid        NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS financial_movements_restaurant_date_idx
  ON financial_movements (restaurant_id, movement_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS financial_movements_restaurant_voided_idx
  ON financial_movements (restaurant_id, is_voided);

-- ── updated_at trigger ─────────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at'
  ) THEN
    EXECUTE 'CREATE TRIGGER set_updated_at_financial_movements
      BEFORE UPDATE ON financial_movements
      FOR EACH ROW EXECUTE FUNCTION set_updated_at()';
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$$;

-- ── RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE financial_movements ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON financial_movements FROM anon;

GRANT SELECT, INSERT, UPDATE ON financial_movements TO authenticated;

-- SELECT policy: platform admins OR owner of the restaurant
CREATE POLICY "fin_movements_select"
  ON financial_movements
  FOR SELECT
  TO authenticated
  USING (
    is_platform_admin()
    OR member_role(restaurant_id) = 'owner'
  );

-- INSERT policy: only restaurant owner
CREATE POLICY "fin_movements_insert"
  ON financial_movements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    member_role(restaurant_id) = 'owner'
  );

-- UPDATE policy: only for voiding (owner of that restaurant)
CREATE POLICY "fin_movements_update"
  ON financial_movements
  FOR UPDATE
  TO authenticated
  USING (
    member_role(restaurant_id) = 'owner'
  )
  WITH CHECK (
    member_role(restaurant_id) = 'owner'
  );

-- ── RPC: get_financial_summary ─────────────────────────────────────────────
-- Returns income, expense, net totals and count for a given period.
-- Only counts non-voided rows.
-- p_period: 'today' | 'yesterday' | '7days' | 'month'

CREATE OR REPLACE FUNCTION get_financial_summary(
  p_restaurant_id uuid,
  p_period        text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_timezone  text;
  v_from      date;
  v_to        date;
  v_today     date;
  v_income    bigint;
  v_expense   bigint;
  v_count     bigint;
  v_currency  text;
BEGIN
  -- Verify caller is owner of this restaurant
  IF member_role(p_restaurant_id) != 'owner' AND NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Acceso denegado.';
  END IF;

  -- Get restaurant timezone
  SELECT COALESCE(timezone, 'UTC')
    INTO v_timezone
    FROM restaurants
   WHERE id = p_restaurant_id;

  -- Calculate "today" in restaurant timezone
  v_today := (now() AT TIME ZONE v_timezone)::date;

  -- Determine date range
  CASE p_period
    WHEN 'today' THEN
      v_from := v_today;
      v_to   := v_today;
    WHEN 'yesterday' THEN
      v_from := v_today - INTERVAL '1 day';
      v_to   := v_today - INTERVAL '1 day';
    WHEN '7days' THEN
      v_from := v_today - INTERVAL '6 days';
      v_to   := v_today;
    WHEN 'month' THEN
      v_from := date_trunc('month', v_today)::date;
      v_to   := v_today;
    ELSE
      v_from := date_trunc('month', v_today)::date;
      v_to   := v_today;
  END CASE;

  -- Get the most common currency for this restaurant (or fall back to restaurant default)
  SELECT COALESCE(
    (SELECT fm.currency FROM financial_movements fm
      WHERE fm.restaurant_id = p_restaurant_id AND fm.is_voided = false
      GROUP BY fm.currency ORDER BY COUNT(*) DESC LIMIT 1),
    r.currency
  )
    INTO v_currency
    FROM restaurants r
   WHERE r.id = p_restaurant_id;

  -- Aggregate
  SELECT
    COALESCE(SUM(CASE WHEN type = 'income'   THEN amount_cents ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type IN ('expense','purchase') THEN amount_cents ELSE 0 END), 0),
    COUNT(*)
  INTO v_income, v_expense, v_count
  FROM financial_movements
  WHERE restaurant_id = p_restaurant_id
    AND is_voided     = false
    AND movement_date BETWEEN v_from AND v_to;

  RETURN jsonb_build_object(
    'income_cents',    v_income,
    'expense_cents',   v_expense,
    'net_cents',       v_income - v_expense,
    'currency',        COALESCE(v_currency, 'USD'),
    'movement_count',  v_count
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION get_financial_summary(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_financial_summary(uuid, text) TO authenticated;
