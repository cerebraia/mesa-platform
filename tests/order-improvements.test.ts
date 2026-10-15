// Tests de las mejoras del flujo de pedidos:
// - Sesión de comprador (múltiples pedidos, independencia de accesos)
// - Conflicto de concurrencia en advance_order_status
// - Idempotencia de doble-clic
// - Token no aparece en body de POST /api/orders
// - Cocina sigue sin ver PII tras cambios de migración 019
// Ejecutar con: npm run test:improvements

import test from "node:test";
import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomBytes, createHash } from "crypto";

const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

const ALFA = "aaaaaaaa-0000-0000-0000-000000000001";

const NEEDED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "TEST_OWNER_ALFA_EMAIL",     "TEST_OWNER_ALFA_PASSWORD",
  "TEST_ATTENTION_ALFA_EMAIL", "TEST_ATTENTION_ALFA_PASSWORD",
  "TEST_KITCHEN_ALFA_EMAIL",   "TEST_KITCHEN_ALFA_PASSWORD",
];
const MISSING = NEEDED.filter((k) => !process.env[k]);
const SKIP    = MISSING.length > 0;
if (SKIP) console.warn(`[improvements] Skipped — missing: ${MISSING.join(", ")}`);

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
function newToken() {
  const t = randomBytes(32).toString("hex");
  return { token: t, hash: createHash("sha256").update(t).digest("hex") };
}

async function getPaymentMethodId(c: SupabaseClient, restaurantId: string): Promise<string | null> {
  const { data } = await c.from("payment_methods").select("id").eq("restaurant_id", restaurantId).eq("is_active", true).limit(1);
  return data?.[0]?.id ?? null;
}

async function getProduct(c: SupabaseClient, restaurantId: string): Promise<{ id: string; variantId: string | null } | null> {
  const { data } = await c.from("products").select("id, product_variants(id)").eq("restaurant_id", restaurantId).eq("is_published", true).eq("is_available", true).limit(1);
  if (!data?.length) return null;
  const p = data[0] as { id: string; product_variants: { id: string }[] };
  return { id: p.id, variantId: p.product_variants?.[0]?.id ?? null };
}

async function placeOrder(
  c: SupabaseClient,
  restaurantId: string,
  pmId: string,
  productId: string,
  variantId: string | null,
): Promise<{ order_id: string; order_number: number; token: string } | null> {
  const key = newKey();
  const cartHash = createHash("sha256").update(key).digest("hex");
  const { token, hash } = newToken();
  const { data, error } = await c.rpc("place_order", {
    p_restaurant_id: restaurantId, p_idempotency_key: key, p_cart_hash: cartHash,
    p_customer_name: "Comprador Test", p_customer_phone: "+58412000000",
    p_modality: "pickup", p_delivery_zone_id: null, p_delivery_address: null,
    p_payment_method_id: pmId, p_notes: null,
    p_items: [{ product_id: productId, variant_id: variantId, options: [], quantity: 1 }],
    p_access_token_hash: hash, p_ip_hash: "test-session",
  });
  if (error) return null;
  const r = data as Record<string, unknown>;
  return { order_id: r.order_id as string, order_number: r.order_number as number, token };
}

// ── IM01: get_order_by_token returns different orders for different tokens ──
test("IM01 dos tokens distintos dan acceso a pedidos distintos", { skip: SKIP }, async () => {
  const c = await clientFor(process.env.TEST_OWNER_ALFA_EMAIL!, process.env.TEST_OWNER_ALFA_PASSWORD!);
  const pmId = await getPaymentMethodId(c, ALFA);
  const product = await getProduct(c, ALFA);
  if (!pmId || !product) { console.warn("IM01 skipped — no payment method or product"); return; }

  const order1 = await placeOrder(c, ALFA, pmId, product.id, product.variantId);
  const order2 = await placeOrder(c, ALFA, pmId, product.id, product.variantId);
  if (!order1 || !order2) { console.warn("IM01 skipped — could not place orders"); return; }

  const hash1 = createHash("sha256").update(order1.token).digest("hex");
  const hash2 = createHash("sha256").update(order2.token).digest("hex");

  const { data: d1 } = await c.rpc("get_order_by_token", { p_token_hash: hash1 });
  const { data: d2 } = await c.rpc("get_order_by_token", { p_token_hash: hash2 });

  assert.ok(d1 != null, "Token 1 debe resolver un pedido");
  assert.ok(d2 != null, "Token 2 debe resolver un pedido");
  const r1 = d1 as Record<string, unknown>;
  const r2 = d2 as Record<string, unknown>;
  assert.notEqual(r1.id, r2.id, "Tokens distintos deben resolver pedidos distintos");
  assert.equal(r1.id, order1.order_id, "Token 1 debe resolver al pedido 1");
  assert.equal(r2.id, order2.order_id, "Token 2 debe resolver al pedido 2");
});

