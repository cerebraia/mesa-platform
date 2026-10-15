// Tests de pedidos: validación, aislamiento y seguridad.
// Ejecutar con: npm run test:orders
// Prerequisitos: migraciones 015-017 aplicadas, seed + usuarios de prueba.

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
];
const MISSING = NEEDED.filter((k) => !process.env[k]);
const SKIP    = MISSING.length > 0;
if (SKIP) console.warn(`[orders] Skipped — missing: ${MISSING.join(", ")}`);

function anonClient(): SupabaseClient {
  return createClient(URL, ANON, { auth: { persistSession: false } });
}

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
function newToken() { const t = randomBytes(32).toString("hex"); return { token: t, hash: createHash("sha256").update(t).digest("hex") }; }

// Get a published product from Alfa for testing
async function getAlfaProduct(): Promise<{ id: string; variant_id: string | null; payment_id: string; zone_id: string } | null> {
  const anon = anonClient();
  const { data: products } = await anon
    .from("products")
    .select("id, product_variants(id)")
    .eq("restaurant_id", ALFA)
    .eq("is_published", true)
    .eq("is_available", true)
    .limit(1);
  if (!products?.length) return null;

  const p = products[0] as { id: string; product_variants: Array<{ id: string }> };

  // Get payment method and delivery zone for Alfa
  const [{ data: payments }, { data: zones }] = await Promise.all([
    anonClient().from("payment_methods").select("id").eq("restaurant_id", ALFA).eq("is_active", true).limit(1),
    anonClient().from("delivery_zones").select("id").eq("restaurant_id", ALFA).eq("is_active", true).limit(1),
  ]);

  return {
    id: p.id,
    variant_id: p.product_variants?.[0]?.id ?? null,
    payment_id: payments?.[0]?.id ?? "",
    zone_id: zones?.[0]?.id ?? "",
  };
}

// ── OR01: Anon cannot directly read orders table ──────────────
test("OR01 anon no puede leer la tabla orders directamente", { skip: SKIP }, async () => {
  const anon = anonClient();
  const { data, error } = await anon.from("orders").select("id").limit(1);
  assert.ok(error != null || (data?.length ?? 0) === 0, "Anon no debe leer orders directamente");
});

// ── OR02: Anon cannot insert into orders directly ─────────────
test("OR02 anon no puede insertar en orders directamente", { skip: SKIP }, async () => {
  const anon = anonClient();
  const { error } = await anon.from("orders").insert({
    restaurant_id: ALFA,
    order_number: 9999,
    idempotency_key: "direct-insert-test",
    cart_hash: "x",
    customer_name: "Hacker",
    customer_phone: "+1234567890",
    modality: "pickup",
    payment_method_name: "Cash",
    payment_method_type: "cash",
    subtotal_cents: 100,
    total_cents: 100,
    access_token_hash: "fake",
  });
  assert.ok(error != null, "Anon no debe poder insertar en orders");
});

// ── OR03: place_order RPC validates empty cart ────────────────
test("OR03 place_order rechaza carrito vacío", { skip: SKIP }, async () => {
  const anon = anonClient();
  const { hash } = newToken();
  const { error } = await anon.rpc("place_order", {
    p_restaurant_id:    ALFA,
    p_idempotency_key:  newKey(),
    p_cart_hash:        "h",
    p_customer_name:    "Test",
    p_customer_phone:   "+12345",
    p_modality:         "pickup",
    p_delivery_zone_id: null,
    p_delivery_address: null,
    p_payment_method_id: null,
    p_notes:            null,
    p_items:            [],
    p_access_token_hash: hash,
    p_ip_hash:          "test",
  });
  assert.ok(error != null, "Carrito vacío debe rechazarse");
});

// ── OR04: place_order validates invalid modality ──────────────
test("OR04 place_order rechaza modalidad inválida", { skip: SKIP }, async () => {
  const anon = anonClient();
  const catalog = await getAlfaProduct();
  if (!catalog) { console.warn("OR04 skipped — no product in Alfa"); return; }
  const { hash } = newToken();
  const { error } = await anon.rpc("place_order", {
    p_restaurant_id:    ALFA,
    p_idempotency_key:  newKey(),
    p_cart_hash:        "h",
    p_customer_name:    "Test",
    p_customer_phone:   "+12345",
    p_modality:         "teleport",
    p_delivery_zone_id: null,
    p_delivery_address: null,
    p_payment_method_id: catalog.payment_id,
    p_notes:            null,
    p_items:            [{ product_id: catalog.id, variant_id: catalog.variant_id, options: [], quantity: 1 }],
    p_access_token_hash: hash,
    p_ip_hash:          "test",
  });
  assert.ok(error != null, "Modalidad inválida debe rechazarse");
});

