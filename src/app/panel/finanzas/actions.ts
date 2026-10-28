"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { getActiveMembershipForAction } from "@/lib/panel-context";

// ── Shared helpers ────────────────────────────────────────────────

async function getOwnerMembership() {
  const supabase = await createServerClient();
  const { restaurantId } = await getActiveMembershipForAction({ requiredRole: "owner" });
  return { supabase, restaurantId };
}

// ── Action state type ─────────────────────────────────────────────

export type FinanceState = { error: string | null; success?: boolean; id?: string };

// ── saveMovement ──────────────────────────────────────────────────
// Creates or updates a financial_movement.
// Amount is a decimal string (e.g. "25.50") → parsed to cents.

export async function saveMovement(
  _prev: FinanceState,
  formData: FormData,
): Promise<FinanceState> {
  const movementId = String(formData.get("id") ?? "").trim() || null;
  const type       = String(formData.get("type") ?? "").trim();
  const amountStr  = String(formData.get("amount") ?? "").trim();
  const concept    = String(formData.get("concept") ?? "").trim();
  const dateStr    = String(formData.get("movement_date") ?? "").trim();
  const category   = String(formData.get("category") ?? "").trim() || null;
  const notes      = String(formData.get("notes") ?? "").trim() || null;
  const reference  = String(formData.get("reference") ?? "").trim() || null;
  const counterpart = String(formData.get("counterpart") ?? "").trim() || null;
  const productId  = String(formData.get("product_id") ?? "").trim() || null;
  const unitsStr   = String(formData.get("units") ?? "").trim();

  // Validation
  if (!["income", "expense", "purchase"].includes(type)) {
    return { error: "Tipo de movimiento inválido." };
  }
  if (!concept) {
    return { error: "El concepto es obligatorio." };
  }
  if (concept.length > 200) {
    return { error: "El concepto no puede superar 200 caracteres." };
  }
  if (!dateStr) {
    return { error: "La fecha es obligatoria." };
  }

  const amountFloat = parseFloat(amountStr);
  if (isNaN(amountFloat) || amountFloat <= 0) {
    return { error: "El monto debe ser un número positivo." };
  }
  const amountCents = Math.round(amountFloat * 100);

  const units = unitsStr ? parseInt(unitsStr, 10) : null;
  if (units !== null && (isNaN(units) || units <= 0)) {
    return { error: "Las unidades deben ser un número entero positivo." };
  }

  let supabase: Awaited<ReturnType<typeof createServerClient>>;
  let restaurantId: string;
  try {
    ({ supabase, restaurantId } = await getOwnerMembership());
  } catch (e) {
    return { error: (e as Error).message };
  }

  // Get restaurant currency
  const { data: rest } = await supabase
    .from("restaurants")
    .select("currency")
    .eq("id", restaurantId)
    .single();
  const currency = rest?.currency ?? "USD";

  // Get authenticated user id
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  if (movementId) {
    // Update — verify it belongs to this restaurant
    const { error } = await supabase
      .from("financial_movements")
      .update({
        type,
        amount_cents: amountCents,
        currency,
        concept,
        category,
        movement_date: dateStr,
        notes,
        reference,
        counterpart,
        product_id: productId || null,
        units,
      })
      .eq("id", movementId)
      .eq("restaurant_id", restaurantId)
      .eq("is_voided", false);
    if (error) return { error: error.message };
  } else {
    // Insert
    const { data, error } = await supabase
      .from("financial_movements")
      .insert({
        restaurant_id: restaurantId,
        type,
        amount_cents: amountCents,
        currency,
        concept,
        category,
        movement_date: dateStr,
        notes,
        reference,
        counterpart,
        product_id: productId || null,
        units,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error) return { error: error.message };
    revalidatePath("/panel/finanzas");
    return { error: null, success: true, id: data.id };
  }

  revalidatePath("/panel/finanzas");
  return { error: null, success: true };
}

// ── voidMovement ──────────────────────────────────────────────────
// Marks a movement as voided (soft delete). It is excluded from totals.

export async function voidMovement(movementId: string): Promise<FinanceState> {
  let supabase: Awaited<ReturnType<typeof createServerClient>>;
  let restaurantId: string;
  try {
    ({ supabase, restaurantId } = await getOwnerMembership());
  } catch (e) {
    return { error: (e as Error).message };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  const { error } = await supabase
    .from("financial_movements")
    .update({
      is_voided:    true,
      voided_at:    new Date().toISOString(),
      voided_by:    user.id,
    })
    .eq("id", movementId)
    .eq("restaurant_id", restaurantId)
    .eq("is_voided", false); // prevent double-void

  if (error) return { error: error.message };

  revalidatePath("/panel/finanzas");
  return { error: null, success: true };
}

// ── adjustStock ───────────────────────────────────────────────────
// Inserts a stock_adjustment_log entry and updates product/variant stock.

export async function adjustStock(
  productId: string,
  variantId: string | null,
  delta: number,
  reason: string,
): Promise<FinanceState> {
  if (delta === 0) return { error: "El ajuste no puede ser cero." };

  let supabase: Awaited<ReturnType<typeof createServerClient>>;
  let restaurantId: string;
  try {
    ({ supabase, restaurantId } = await getOwnerMembership());
  } catch (e) {
    return { error: (e as Error).message };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  // Verify product belongs to this restaurant
  const { data: product } = await supabase
    .from("products")
    .select("id, stock_quantity")
    .eq("id", productId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (!product) return { error: "Producto no encontrado." };

  let newQty: number;

  if (variantId) {
    // Adjust variant stock
    const { data: variant } = await supabase
      .from("product_variants")
      .select("id, stock_quantity")
      .eq("id", variantId)
      .eq("product_id", productId)
      .maybeSingle();
    if (!variant) return { error: "Variante no encontrada." };

    newQty = (variant.stock_quantity ?? 0) + delta;
    const { error } = await supabase
      .from("product_variants")
      .update({ stock_quantity: newQty })
      .eq("id", variantId);
    if (error) return { error: error.message };
  } else {
    // Adjust product-level stock
    newQty = (product.stock_quantity ?? 0) + delta;
    const { error } = await supabase
      .from("products")
      .update({ stock_quantity: newQty })
      .eq("id", productId)
      .eq("restaurant_id", restaurantId);
    if (error) return { error: error.message };
  }

  // Log the adjustment
  const { error: logErr } = await supabase
    .from("stock_adjustment_log")
    .insert({
      restaurant_id: restaurantId,
      product_id:    productId,
      variant_id:    variantId,
      delta,
      reason:        reason.trim() || null,
      new_quantity:  newQty,
      created_by:    user.id,
    });
  if (logErr) return { error: logErr.message };

  revalidatePath("/panel/menu");
  revalidatePath("/panel/finanzas");
  return { error: null, success: true };
}

// ── saveProductControl ────────────────────────────────────────────
// Saves cost_cents, stock_quantity, stock_alert on a product.

export async function saveProductControl(
  productId: string,
  data: {
    cost_cents:     number | null;
    stock_quantity: number | null;
    stock_alert:    number | null;
  },
): Promise<FinanceState> {
  if (data.cost_cents !== null && data.cost_cents < 0) {
    return { error: "El costo no puede ser negativo." };
  }
  if (data.stock_quantity !== null && data.stock_quantity < 0) {
    return { error: "El stock no puede ser negativo." };
  }
  if (data.stock_alert !== null && data.stock_alert < 0) {
    return { error: "La alerta de stock no puede ser negativa." };
  }

  let supabase: Awaited<ReturnType<typeof createServerClient>>;
  let restaurantId: string;
  try {
    ({ supabase, restaurantId } = await getOwnerMembership());
  } catch (e) {
    return { error: (e as Error).message };
  }

  const { error } = await supabase
    .from("products")
    .update({
      cost_cents:     data.cost_cents,
      stock_quantity: data.stock_quantity,
      stock_alert:    data.stock_alert,
    })
    .eq("id", productId)
    .eq("restaurant_id", restaurantId);

  if (error) return { error: error.message };

  revalidatePath("/panel/menu");
  return { error: null, success: true };
}
