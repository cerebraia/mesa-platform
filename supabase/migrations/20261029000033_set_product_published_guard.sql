-- Migration 033: Guard set_product_published against soft-deleted products
--
-- set_product_published ran by SECURITY DEFINER bypasses RLS, so it can
-- UPDATE a product that has deleted_at IS NOT NULL. Adding AND deleted_at IS NULL
-- to the WHERE clause makes the guard airtight at the DB level, complementing
-- the action-level check added in the same session.

CREATE OR REPLACE FUNCTION set_product_published(
  p_restaurant_id uuid,
  p_product_id    uuid,
  p_published     boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF member_role(p_restaurant_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Solo los propietarios pueden publicar productos'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE products
  SET is_published = p_published, updated_at = now()
  WHERE id            = p_product_id
    AND restaurant_id = p_restaurant_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Producto no encontrado o eliminado'
      USING ERRCODE = 'no_data_found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION set_product_published(uuid, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_product_published(uuid, uuid, boolean) TO authenticated;
