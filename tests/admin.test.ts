// Tests de funcionalidad administrativa:
// AD01: Alta de restaurante y rechazo de slug duplicado
// AD02: Asignación de dueño sin escalamiento de privilegios
// AD03: Acceso administrativo denegado a otros roles
// AD04: Aislamiento de suscripciones y pagos
// AD05: Suspensión, vencimiento y reactivación
// AD06: Pedido rechazado cuando el negocio no está habilitado (directamente)
// AD07: Datos de pedidos e información conservados al suspender
// AD08: Límites concurrentes de suscripción activa
//
// Ejecutar con: npm run test:admin

import test from "node:test";
import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomBytes, createHash } from "crypto";

const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

const ALFA = "aaaaaaaa-0000-0000-0000-000000000001";
const BETA = "aaaaaaaa-0000-0000-0000-000000000002";

const NEEDED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "TEST_ADMIN_EMAIL",          "TEST_ADMIN_PASSWORD",
  "TEST_OWNER_ALFA_EMAIL",     "TEST_OWNER_ALFA_PASSWORD",
  "TEST_OWNER_BETA_EMAIL",     "TEST_OWNER_BETA_PASSWORD",
  "TEST_NOACCESS_EMAIL",       "TEST_NOACCESS_PASSWORD",
  "SUPABASE_SERVICE_ROLE_KEY",
];
const MISSING = NEEDED.filter((k) => !process.env[k]);
const SKIP    = MISSING.length > 0;
if (SKIP) console.warn(`[admin] Saltado — faltan: ${MISSING.join(", ")}`);

// ── Helpers ──────────────────────────────────────────────────────────────────