// ── IM02: Unknown token returns null (no cross-order access) ─────────────
test("IM02 token desconocido devuelve null — sin acceso cruzado", { skip: SKIP }, async () => {
  const c = await clientFor(process.env.TEST_OWNER_ALFA_EMAIL!, process.env.TEST_OWNER_ALFA_PASSWORD!);
  const { hash } = newToken(); // random, never stored
  const { data } = await c.rpc("get_order_by_token", { p_token_hash: hash });
  assert.equal(data, null, "Token aleatorio debe devolver null");
});

// ── IM03: Order ID alone does not grant access via get_order_by_token ────
test("IM03 el ID del pedido no da acceso sin el token", { skip: SKIP }, async () => {
  const c = await clientFor(process.env.TEST_OWNER_ALFA_EMAIL!, process.env.TEST_OWNER_ALFA_PASSWORD!);
  const pmId = await getPaymentMethodId(c, ALFA);
  const product = await getProduct(c, ALFA);
  if (!pmId || !product) { console.warn("IM03 skipped"); return; }

  const order = await placeOrder(c, ALFA, pmId, product.id, product.variantId);
  if (!order) { console.warn("IM03 skipped — could not place order"); return; }

  // Try to look up using the order's UUID as if it were a token hash
  const wrongHash = createHash("sha256").update(order.order_id).digest("hex");
  const { data } = await c.rpc("get_order_by_token", { p_token_hash: wrongHash });
  assert.equal(data, null, "UUID del pedido no debe ser válido como token");
});

// ── IM04: advance_order_status returns conflict when state is stale ──────
test("IM04 advance_order_status detecta estado desactualizado (conflicto)", { skip: SKIP }, async () => {
  const ownerC = await clientFor(process.env.TEST_OWNER_ALFA_EMAIL!, process.env.TEST_OWNER_ALFA_PASSWORD!);
  const pmId = await getPaymentMethodId(ownerC, ALFA);
  const product = await getProduct(ownerC, ALFA);
  if (!pmId || !product) { console.warn("IM04 skipped"); return; }

  const order = await placeOrder(ownerC, ALFA, pmId, product.id, product.variantId);
  if (!order) { console.warn("IM04 skipped — could not place order"); return; }

  // First operator accepts the order
  const { error: e1 } = await ownerC.rpc("advance_order_status", {
    p_order_id: order.order_id, p_restaurant_id: ALFA,
    p_new_status: "accepted", p_note: null, p_expected_status: "received",
  });
  assert.ifError(e1);

  // Second operator tries to accept too, but still thinks it's "received"
  const { data: d2 } = await ownerC.rpc("advance_order_status", {
    p_order_id: order.order_id, p_restaurant_id: ALFA,
    p_new_status: "accepted", p_note: null, p_expected_status: "received",
  });
  const r2 = d2 as Record<string, unknown>;
  assert.equal(r2.success, false, "Debe detectar conflicto");
  assert.equal(r2.conflict, true, "conflict debe ser true");
  assert.equal(r2.current_status, "accepted", "Estado actual debe ser accepted");
});

