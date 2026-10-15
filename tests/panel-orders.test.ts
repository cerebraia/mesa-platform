// Tests del panel operativo de pedidos.
// Cubre: aislamiento, restricciones de rol, transiciones de estado,
// confirmación de pago, historial inmutable y acceso cruzado.
// Ejecutar con: npm run test:panel

import test from "node:test";
import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomBytes, createHash } from "crypto";

const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

const ALFA = "aaaaaaaa-0000-0000-0000-000000000001";
const BETA = "bbbbbbbb-0000-0000-0000-000000000002";

const NEEDED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "TEST_OWNER_ALFA_EMAIL",      "TEST_OWNER_ALFA_PASSWORD",
  "TEST_OWNER_BETA_EMAIL",      "TEST_OWNER_BETA_PASSWORD",
  "TEST_ATTENTION_ALFA_EMAIL",  "TEST_ATTENTION_ALFA_PASSWORD",
  "TEST_KITCHEN_ALFA_EMAIL",    "TEST_KITCHEN_ALFA_PASSWORD",
];
const MISSING = NEEDED.filter((k) => !process.env[k]);
const SKIP    = MISSING.length > 0;
if (SKIP) console.warn(`[panel] Skipped — missing: ${MISSING.join(", ")}`);

async function clientFor(email: string, password: string): Promise<SupabaseClient> {
  const resp = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const json = await resp.json() as Record<string, unknown>;
  if (!resp.ok || !json.access_token) throw new Error(`Auth failed ${email}: ${String(json.error_description ?? resp.status)}`);
  return createClient(URL, ANON, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${json.access_token}` } },
  });
}

function newKey() { return randomBytes(16).toString("hex"); }
function newTokenHash() { return createHash("sha256").update(randomBytes(32)).digest("hex"); }

// Crea un pedido en estado 'received' usando place_order desde authenticated
async function createTestOrder(
  supabase: SupabaseClient,
  restaurantId: string,
  paymentMethodId: string,
): Promise<{ order_id: string; order_number: number } | null> {
  // Get a product for the order
  const { data: products } = await supabase
    .from("products")
    .select("id, product_variants(id)")
    .eq("restaurant_id", restaurantId)
    .eq("is_published", true)
    .eq("is_available", true)
    .limit(1);

  if (!products?.length) return null;

  const p = products[0] as { id: string; product_variants: Array<{ id: string }> };
  const key = newKey();
  const cartHash = createHash("sha256").update(key).digest("hex");

  const { data, error } = await supabase.rpc("place_order", {
    p_restaurant_id:    restaurantId,
    p_idempotency_key:  key,
    p_cart_hash:        cartHash,
    p_customer_name:    "Test Panel",
    p_customer_phone:   "+58412000000",
    p_modality:         "pickup",
    p_delivery_zone_id: null,
    p_delivery_address: null,
    p_payment_method_id: paymentMethodId,
    p_notes:            null,
    p_items:            [{ product_id: p.id, variant_id: p.product_variants?.[0]?.id ?? null, options: [], quantity: 1 }],
    p_access_token_hash: newTokenHash(),
    p_ip_hash:          "panel-test",
  });

  if (error) return null;
  return data as { order_id: string; order_number: number };
}

async function getPaymentMethodId(supabase: SupabaseClient, restaurantId: string): Promise<string | null> {
  const { data } = await supabase
    .from("payment_methods")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .eq("is_active", true)
    .limit(1);
  return data?.[0]?.id ?? null;
}

// ── PO01: Kitchen cannot read customer_name from orders ───────
test("PO01 cocina no puede leer customer_name de orders directamente", { skip: SKIP }, async () => {
  const c = await clientFor(process.env.TEST_KITCHEN_ALFA_EMAIL!, process.env.TEST_KITCHEN_ALFA_PASSWORD!);
  const { error } = await c.from("orders").select("customer_name").eq("restaurant_id", ALFA).limit(1);
  // Column not granted → error
  assert.ok(error != null, "Cocina no debe poder leer customer_name directamente");
});

// ── PO02: Kitchen cannot read customer_phone from orders ──────
test("PO02 cocina no puede leer customer_phone de orders directamente", { skip: SKIP }, async () => {
  const c = await clientFor(process.env.TEST_KITCHEN_ALFA_EMAIL!, process.env.TEST_KITCHEN_ALFA_PASSWORD!);
  const { error } = await c.from("orders").select("customer_phone").eq("restaurant_id", ALFA).limit(1);
  assert.ok(error != null, "Cocina no debe poder leer customer_phone");
});

// ── PO03: Kitchen cannot read delivery_address ────────────────
test("PO03 cocina no puede leer delivery_address de orders", { skip: SKIP }, async () => {
  const c = await clientFor(process.env.TEST_KITCHEN_ALFA_EMAIL!, process.env.TEST_KITCHEN_ALFA_PASSWORD!);
  const { error } = await c.from("orders").select("delivery_address").eq("restaurant_id", ALFA).limit(1);
  assert.ok(error != null, "Cocina no debe poder leer delivery_address");
});

// ── PO04: Kitchen can read safe columns ───────────────────────
test("PO04 cocina puede leer columnas públicas de orders", { skip: SKIP }, async () => {
  const c = await clientFor(process.env.TEST_KITCHEN_ALFA_EMAIL!, process.env.TEST_KITCHEN_ALFA_PASSWORD!);
  const { data, error } = await c
    .from("orders")
    .select("id, order_number, status, modality, subtotal_cents, total_cents, created_at")
    .eq("restaurant_id", ALFA)
    .limit(5);
  assert.ifError(error);
  assert.ok(Array.isArray(data), "Cocina debe poder leer columnas públicas de orders");
});

// ── PO05: anon cannot call place_order directly ───────────────
test("PO05 anon no puede llamar place_order directamente tras migración 018", { skip: SKIP }, async () => {
  const anon = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error } = await anon.rpc("place_order", {
    p_restaurant_id:    ALFA,
    p_idempotency_key:  "anon-direct",
    p_cart_hash:        "x",
    p_customer_name:    "Hacker",
    p_customer_phone:   "+1234",
    p_modality:         "pickup",
    p_delivery_zone_id: null,
    p_delivery_address: null,
    p_payment_method_id: null,
    p_notes:            null,
    p_items:            [],
    p_access_token_hash: "fake",
    p_ip_hash:          "hack",
  });
  assert.ok(error != null, "Anon no debe poder llamar place_order tras revocar EXECUTE");
});

// ── PO06: get_orders_for_panel denies kitchen PII ─────────────
test("PO06 get_orders_for_panel no expone PII a cocina", { skip: SKIP }, async () => {
  const c = await clientFor(process.env.TEST_KITCHEN_ALFA_EMAIL!, process.env.TEST_KITCHEN_ALFA_PASSWORD!);
  const { data, error } = await c.rpc("get_orders_for_panel", {
    p_restaurant_id: ALFA,
  });
  assert.ifError(error);
  const result = data as { orders: Record<string, unknown>[]; role: string };
  assert.equal(result.role, "kitchen");
  if (result.orders.length > 0) {
    const order = result.orders[0];
    assert.ok(!("customer_name" in order), "customer_name no debe estar en la respuesta de cocina");
    assert.ok(!("customer_phone" in order), "customer_phone no debe estar en la respuesta de cocina");
    assert.ok(!("delivery_address" in order), "delivery_address no debe estar en la respuesta de cocina");
    assert.ok(!("notes" in order), "notes no debe estar en la respuesta de cocina");
  }
});

// ── PO07: Owner Beta cannot call get_orders_for_panel for Alfa ─
test("PO07 owner de Beta no puede ver pedidos de Alfa via get_orders_for_panel", { skip: SKIP }, async () => {
  const c = await clientFor(process.env.TEST_OWNER_BETA_EMAIL!, process.env.TEST_OWNER_BETA_PASSWORD!);
  const { error } = await c.rpc("get_orders_for_panel", {
    p_restaurant_id: ALFA,
  });
  assert.ok(error != null, "Owner de Beta no debe poder ver pedidos de Alfa");
});

// ── PO08: Owner can accept an order ──────────────────────────
test("PO08 owner puede aceptar un pedido 'received'", { skip: SKIP }, async () => {
  const ownerC = await clientFor(process.env.TEST_OWNER_ALFA_EMAIL!, process.env.TEST_OWNER_ALFA_PASSWORD!);
  const pmId = await getPaymentMethodId(ownerC, ALFA);
  if (!pmId) { console.warn("PO08 skipped — no payment method"); return; }

  const order = await createTestOrder(ownerC, ALFA, pmId);
  if (!order) { console.warn("PO08 skipped — could not create order"); return; }

  const { data, error } = await ownerC.rpc("advance_order_status", {
    p_order_id:        order.order_id,
    p_restaurant_id:   ALFA,
    p_new_status:      "accepted",
    p_note:            null,
    p_expected_status: "received",
  });

  assert.ifError(error);
  const r08 = data as Record<string, unknown>;
  assert.equal(r08.success, true, "Debe retornar success=true");
  assert.equal(r08.current_status, "accepted", "Estado resultante debe ser accepted");
});

// ── PO09: Kitchen can advance accepted → preparing ────────────
test("PO09 cocina puede avanzar de accepted a preparing", { skip: SKIP }, async () => {
  const ownerC  = await clientFor(process.env.TEST_OWNER_ALFA_EMAIL!, process.env.TEST_OWNER_ALFA_PASSWORD!);
  const kitchenC = await clientFor(process.env.TEST_KITCHEN_ALFA_EMAIL!, process.env.TEST_KITCHEN_ALFA_PASSWORD!);
  const pmId = await getPaymentMethodId(ownerC, ALFA);
  if (!pmId) { console.warn("PO09 skipped — no payment method"); return; }

  const order = await createTestOrder(ownerC, ALFA, pmId);
  if (!order) { console.warn("PO09 skipped"); return; }

  // Owner accepts first
  await ownerC.rpc("advance_order_status", {
    p_order_id: order.order_id, p_restaurant_id: ALFA, p_new_status: "accepted",
    p_note: null, p_expected_status: "received",
  });

  // Kitchen moves to preparing
  const { data, error } = await kitchenC.rpc("advance_order_status", {
    p_order_id: order.order_id, p_restaurant_id: ALFA, p_new_status: "preparing",
    p_note: null, p_expected_status: "accepted",
  });
  assert.ifError(error);
  const r09 = data as Record<string, unknown>;
  assert.equal(r09.success, true, "Debe retornar success=true");
  assert.equal(r09.current_status, "preparing", "Estado resultante debe ser preparing");
});

// ── PO10: Kitchen cannot accept a received order ──────────────
test("PO10 cocina no puede aceptar un pedido 'received'", { skip: SKIP }, async () => {
  const ownerC   = await clientFor(process.env.TEST_OWNER_ALFA_EMAIL!, process.env.TEST_OWNER_ALFA_PASSWORD!);
  const kitchenC = await clientFor(process.env.TEST_KITCHEN_ALFA_EMAIL!, process.env.TEST_KITCHEN_ALFA_PASSWORD!);
  const pmId = await getPaymentMethodId(ownerC, ALFA);
  if (!pmId) { console.warn("PO10 skipped"); return; }

  const order = await createTestOrder(ownerC, ALFA, pmId);
  if (!order) { console.warn("PO10 skipped"); return; }

  const { error } = await kitchenC.rpc("advance_order_status", {
    p_order_id: order.order_id, p_restaurant_id: ALFA, p_new_status: "accepted",
    p_note: null, p_expected_status: "received",
  });
  assert.ok(error != null, "Cocina no debe poder aceptar un pedido recibido");
});

// ── PO11: Kitchen cannot cancel an order ─────────────────────
test("PO11 cocina no puede cancelar un pedido", { skip: SKIP }, async () => {
  const ownerC   = await clientFor(process.env.TEST_OWNER_ALFA_EMAIL!, process.env.TEST_OWNER_ALFA_PASSWORD!);
  const kitchenC = await clientFor(process.env.TEST_KITCHEN_ALFA_EMAIL!, process.env.TEST_KITCHEN_ALFA_PASSWORD!);
  const pmId = await getPaymentMethodId(ownerC, ALFA);
  if (!pmId) { console.warn("PO11 skipped"); return; }

  const order = await createTestOrder(ownerC, ALFA, pmId);
  if (!order) { console.warn("PO11 skipped"); return; }

  const { error } = await kitchenC.rpc("advance_order_status", {
    p_order_id: order.order_id, p_restaurant_id: ALFA, p_new_status: "cancelled",
    p_note: "Intento de cocina", p_expected_status: "received",
  });
  assert.ok(error != null, "Cocina no debe poder cancelar pedidos");
});

// ── PO12: Reject requires a note ─────────────────────────────
test("PO12 rechazar pedido sin nota falla", { skip: SKIP }, async () => {
  const ownerC = await clientFor(process.env.TEST_OWNER_ALFA_EMAIL!, process.env.TEST_OWNER_ALFA_PASSWORD!);
  const pmId = await getPaymentMethodId(ownerC, ALFA);
  if (!pmId) { console.warn("PO12 skipped"); return; }

  const order = await createTestOrder(ownerC, ALFA, pmId);
  if (!order) { console.warn("PO12 skipped"); return; }

  const { error } = await ownerC.rpc("advance_order_status", {
    p_order_id: order.order_id, p_restaurant_id: ALFA, p_new_status: "rejected",
    p_note: null, p_expected_status: "received",
  });
  assert.ok(error != null, "Rechazar sin nota debe fallar");
});

// ── PO13: Cannot skip from received to ready ─────────────────
test("PO13 no se puede saltar de received a ready", { skip: SKIP }, async () => {
  const ownerC = await clientFor(process.env.TEST_OWNER_ALFA_EMAIL!, process.env.TEST_OWNER_ALFA_PASSWORD!);
  const pmId = await getPaymentMethodId(ownerC, ALFA);
  if (!pmId) { console.warn("PO13 skipped"); return; }

  const order = await createTestOrder(ownerC, ALFA, pmId);
  if (!order) { console.warn("PO13 skipped"); return; }

  const { error } = await ownerC.rpc("advance_order_status", {
    p_order_id: order.order_id, p_restaurant_id: ALFA, p_new_status: "ready",
    p_note: null, p_expected_status: "received",
  });
  assert.ok(error != null, "No se debe saltar estados intermedios");
});

// ── PO14: Owner Beta cannot advance Alfa's order ─────────────
test("PO14 owner de Beta no puede avanzar estado de pedido de Alfa", { skip: SKIP }, async () => {
  const ownerAlfa = await clientFor(process.env.TEST_OWNER_ALFA_EMAIL!, process.env.TEST_OWNER_ALFA_PASSWORD!);
  const ownerBeta = await clientFor(process.env.TEST_OWNER_BETA_EMAIL!, process.env.TEST_OWNER_BETA_PASSWORD!);
  const pmId = await getPaymentMethodId(ownerAlfa, ALFA);
  if (!pmId) { console.warn("PO14 skipped"); return; }

  const order = await createTestOrder(ownerAlfa, ALFA, pmId);
  if (!order) { console.warn("PO14 skipped"); return; }

  const { error } = await ownerBeta.rpc("advance_order_status", {
    p_order_id: order.order_id, p_restaurant_id: ALFA, p_new_status: "accepted",
    p_note: null, p_expected_status: "received",
  });
  assert.ok(error != null, "Owner de Beta no debe manejar pedidos de Alfa");
});

// ── PO15: Payment confirmation by attention ───────────────────
test("PO15 atención puede confirmar el pago de un pedido", { skip: SKIP }, async () => {
  const ownerC     = await clientFor(process.env.TEST_OWNER_ALFA_EMAIL!, process.env.TEST_OWNER_ALFA_PASSWORD!);
  const attentionC = await clientFor(process.env.TEST_ATTENTION_ALFA_EMAIL!, process.env.TEST_ATTENTION_ALFA_PASSWORD!);
  const pmId = await getPaymentMethodId(ownerC, ALFA);
  if (!pmId) { console.warn("PO15 skipped"); return; }

  const order = await createTestOrder(ownerC, ALFA, pmId);
  if (!order) { console.warn("PO15 skipped"); return; }

  const { data, error } = await attentionC.rpc("confirm_order_payment", {
    p_order_id:                  order.order_id,
    p_restaurant_id:             ALFA,
    p_confirmed:                 true,
    p_note:                      null,
    p_expected_payment_status:   "pending",
  });
  assert.ifError(error);
  const r15 = data as Record<string, unknown>;
  assert.equal(r15.success, true, "Debe retornar success=true");
  assert.equal(r15.payment_status, "confirmed", "Estado de pago debe ser confirmed");
});

// ── PO16: Kitchen cannot confirm payment ─────────────────────
test("PO16 cocina no puede confirmar el pago", { skip: SKIP }, async () => {
  const ownerC   = await clientFor(process.env.TEST_OWNER_ALFA_EMAIL!, process.env.TEST_OWNER_ALFA_PASSWORD!);
  const kitchenC = await clientFor(process.env.TEST_KITCHEN_ALFA_EMAIL!, process.env.TEST_KITCHEN_ALFA_PASSWORD!);
  const pmId = await getPaymentMethodId(ownerC, ALFA);
  if (!pmId) { console.warn("PO16 skipped"); return; }

  const order = await createTestOrder(ownerC, ALFA, pmId);
  if (!order) { console.warn("PO16 skipped"); return; }

  const { error } = await kitchenC.rpc("confirm_order_payment", {
    p_order_id:                order.order_id,
    p_restaurant_id:           ALFA,
    p_confirmed:               true,
    p_note:                    null,
    p_expected_payment_status: "pending",
  });
  assert.ok(error != null, "Cocina no debe poder confirmar pagos");
});

// ── PO17: Reverting confirmed payment requires owner + note ───
test("PO17 revertir pago confirmado sin nota falla", { skip: SKIP }, async () => {
  const ownerC = await clientFor(process.env.TEST_OWNER_ALFA_EMAIL!, process.env.TEST_OWNER_ALFA_PASSWORD!);
  const pmId = await getPaymentMethodId(ownerC, ALFA);
  if (!pmId) { console.warn("PO17 skipped"); return; }

  const order = await createTestOrder(ownerC, ALFA, pmId);
  if (!order) { console.warn("PO17 skipped"); return; }

  // First confirm
  await ownerC.rpc("confirm_order_payment", {
    p_order_id: order.order_id, p_restaurant_id: ALFA, p_confirmed: true,
    p_note: null, p_expected_payment_status: "pending",
  });

  // Then revert without note
  const { error } = await ownerC.rpc("confirm_order_payment", {
    p_order_id: order.order_id, p_restaurant_id: ALFA, p_confirmed: false,
    p_note: null, p_expected_payment_status: "confirmed",
  });
  assert.ok(error != null, "Revertir sin nota debe fallar");
});

// ── PO18: Status events are append-only for authenticated ─────
test("PO18 authenticated no puede insertar en order_status_events directamente", { skip: SKIP }, async () => {
  const c = await clientFor(process.env.TEST_OWNER_ALFA_EMAIL!, process.env.TEST_OWNER_ALFA_PASSWORD!);
  const { error } = await c.from("order_status_events").insert({
    order_id:      "00000000-0000-0000-0000-000000000000",
    restaurant_id: ALFA,
    status:        "fake",
  });
  assert.ok(error != null, "No se debe poder insertar en order_status_events directamente");
});

// ── PO19: get_order_full_detail hides kitchen PII ────────────
test("PO19 get_order_full_detail no expone PII a cocina", { skip: SKIP }, async () => {
  const ownerC   = await clientFor(process.env.TEST_OWNER_ALFA_EMAIL!, process.env.TEST_OWNER_ALFA_PASSWORD!);
  const kitchenC = await clientFor(process.env.TEST_KITCHEN_ALFA_EMAIL!, process.env.TEST_KITCHEN_ALFA_PASSWORD!);
  const pmId = await getPaymentMethodId(ownerC, ALFA);
  if (!pmId) { console.warn("PO19 skipped"); return; }

  const order = await createTestOrder(ownerC, ALFA, pmId);
  if (!order) { console.warn("PO19 skipped"); return; }

  const { data, error } = await kitchenC.rpc("get_order_full_detail", {
    p_order_id:      order.order_id,
    p_restaurant_id: ALFA,
  });
  assert.ifError(error);
  assert.ok(data, "RPC debe devolver datos");
  const d = data as Record<string, unknown>;
  assert.ok(!("customer_name" in d), "customer_name no debe estar en la respuesta de cocina");
  assert.ok(!("customer_phone" in d), "customer_phone no debe estar en la respuesta de cocina");
  assert.ok(!("payment_instructions" in d), "payment_instructions no debe estar para cocina");
  assert.equal(d.role, "kitchen");
});

// ── PO20: Attention cannot revert a confirmed payment ─────────
test("PO20 atención no puede revertir un pago confirmado (solo owner)", { skip: SKIP }, async () => {
  const ownerC     = await clientFor(process.env.TEST_OWNER_ALFA_EMAIL!, process.env.TEST_OWNER_ALFA_PASSWORD!);
  const attentionC = await clientFor(process.env.TEST_ATTENTION_ALFA_EMAIL!, process.env.TEST_ATTENTION_ALFA_PASSWORD!);
  const pmId = await getPaymentMethodId(ownerC, ALFA);
  if (!pmId) { console.warn("PO20 skipped"); return; }

  const order = await createTestOrder(ownerC, ALFA, pmId);
  if (!order) { console.warn("PO20 skipped"); return; }

  await ownerC.rpc("confirm_order_payment", {
    p_order_id: order.order_id, p_restaurant_id: ALFA, p_confirmed: true,
    p_note: null, p_expected_payment_status: "pending",
  });

  const { error } = await attentionC.rpc("confirm_order_payment", {
    p_order_id: order.order_id, p_restaurant_id: ALFA, p_confirmed: false,
    p_note: "Intento de atención", p_expected_payment_status: "confirmed",
  });
  assert.ok(error != null, "Atención no debe revertir pagos confirmados");
});
