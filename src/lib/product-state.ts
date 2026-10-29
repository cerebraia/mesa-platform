/**
 * Canonical product visibility state.
 *
 * Priority (exclusive — no product belongs to two states):
 *   1. borrador   – is_published = false
 *   2. visible    – is_published = true  AND is_available = true
 *   3. sin-precio – is_published = true  AND is_available = false AND price = null
 *   4. pausado    – is_published = true  AND is_available = false AND price != null
 *
 * Matches the RLS anon policy: is_published = true AND is_available = true.
 * Only "visible" products appear in the public catalog.
 */
export type ProductVisibilityState = "visible" | "pausado" | "sin-precio" | "borrador";

export function productState(p: {
  is_published: boolean;
  is_available: boolean;
  base_price_cents: number | null;
}): ProductVisibilityState {
  if (!p.is_published)  return "borrador";
  if (p.is_available)   return "visible";
  if (p.base_price_cents == null) return "sin-precio";
  return "pausado";
}