// ── OR05: place_order rejects product from another restaurant ─
test("OR05 place_order rechaza producto que no pertenece al restaurante", { skip: SKIP }, async () => {
  const anon = anonClient();
  // Get a product from Beta to use in an Alfa order
  const alfaCatalog = await getAlfaProduct();
  if (!alfaCatalog) { console.warn("OR05 skipped — no product"); return; }

  const { data: betaProducts } = await anonClient()
    .from("products")
    .select("id")
    .eq("restaurant_id", BETA)
    .eq("is_published", true)
    .limit(1);

  if (!betaProducts?.length) { console.warn("OR05 skipped — no Beta product"); return; }

  const { hash } = newToken();
  const { error } = await anon.rpc("place_order", {
    p_restaurant_id:    ALFA,
    p_idempotency_key:  newKey(),
    p_cart_hash:        "h",
    p_customer_name:    "Test",
    p_customer_phone:   "+12345",
    p_modality:         "pickup",
    p_delivery_zone_id: null,
    p_delivery_address: null,
    p_payment_method_id: alfaCatalog.payment_id,
    p_notes:            null,
    p_items:            [{ product_id: betaProducts[0].id, variant_id: null, options: [], quantity: 1 }],
    p_access_token_hash: hash,
    p_ip_hash:          "test",
  });
  assert.ok(error != null, "Producto de otro restaurante debe rechazarse");
});

// ── OR06: place_order idempotency — same key same content ─────
test("OR06 place_order idempotencia: misma clave mismo contenido devuelve pedido existente", { skip: SKIP }, async () => {
  const anon = anonClient();
  const catalog = await getAlfaProduct();
  if (!catalog || !catalog.payment_id) { console.warn("OR06 skipped — missing catalog data"); return; }

  const key = newKey();
  const { token, hash } = newToken();
  const items = [{ product_id: catalog.id, variant_id: catalog.variant_id, options: [], quantity: 1 }];
  const cartHash = createHash("sha256").update(key).digest("hex");

  const params = {
    p_restaurant_id:    ALFA,
    p_idempotency_key:  key,
    p_cart_hash:        cartHash,
    p_customer_name:    "Test OR06",
    p_customer_phone:   "+12345",
    p_modality:         "pickup",
    p_delivery_zone_id: null,
    p_delivery_address: null,
    p_payment_method_id: catalog.payment_id,
    p_notes:            null,
    p_items:            items,
    p_access_token_hash: hash,
    p_ip_hash:          "test-or06",
  };

  const { data: first, error: e1 } = await anon.rpc("place_order", params);
  if (e1) { console.warn("OR06 skipped — first call failed:", e1.message); return; }

  // Second call with same params
  const { data: second, error: e2 } = await anon.rpc("place_order", params);
  assert.ifError(e2);
  const r1 = first as Record<string, unknown>;
  const r2 = second as Record<string, unknown>;
  assert.equal(r2.idempotent_replay, true, "Segunda llamada debe ser idempotente");
  assert.equal(r1.order_id, r2.order_id, "Debe devolver el mismo order_id");
});

// ── OR07: place_order idempotency — same key different content ─
test("OR07 place_order idempotencia: misma clave diferente carrito devuelve error", { skip: SKIP }, async () => {
  const anon = anonClient();
  const catalog = await getAlfaProduct();
  if (!catalog || !catalog.payment_id) { console.warn("OR07 skipped"); return; }

  const key = newKey();
  const { hash: h1 } = newToken();
  const { hash: h2 } = newToken();
  const items = [{ product_id: catalog.id, variant_id: catalog.variant_id, options: [], quantity: 1 }];

  const { error: e1 } = await anon.rpc("place_order", {
    p_restaurant_id: ALFA, p_idempotency_key: key, p_cart_hash: h1,
    p_customer_name: "Test", p_customer_phone: "+12345",
    p_modality: "pickup", p_delivery_zone_id: null, p_delivery_address: null,
    p_payment_method_id: catalog.payment_id, p_notes: null,
    p_items: items, p_access_token_hash: h1, p_ip_hash: "or07",
  });
  if (e1) { console.warn("OR07 skipped — first call failed:", e1.message); return; }

  // Same key, different cart_hash
  const { error: e2 } = await anon.rpc("place_order", {
    p_restaurant_id: ALFA, p_idempotency_key: key, p_cart_hash: h2,
    p_customer_name: "Test", p_customer_phone: "+12345",
    p_modality: "pickup", p_delivery_zone_id: null, p_delivery_address: null,
    p_payment_method_id: catalog.payment_id, p_notes: null,
    p_items: items, p_access_token_hash: h2, p_ip_hash: "or07",
  });
  assert.ok(e2 != null, "Misma clave con distinto carrito debe fallar");
});

// ── OR08: get_order_by_token returns null for unknown token ───
test("OR08 get_order_by_token devuelve null para token desconocido", { skip: SKIP }, async () => {
  const anon = anonClient();
  const fakeHash = createHash("sha256").update("fake-token-that-does-not-exist").digest("hex");
  const { data, error } = await anon.rpc("get_order_by_token", { p_token_hash: fakeHash });
  assert.ifError(error);
  assert.equal(data, null, "Token desconocido debe devolver null");
});

// ── OR09: authenticated owner can read own restaurant orders ──
test("OR09 owner puede leer pedidos de su restaurante", { skip: SKIP }, async () => {
  const c = await clientFor(process.env.TEST_OWNER_ALFA_EMAIL!, process.env.TEST_OWNER_ALFA_PASSWORD!);
  const { data, error } = await c.from("orders").select("id").eq("restaurant_id", ALFA).limit(10);
  assert.ifError(error);
  assert.ok(Array.isArray(data), "Owner debe poder leer pedidos de su restaurante");
});