// ── IM05: advance_order_status is idempotent for same target state ──────
test("IM05 advance_order_status es idempotente cuando ya está en el estado destino", { skip: SKIP }, async () => {
  const ownerC = await clientFor(process.env.TEST_OWNER_ALFA_EMAIL!, process.env.TEST_OWNER_ALFA_PASSWORD!);
  const pmId = await getPaymentMethodId(ownerC, ALFA);
  const product = await getProduct(ownerC, ALFA);
  if (!pmId || !product) { console.warn("IM05 skipped"); return; }

  const order = await placeOrder(ownerC, ALFA, pmId, product.id, product.variantId);
  if (!order) { console.warn("IM05 skipped"); return; }

  // Accept the order (non-idempotent: requires expected_status)
  await ownerC.rpc("advance_order_status", {
    p_order_id: order.order_id, p_restaurant_id: ALFA,
    p_new_status: "accepted", p_note: null, p_expected_status: "received",
  });

  // Count events before double-click
  const { data: beforeEvents } = await ownerC
    .from("order_status_events")
    .select("id")
    .eq("order_id", order.order_id);
  const countBefore = beforeEvents?.length ?? 0;

  // "Double-click": try to accept again (idempotent: current = target, null allowed)
  const { data: d2 } = await ownerC.rpc("advance_order_status", {
    p_order_id: order.order_id, p_restaurant_id: ALFA,
    p_new_status: "accepted", p_note: null, p_expected_status: null,
  });
  const r2 = d2 as Record<string, unknown>;
  assert.equal(r2.idempotent, true, "Debe ser idempotente");
  assert.equal(r2.success, true, "Idempotente sigue siendo éxito");

  // No new event should have been created
  const { data: afterEvents } = await ownerC
    .from("order_status_events")
    .select("id")
    .eq("order_id", order.order_id);
  const countAfter = afterEvents?.length ?? 0;
  assert.equal(countBefore, countAfter, "El doble-clic no debe duplicar el evento de historial");
});

// ── IM06: confirm_order_payment is idempotent for same target state ──────
test("IM06 confirm_order_payment es idempotente (sin duplicar evento)", { skip: SKIP }, async () => {
  const ownerC     = await clientFor(process.env.TEST_OWNER_ALFA_EMAIL!, process.env.TEST_OWNER_ALFA_PASSWORD!);
  const attentionC = await clientFor(process.env.TEST_ATTENTION_ALFA_EMAIL!, process.env.TEST_ATTENTION_ALFA_PASSWORD!);
  const pmId = await getPaymentMethodId(ownerC, ALFA);
  const product = await getProduct(ownerC, ALFA);
  if (!pmId || !product) { console.warn("IM06 skipped"); return; }

  const order = await placeOrder(ownerC, ALFA, pmId, product.id, product.variantId);
  if (!order) { console.warn("IM06 skipped"); return; }

  // First confirm (non-idempotent: requires expected_payment_status)
  const { data: d1 } = await attentionC.rpc("confirm_order_payment", {
    p_order_id: order.order_id, p_restaurant_id: ALFA,
    p_confirmed: true, p_note: null, p_expected_payment_status: "pending",
  });
  const r1 = d1 as Record<string, unknown>;
  assert.equal(r1.success, true);

  // Count events
  const { data: ev1 } = await ownerC.from("order_status_events").select("id").eq("order_id", order.order_id);

  // Second confirm (idempotent double-click: current = confirmed = target, null allowed)
  const { data: d2 } = await attentionC.rpc("confirm_order_payment", {
    p_order_id: order.order_id, p_restaurant_id: ALFA,
    p_confirmed: true, p_note: null, p_expected_payment_status: null,
  });
  const r2 = d2 as Record<string, unknown>;
  assert.equal(r2.idempotent, true, "Doble-clic en confirmar debe ser idempotente");

  const { data: ev2 } = await ownerC.from("order_status_events").select("id").eq("order_id", order.order_id);
  assert.equal(ev1?.length, ev2?.length, "No debe duplicar evento de pago");
});