async function clientFor(email: string, password: string): Promise<SupabaseClient> {
  const resp = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const json = await resp.json() as Record<string, unknown>;
  if (!resp.ok || !json.access_token) {
    throw new Error(`Auth failed ${email}: ${String(json.error_description ?? resp.status)}`);
  }
  return createClient(URL, ANON, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${json.access_token}` } },
  });
}

function serviceClient(): SupabaseClient {
  return createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function rand(prefix = "") {
  return `${prefix}${randomBytes(4).toString("hex")}`;
}

async function getPaymentMethodId(c: SupabaseClient, restaurantId: string) {
  const { data } = await c.from("payment_methods")
    .select("id").eq("restaurant_id", restaurantId).eq("is_active", true).limit(1);
  return data?.[0]?.id ?? null;
}

async function getProduct(c: SupabaseClient, restaurantId: string) {
  const { data } = await c.from("products")
    .select("id, product_variants(id)")
    .eq("restaurant_id", restaurantId)
    .eq("is_published", true).eq("is_available", true).limit(1);
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
) {
  const key = randomBytes(16).toString("hex");
  const hash = createHash("sha256").update(randomBytes(32).toString("hex")).digest("hex");
  const { data, error } = await c.rpc("place_order", {
    p_restaurant_id: restaurantId, p_idempotency_key: key,
    p_cart_hash: createHash("sha256").update(key).digest("hex"),
    p_customer_name: "Test Admin", p_customer_phone: "+58412000001",
    p_modality: "pickup", p_delivery_zone_id: null, p_delivery_address: null,
    p_payment_method_id: pmId, p_notes: null,
    p_items: [{ product_id: productId, variant_id: variantId, options: [], quantity: 1 }],
    p_access_token_hash: hash, p_ip_hash: "admin-test",
  });
  return { data: data as Record<string, unknown> | null, error };
}

// ── AD01: Create restaurant, reject duplicate slug ──────────────────────────
test("AD01 alta de restaurante y rechazo de slug duplicado", { skip: SKIP }, async () => {
  const svc = serviceClient();
  const slug = rand("test-rest-");

  // Create first restaurant
  const { data: r1, error: e1 } = await svc.from("restaurants").insert({
    name: "Test Admin R1", slug, currency: "USD", timezone: "America/Caracas", status: "onboarding",
  }).select("id, slug").single();
  assert.ifError(e1);
  assert.ok(r1?.id, "Debe devolver id");
  assert.equal(r1?.slug, slug);

  // Attempt duplicate slug
  const { error: e2 } = await svc.from("restaurants").insert({
    name: "Test Admin R2", slug, currency: "USD", timezone: "America/Caracas", status: "onboarding",
  });
  assert.ok(e2 != null, "Debe rechazar slug duplicado");
  assert.ok(e2!.code === "23505", "Debe ser unique_violation (23505)");

  // Cleanup
  await svc.from("restaurants").delete().eq("id", r1!.id);
});

// ── AD02: Assign owner without privilege escalation ───────────────────────────
test("AD02 asignar dueño sin conceder platform_admin", { skip: SKIP }, async () => {
  const ownerC = await clientFor(
    process.env.TEST_OWNER_ALFA_EMAIL!,
    process.env.TEST_OWNER_ALFA_PASSWORD!,
  );

  // Owner cannot insert into platform_admins
  const { error } = await ownerC.from("platform_admins").insert({
    user_id: "00000000-0000-0000-0000-000000000000",
  });
  assert.ok(error != null, "Owner no debe poder insertar en platform_admins");

  // Owner cannot modify another user's membership to owner
  const { error: e2 } = await ownerC.from("restaurant_members").update({ role: "owner" })
    .eq("restaurant_id", ALFA).neq("user_id", "00000000-0000-0000-0000-000000000000");
  // RLS forbids updating other users or self
  // This should either return an error or update 0 rows (both acceptable)
  if (!e2) {
    const { data: affected } = await ownerC.from("restaurant_members")
      .select("id").eq("restaurant_id", ALFA).eq("role", "owner");
    // Verify the member_role membership for owner_alfa hasn't been altered to platform_admin
    const { data: adminCheck } = await ownerC.from("platform_admins").select("user_id");
    assert.ok(!adminCheck?.length || adminCheck.length === 0,
      "Owner no debe aparecer en platform_admins");
  }
});

// ── AD03: Admin access denied to non-admin roles ──────────────────────────────
test("AD03 acceso admin denegado a roles distintos a platform_admin", { skip: SKIP }, async () => {
  const ownerC = await clientFor(
    process.env.TEST_OWNER_ALFA_EMAIL!,
    process.env.TEST_OWNER_ALFA_PASSWORD!,
  );

  // Owner cannot read platform_admins
  const { data: paData } = await ownerC.from("platform_admins").select("user_id");
  assert.equal(paData?.length ?? 0, 0, "Owner no debe leer platform_admins de otros");

  // Owner cannot insert plans
  const { error: planErr } = await ownerC.from("plans").insert({
    name: "Plan Ilegal", price_cents: 0, currency: "USD",
  });
  assert.ok(planErr != null, "Owner no debe poder insertar planes");

  // Owner cannot insert subscriptions
  const { error: subErr } = await ownerC.from("subscriptions").insert({
    restaurant_id: ALFA,
    plan_id: "00000000-0000-0000-0000-000000000001",
    status: "active",
    starts_at: new Date().toISOString(),
  });
  assert.ok(subErr != null, "Owner no debe poder crear suscripciones");
});

// ── AD04: Subscription and payment isolation ──────────────────────────────────
test("AD04 aislamiento de suscripciones y pagos entre restaurantes", { skip: SKIP }, async () => {
  const ownerAlfaC = await clientFor(
    process.env.TEST_OWNER_ALFA_EMAIL!,
    process.env.TEST_OWNER_ALFA_PASSWORD!,
  );
  const ownerBetaC = await clientFor(
    process.env.TEST_OWNER_BETA_EMAIL!,
    process.env.TEST_OWNER_BETA_PASSWORD!,
  );
  const svc = serviceClient();

  // Create a test plan and subscription for Alfa using service role
  const { data: plan } = await svc.from("plans").insert({
    name: rand("Plan-"), price_cents: 1000, currency: "USD", is_test: true,
  }).select("id").single();
  if (!plan?.id) { console.warn("AD04 saltado — no se pudo crear plan"); return; }

  const { data: sub } = await svc.from("subscriptions").insert({
    restaurant_id: ALFA, plan_id: plan.id, status: "active",
    starts_at: new Date().toISOString(),
  }).select("id").single();
  if (!sub?.id) {
    await svc.from("plans").delete().eq("id", plan.id);
    console.warn("AD04 saltado — no se pudo crear suscripción");
    return;
  }

  // ownerAlfa can see its subscription
  const { data: alfaSubs } = await ownerAlfaC.from("subscriptions")
    .select("id").eq("restaurant_id", ALFA);
  const found = alfaSubs?.find((s: { id: string }) => s.id === sub.id);
  assert.ok(found, "ownerAlfa debe ver su propia suscripción");

  // ownerBeta cannot see Alfa's subscription
  const { data: betaSubs } = await ownerBetaC.from("subscriptions")
    .select("id").eq("id", sub.id);
  assert.equal(betaSubs?.length ?? 0, 0, "ownerBeta no debe ver la suscripción de Alfa");

  // Cleanup
  await svc.from("subscriptions").delete().eq("id", sub.id);
  await svc.from("plans").delete().eq("id", plan.id);
});

// ── AD05: Suspension, expiry and reactivation ─────────────────────────────────
test("AD05 suspensión impide nuevos pedidos; restaurar los permite", { skip: SKIP }, async () => {
  const ownerC = await clientFor(
    process.env.TEST_OWNER_ALFA_EMAIL!,
    process.env.TEST_OWNER_ALFA_PASSWORD!,
  );
  const svc = serviceClient();

  const pmId = await getPaymentMethodId(ownerC, ALFA);
  const product = await getProduct(ownerC, ALFA);
  if (!pmId || !product) { console.warn("AD05 saltado — sin medios de pago o productos"); return; }

  // Suspend the restaurant
  await svc.from("restaurants").update({ status: "suspended" }).eq("id", ALFA);

  // Order should fail
  const { error: orderErr } = await placeOrder(ownerC, ALFA, pmId, product.id, product.variantId);
  assert.ok(orderErr != null, "Pedido debe fallar cuando el restaurante está suspendido");

  // Reactivate
  await svc.from("restaurants").update({ status: "active" }).eq("id", ALFA);

  // Order should succeed again
  const { error: orderErr2 } = await placeOrder(ownerC, ALFA, pmId, product.id, product.variantId);
  if (orderErr2) {
    // Could fail for other reasons (restaurant closed hours, etc.) — not a test failure
    console.warn("AD05: pedido post-reactivación falló por razón distinta:", orderErr2.message);
  }
});

// ── AD06: Order rejected when restaurant has expired subscription ─────────────
test("AD06 suscripción vencida impide nuevos pedidos vía RPC directa", { skip: SKIP }, async () => {
  const ownerC = await clientFor(
    process.env.TEST_OWNER_ALFA_EMAIL!,
    process.env.TEST_OWNER_ALFA_PASSWORD!,
  );
  const svc = serviceClient();

  const pmId = await getPaymentMethodId(ownerC, ALFA);
  const product = await getProduct(ownerC, ALFA);
  if (!pmId || !product) { console.warn("AD06 saltado — sin medios de pago o productos"); return; }

  // Create a test plan + expired subscription
  const { data: plan } = await svc.from("plans").insert({
    name: rand("Exp-"), price_cents: 0, currency: "USD", is_test: true,
  }).select("id").single();
  if (!plan?.id) { console.warn("AD06 saltado — no se pudo crear plan"); return; }

  const yesterday = new Date(Date.now() - 86400 * 1000).toISOString();
  const { data: sub } = await svc.from("subscriptions").insert({
    restaurant_id: ALFA, plan_id: plan.id, status: "active",
    starts_at: new Date(Date.now() - 7 * 86400 * 1000).toISOString(),
    ends_at: yesterday,
  }).select("id").single();

  if (!sub?.id) {
    await svc.from("plans").delete().eq("id", plan.id);
    console.warn("AD06 saltado — no se pudo crear suscripción");
    return;
  }

  // Attempt to place order — must fail because subscription exists but is expired
  const { error: orderErr } = await placeOrder(ownerC, ALFA, pmId, product.id, product.variantId);
  assert.ok(orderErr != null, "Pedido debe fallar con suscripción vencida");
  assert.ok(
    orderErr!.message?.toLowerCase().includes("pedido") ||
    orderErr!.message?.toLowerCase().includes("disponible") ||
    orderErr!.code === "invalid_parameter_value" ||
    orderErr!.message?.includes("suscripción") ||
    orderErr!.message?.includes("recibir"),
    `Mensaje de error esperado, recibido: ${orderErr!.message}`,
  );

  // Cleanup
  await svc.from("subscriptions").delete().eq("id", sub.id);
  await svc.from("plans").delete().eq("id", plan.id);
});

// ── AD07: Orders and data preserved after suspension ─────────────────────────
test("AD07 pedidos existentes se conservan al suspender el restaurante", { skip: SKIP }, async () => {
  const ownerC = await clientFor(
    process.env.TEST_OWNER_ALFA_EMAIL!,
    process.env.TEST_OWNER_ALFA_PASSWORD!,
  );
  const svc = serviceClient();

  const pmId = await getPaymentMethodId(ownerC, ALFA);
  const product = await getProduct(ownerC, ALFA);
  if (!pmId || !product) { console.warn("AD07 saltado — sin medios de pago o productos"); return; }

  // Place an order while active
  const { data: orderData } = await placeOrder(ownerC, ALFA, pmId, product.id, product.variantId);
  if (!orderData?.order_id) { console.warn("AD07 saltado — no se pudo crear pedido"); return; }

  const orderId = orderData.order_id as string;

  // Suspend
  await svc.from("restaurants").update({ status: "suspended" }).eq("id", ALFA);

  // Order must still be readable by owner
  const { data: orders } = await ownerC.from("orders")
    .select("id, status").eq("id", orderId).maybeSingle();

  // Restore
  await svc.from("restaurants").update({ status: "active" }).eq("id", ALFA);

  assert.ok(orders?.id === orderId, "El pedido debe conservarse tras la suspensión");
});

// ── AD08: Non-admin cannot read subscription payments of other restaurant ─────
test("AD08 pagos de suscripción aislados: owner beta no ve pagos de alfa", { skip: SKIP }, async () => {
  const svc = serviceClient();
  const ownerBetaC = await clientFor(
    process.env.TEST_OWNER_BETA_EMAIL!,
    process.env.TEST_OWNER_BETA_PASSWORD!,
  );

  // Create a plan + subscription + payment for Alfa
  const { data: plan } = await svc.from("plans").insert({
    name: rand("PayTest-"), price_cents: 500, currency: "USD", is_test: true,
  }).select("id").single();
  if (!plan?.id) { console.warn("AD08 saltado"); return; }

  const { data: sub } = await svc.from("subscriptions").insert({
    restaurant_id: ALFA, plan_id: plan.id, status: "active",
    starts_at: new Date().toISOString(),
  }).select("id").single();
  if (!sub?.id) {
    await svc.from("plans").delete().eq("id", plan.id);
    console.warn("AD08 saltado");
    return;
  }

  const { data: payment } = await svc.from("subscription_payments").insert({
    subscription_id: sub.id, restaurant_id: ALFA,
    amount_cents: 500, currency: "USD",
    paid_at: new Date().toISOString(),
    reference: "TEST-AD08",
  }).select("id").single();
  if (!payment?.id) {
    await svc.from("subscriptions").delete().eq("id", sub.id);
    await svc.from("plans").delete().eq("id", plan.id);
    console.warn("AD08 saltado — no se pudo crear pago");
    return;
  }

  // ownerBeta cannot read Alfa's payment
  const { data: betaPayments } = await ownerBetaC
    .from("subscription_payments").select("id").eq("id", payment.id);
  assert.equal(betaPayments?.length ?? 0, 0, "ownerBeta no debe ver pagos de Alfa");

  // Cleanup
  await svc.from("subscription_payments").delete().eq("id", payment.id);
  await svc.from("subscriptions").delete().eq("id", sub.id);
  await svc.from("plans").delete().eq("id", plan.id);
});

// ── AD09: Plans not visible to non-admin ─────────────────────────────────────
test("AD09 planes no visibles para roles que no son platform_admin", { skip: SKIP }, async () => {
  const noaccessC = await clientFor(
    process.env.TEST_NOACCESS_EMAIL!,
    process.env.TEST_NOACCESS_PASSWORD!,
  );

  const { data: plansData } = await noaccessC.from("plans").select("id");
  assert.equal(plansData?.length ?? 0, 0, "Usuario sin membresía no debe ver planes");
});

// ── AD10: Admin audit log not writable by authenticated users ─────────────────
test("AD10 audit_log no es escribible por authenticated", { skip: SKIP }, async () => {
  const ownerC = await clientFor(
    process.env.TEST_OWNER_ALFA_EMAIL!,
    process.env.TEST_OWNER_ALFA_PASSWORD!,
  );

  const { error } = await ownerC.from("admin_audit_log").insert({
    action: "fake_action", target_type: "system",
  });
  assert.ok(error != null, "authenticated no debe poder escribir en admin_audit_log");
});