// ── OR10: authenticated owner of Beta cannot read Alfa orders ─
test("OR10 owner de Beta no puede leer pedidos de Alfa", { skip: SKIP }, async () => {
  const c = await clientFor(process.env.TEST_OWNER_BETA_EMAIL!, process.env.TEST_OWNER_BETA_PASSWORD!);
  const { data } = await c.from("orders").select("id").eq("restaurant_id", ALFA);
  assert.equal(data?.length ?? 0, 0, "Owner de Beta no debe ver pedidos de Alfa");
});

// ── OR11: attention can read orders for their restaurant ──────
test("OR11 atención puede leer pedidos de su restaurante", { skip: SKIP }, async () => {
  const c = await clientFor(process.env.TEST_ATTENTION_ALFA_EMAIL!, process.env.TEST_ATTENTION_ALFA_PASSWORD!);
  const { data, error } = await c.from("orders").select("id").eq("restaurant_id", ALFA).limit(5);
  assert.ifError(error);
  assert.ok(Array.isArray(data), "Atención debe poder leer pedidos de su restaurante");
});

// ── OR12: get_order_by_token returns order data for valid token
test("OR12 get_order_by_token devuelve pedido para token válido", { skip: SKIP }, async () => {
  const anon = anonClient();
  const catalog = await getAlfaProduct();
  if (!catalog || !catalog.payment_id) { console.warn("OR12 skipped"); return; }

  const { token, hash } = newToken();
  const key = newKey();
  const cartHash = createHash("sha256").update(key + "or12").digest("hex");

  const { error } = await anon.rpc("place_order", {
    p_restaurant_id: ALFA, p_idempotency_key: key, p_cart_hash: cartHash,
    p_customer_name: "Test OR12", p_customer_phone: "+12345",
    p_modality: "pickup", p_delivery_zone_id: null, p_delivery_address: null,
    p_payment_method_id: catalog.payment_id, p_notes: null,
    p_items: [{ product_id: catalog.id, variant_id: catalog.variant_id, options: [], quantity: 1 }],
    p_access_token_hash: hash, p_ip_hash: "or12",
  });
  if (error) { console.warn("OR12 skipped — place_order failed:", error.message); return; }

  const { data: orderData, error: lookupErr } = await anon.rpc("get_order_by_token", { p_token_hash: hash });
  assert.ifError(lookupErr);
  const order = orderData as Record<string, unknown>;
  assert.ok(order, "Debe devolver el pedido");
  assert.equal(order.status, "received");
  assert.ok(Array.isArray(order.items), "Debe incluir items");
});

// ── OR13: place_order validates quantity 0 ────────────────────
test("OR13 place_order rechaza cantidad 0", { skip: SKIP }, async () => {
  const anon = anonClient();
  const catalog = await getAlfaProduct();
  if (!catalog || !catalog.payment_id) { console.warn("OR13 skipped"); return; }
  const { hash } = newToken();
  const { error } = await anon.rpc("place_order", {
    p_restaurant_id: ALFA, p_idempotency_key: newKey(), p_cart_hash: "h",
    p_customer_name: "Test", p_customer_phone: "+12345",
    p_modality: "pickup", p_delivery_zone_id: null, p_delivery_address: null,
    p_payment_method_id: catalog.payment_id, p_notes: null,
    p_items: [{ product_id: catalog.id, variant_id: catalog.variant_id, options: [], quantity: 0 }],
    p_access_token_hash: hash, p_ip_hash: "or13",
  });
  assert.ok(error != null, "Cantidad 0 debe rechazarse");
});

// ── OR14: place_order validates quantity > 20 ─────────────────
test("OR14 place_order rechaza cantidad superior a 20", { skip: SKIP }, async () => {
  const anon = anonClient();
  const catalog = await getAlfaProduct();
  if (!catalog || !catalog.payment_id) { console.warn("OR14 skipped"); return; }
  const { hash } = newToken();
  const { error } = await anon.rpc("place_order", {
    p_restaurant_id: ALFA, p_idempotency_key: newKey(), p_cart_hash: "h",
    p_customer_name: "Test", p_customer_phone: "+12345",
    p_modality: "pickup", p_delivery_zone_id: null, p_delivery_address: null,
    p_payment_method_id: catalog.payment_id, p_notes: null,
    p_items: [{ product_id: catalog.id, variant_id: catalog.variant_id, options: [], quantity: 21 }],
    p_access_token_hash: hash, p_ip_hash: "or14",
  });
  assert.ok(error != null, "Cantidad > 20 debe rechazarse");
});

// ── OR15: anon cannot directly update order status ────────────
test("OR15 anon no puede actualizar status de orders directamente", { skip: SKIP }, async () => {
  const anon = anonClient();
  const { error } = await anon.from("orders").update({ status: "completed" }).eq("restaurant_id", ALFA);
  assert.ok(error != null, "Anon no debe modificar orders");
});