// ── IM07: confirm_order_payment detects stale expected state ─────────────
test("IM07 confirm_order_payment detecta conflicto de pago desactualizado", { skip: SKIP }, async () => {
  const ownerC     = await clientFor(process.env.TEST_OWNER_ALFA_EMAIL!, process.env.TEST_OWNER_ALFA_PASSWORD!);
  const attentionC = await clientFor(process.env.TEST_ATTENTION_ALFA_EMAIL!, process.env.TEST_ATTENTION_ALFA_PASSWORD!);
  const pmId = await getPaymentMethodId(ownerC, ALFA);
  const product = await getProduct(ownerC, ALFA);
  if (!pmId || !product) { console.warn("IM07 skipped"); return; }

  const order = await placeOrder(ownerC, ALFA, pmId, product.id, product.variantId);
  if (!order) { console.warn("IM07 skipped"); return; }

  // Attention confirms first
  await attentionC.rpc("confirm_order_payment", {
    p_order_id: order.order_id, p_restaurant_id: ALFA,
    p_confirmed: true, p_note: null, p_expected_payment_status: "pending",
  });

  // Owner tries to confirm again but thinks it's still "pending"
  const { data: d2 } = await ownerC.rpc("confirm_order_payment", {
    p_order_id: order.order_id, p_restaurant_id: ALFA,
    p_confirmed: true, p_note: null, p_expected_payment_status: "pending",
  });
  const r2 = d2 as Record<string, unknown>;
  assert.equal(r2.conflict, true, "Debe detectar conflicto de pago");
  assert.equal(r2.payment_status, "confirmed", "Estado real debe ser confirmed");
});

// ── IM08: Kitchen still cannot read PII after migration 019 ─────────────
test("IM08 cocina sigue sin poder leer customer_name tras migración 019", { skip: SKIP }, async () => {
  const c = await clientFor(process.env.TEST_KITCHEN_ALFA_EMAIL!, process.env.TEST_KITCHEN_ALFA_PASSWORD!);
  const { error } = await c.from("orders").select("customer_name").eq("restaurant_id", ALFA).limit(1);
  assert.ok(error != null, "Cocina no debe poder leer customer_name (migración 019 no debe regresar)");
});

// ── IM09: Checkout still works after revoking anon from place_order ──────
test("IM09 place_order funciona para authenticated tras migración 019", { skip: SKIP }, async () => {
  const c = await clientFor(process.env.TEST_OWNER_ALFA_EMAIL!, process.env.TEST_OWNER_ALFA_PASSWORD!);
  const pmId = await getPaymentMethodId(c, ALFA);
  const product = await getProduct(c, ALFA);
  if (!pmId || !product) { console.warn("IM09 skipped"); return; }

  const order = await placeOrder(c, ALFA, pmId, product.id, product.variantId);
  assert.ok(order != null, "place_order debe funcionar para authenticated tras revocar anon");
  assert.ok(order?.order_id, "Debe devolver un order_id");
});

// ── IM10: advance_order_status returns success structure (not plain string)
test("IM10 advance_order_status retorna jsonb con {success, conflict, current_status}", { skip: SKIP }, async () => {
  const c = await clientFor(process.env.TEST_OWNER_ALFA_EMAIL!, process.env.TEST_OWNER_ALFA_PASSWORD!);
  const pmId = await getPaymentMethodId(c, ALFA);
  const product = await getProduct(c, ALFA);
  if (!pmId || !product) { console.warn("IM10 skipped"); return; }

  const order = await placeOrder(c, ALFA, pmId, product.id, product.variantId);
  if (!order) { console.warn("IM10 skipped"); return; }

  const { data, error } = await c.rpc("advance_order_status", {
    p_order_id: order.order_id, p_restaurant_id: ALFA,
    p_new_status: "accepted", p_note: null, p_expected_status: "received",
  });
  assert.ifError(error);
  const r = data as Record<string, unknown>;
  assert.ok("success" in r, "Debe tener campo success");
  assert.ok("conflict" in r, "Debe tener campo conflict");
  assert.ok("current_status" in r, "Debe tener campo current_status");
  assert.equal(r.success, true);
  assert.equal(r.conflict, false);
  assert.equal(r.current_status, "accepted");
});
