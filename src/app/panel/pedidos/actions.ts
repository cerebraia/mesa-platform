"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";

async function getMembership() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado.");

  const { data: m } = await supabase
    .from("restaurant_members")
    .select("restaurant_id, role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!m) throw new Error("Sin membresía activa.");
  return { supabase, restaurantId: m.restaurant_id, role: m.role };
}

export type ActionResult = {
  error: string | null;
  conflict?: boolean;        // true when the order state was stale
  currentStatus?: string;    // actual state at time of conflict
};

// ── Advance order status ──────────────────────────────────────
// Passes expectedStatus so the RPC can detect stale UI state.
// On conflict the action returns it to the client; the RPC never
// raises an exception for conflict — only for auth/permission errors.

export async function advanceOrderStatus(
  orderId: string,
  newStatus: string,
  note?: string,
  expectedStatus?: string,
): Promise<ActionResult> {
  let supabase: Awaited<ReturnType<typeof createServerClient>>;
  let restaurantId: string;
  try {
    ({ supabase, restaurantId } = await getMembership());
  } catch (e) {
    return { error: (e as Error).message };
  }

  const { data, error } = await supabase.rpc("advance_order_status", {
    p_order_id:        orderId,
    p_restaurant_id:   restaurantId,
    p_new_status:      newStatus,
    p_note:            note ?? null,
    p_expected_status: expectedStatus ?? null,
  });

  if (error) return { error: error.message };

  const result = data as { success: boolean; conflict: boolean; idempotent: boolean; current_status: string; message?: string } | null;
  if (!result) return { error: "Respuesta inesperada del servidor." };

  if (result.conflict) {
    return {
      error: result.message ?? "El estado cambió. Actualiza la vista.",
      conflict: true,
      currentStatus: result.current_status,
    };
  }

  revalidatePath("/panel/pedidos");
  revalidatePath(`/panel/pedidos/${orderId}`);
  return { error: null };
}

// ── Confirm / revert payment ──────────────────────────────────

export async function confirmOrderPayment(
  orderId: string,
  confirmed: boolean,
  note?: string,
  expectedPaymentStatus?: string,
): Promise<ActionResult> {
  let supabase: Awaited<ReturnType<typeof createServerClient>>;
  let restaurantId: string;
  try {
    ({ supabase, restaurantId } = await getMembership());
  } catch (e) {
    return { error: (e as Error).message };
  }

  const { data, error } = await supabase.rpc("confirm_order_payment", {
    p_order_id:                  orderId,
    p_restaurant_id:             restaurantId,
    p_confirmed:                 confirmed,
    p_note:                      note ?? null,
    p_expected_payment_status:   expectedPaymentStatus ?? null,
  });

  if (error) return { error: error.message };

  const result = data as { success: boolean; conflict: boolean; idempotent: boolean; payment_status: string; message?: string } | null;
  if (!result) return { error: "Respuesta inesperada del servidor." };

  if (result.conflict) {
    return {
      error: result.message ?? "El estado del pago cambió. Actualiza la vista.",
      conflict: true,
      currentStatus: result.payment_status,
    };
  }

  revalidatePath("/panel/pedidos");
  revalidatePath(`/panel/pedidos/${orderId}`);
  return { error: null };
}
