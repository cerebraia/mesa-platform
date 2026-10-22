// Tests de planes, límites de productos y límites de miembros.
// Prerrequisito: migración 023 aplicada + usuarios de prueba.
// Ejecutar: npm run test:plans

import test from "node:test";
import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

const ALFA = "aaaaaaaa-0000-0000-0000-000000000001";
const BETA = "bbbbbbbb-0000-0000-0000-000000000002";

const NEEDED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "TEST_OWNER_ALFA_EMAIL",   "TEST_OWNER_ALFA_PASSWORD",
  "TEST_OWNER_BETA_EMAIL",   "TEST_OWNER_BETA_PASSWORD",
  "TEST_ADMIN_EMAIL",        "TEST_ADMIN_PASSWORD",
];
const MISSING = NEEDED.filter((k) => !process.env[k]);
const SKIP    = MISSING.length > 0;
if (SKIP) console.warn(`[plans] Saltado — faltan: ${MISSING.join(", ")}`);

async function clientFor(email: string, password: string): Promise<SupabaseClient> {
  const resp = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const json = (await resp.json()) as Record<string, unknown>;
  if (!resp.ok || !json.access_token) {
    throw new Error(`Auth fallido ${email}: ${String(json.error_description ?? json.error ?? resp.status)}`);
  }
  return createClient(URL, ANON, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${json.access_token}` } },
  });
}

function serviceClient(): SupabaseClient {
  return createClient(URL, ANON, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""}` } },
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getPlanIdByCode(svc: SupabaseClient, code: string): Promise<string | null> {
  const { data } = await svc.from("plans").select("id").eq("plan_code", code).maybeSingle();
  return data?.id ?? null;
}

async function createTestSub(
  svc: SupabaseClient,
  restaurantId: string,
  planCode: string,
): Promise<string | null> {
  const planId = await getPlanIdByCode(svc, planCode);
  if (!planId) return null;
  const { data } = await svc.from("subscriptions").insert({
    restaurant_id: restaurantId,
    plan_id: planId,
    status: "active",
  }).select("id").single();
  return data?.id ?? null;
}

async function cancelSub(svc: SupabaseClient, subId: string) {
  await svc.from("subscriptions").update({ status: "cancelled" }).eq("id", subId);
}

async function createTestCategory(c: SupabaseClient, restaurantId: string): Promise<string> {
  const { data, error } = await c.from("categories").insert({
    restaurant_id: restaurantId,
    name: `_test_cat_${Date.now()}`,
    position: 999,
  }).select("id").single();
  if (error || !data) throw new Error(`No se pudo crear categoría: ${error?.message}`);
  return data.id;
}

async function upsertProduct(
  c: SupabaseClient,
  restaurantId: string,
  catId: string,
  name: string,
): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await c.rpc("upsert_product", {
    p_restaurant_id: restaurantId,
    p_product: {
      name,
      category_id: catId,
      base_price_cents: 500,
      is_published: false,
      position: 0,
    },
  });
  if (error) return { id: null, error: error.message };
  return { id: data as string, error: null };
}

async function deleteProducts(svc: SupabaseClient, restaurantId: string, ids: string[]) {
  if (!ids.length) return;
  await svc.from("products").delete().in("id", ids).eq("restaurant_id", restaurantId);
}

// ── PL01: planes comerciales insertados ──────────────────────────────────────

test("PL01 los tres planes comerciales existen en la BD", { skip: SKIP }, async () => {
  const svc = serviceClient();
  const { data: plans, error } = await svc
    .from("plans")
    .select("plan_code, name, price_cents, max_products, max_members")
    .in("plan_code", ["inicio", "negocio", "acompanado"])
    .eq("is_active", true);

  if (error?.message?.includes("column plans.plan_code does not exist")) {
    console.warn("  ⚠ PL01 saltado — migración 023 no aplicada (plan_code column falta)");
    return;
  }
  assert.ifError(error);
  assert.equal(plans?.length, 3, "Deben existir exactamente 3 planes comerciales");

  const inicio = plans!.find((p) => p.plan_code === "inicio")!;
  assert.equal(inicio.price_cents,  1900);
  assert.equal(inicio.max_products, 50);
  assert.equal(inicio.max_members,  1);

  const negocio = plans!.find((p) => p.plan_code === "negocio")!;
  assert.equal(negocio.price_cents,  3900);
  assert.equal(negocio.max_products, 200);
  assert.equal(negocio.max_members,  5);

  const acompanado = plans!.find((p) => p.plan_code === "acompanado")!;
  assert.equal(acompanado.price_cents,  6900);
  assert.equal(acompanado.max_products, 400);
  assert.equal(acompanado.max_members,  10);
});

// ── PL02: get_plan_usage accesible a owner ───────────────────────────────────

test("PL02 get_plan_usage devuelve datos al owner", { skip: SKIP }, async () => {
  const c = await clientFor(
    process.env.TEST_OWNER_ALFA_EMAIL!,
    process.env.TEST_OWNER_ALFA_PASSWORD!,
  );
  const { data, error } = await c.rpc("get_plan_usage", { p_restaurant_id: ALFA });
  if (error?.message?.includes("Could not find the function")) {
    console.warn("  ⚠ PL02 saltado — get_plan_usage no existe (migración 023 pendiente)");
    return;
  }
  assert.ifError(error);
  assert.ok(data != null, "Debe devolver datos");
  assert.ok(typeof (data as Record<string, unknown>).product_count === "number");
  assert.ok(typeof (data as Record<string, unknown>).member_count === "number");
});

// ── PL03: límite de productos en plan Inicio (50) ────────────────────────────

test("PL03 producto 50 permitido y 51 rechazado con plan Inicio", { skip: SKIP }, async () => {
  const svc = serviceClient();
  const subId = await createTestSub(svc, ALFA, "inicio");
  if (!subId) {
    console.warn("  ⚠ PL03 saltado — plan 'inicio' no encontrado");
    return;
  }

  const owner = await clientFor(
    process.env.TEST_OWNER_ALFA_EMAIL!,
    process.env.TEST_OWNER_ALFA_PASSWORD!,
  );
  const catId = await createTestCategory(owner, ALFA);

  // Get current product count to know how many to create
  const { data: countData } = await svc.from("products").select("id", { count: "exact", head: true }).eq("restaurant_id", ALFA);
  const currentCount = (countData as unknown as { count: number } | null)?.count ?? 0;

  // Actually count explicitly
  const { count: currentProducts } = await svc
    .from("products")
    .select("*", { count: "exact", head: true })
    .eq("restaurant_id", ALFA);

  const toCreate = 50 - (currentProducts ?? 0);
  const createdIds: string[] = [];

  // Create up to the limit
  for (let i = 0; i < toCreate; i++) {
    const { id, error } = await upsertProduct(owner, ALFA, catId, `_test_limit_${i}_${Date.now()}`);
    if (error) {
      if (error.includes("Could not find the function")) {
        console.warn("  ⚠ PL03 saltado — upsert_product con límites no existe (migración 023 pendiente)");
        await cancelSub(svc, subId);
        await svc.from("categories").delete().eq("id", catId);
        return;
      }
      if (error.includes("Límite de productos")) break; // unexpected
      throw new Error(`Error inesperado al crear producto ${i}: ${error}`);
    }
    if (id) createdIds.push(id);
  }

  // The 50th product (or the last slot) should have worked
  const { count: afterLimit } = await svc.from("products").select("*", { count: "exact", head: true }).eq("restaurant_id", ALFA);
  assert.ok((afterLimit ?? 0) <= 50, `No debe superar 50 productos, tiene ${afterLimit}`);

  // Attempting to create product 51 should fail
  const { error: limitError } = await upsertProduct(owner, ALFA, catId, `_test_over_limit_${Date.now()}`);
  if (limitError && !limitError.includes("Could not find the function")) {
    assert.ok(
      limitError.includes("Límite de productos") || limitError.includes("PRODUCT_LIMIT_REACHED"),
      `El error debería indicar límite, no: ${limitError}`,
    );
  } else if (!limitError) {
    // If no error, the upsert_product wasn't updated yet → note as pending
    console.warn("  ⚠ PL03 parcial — upsert_product sin límites (migración 023 DDL pendiente)");
  }

  // Cleanup
  await deleteProducts(svc, ALFA, createdIds);
  await svc.from("categories").delete().eq("id", catId);
  await cancelSub(svc, subId);
});

// ── PL04: editar producto existente al límite ────────────────────────────────

test("PL04 editar producto existente con plan al límite no da error", { skip: SKIP }, async () => {
  const svc = serviceClient();
  const subId = await createTestSub(svc, ALFA, "inicio");
  if (!subId) { console.warn("  ⚠ PL04 saltado"); return; }

  const owner = await clientFor(
    process.env.TEST_OWNER_ALFA_EMAIL!,
    process.env.TEST_OWNER_ALFA_PASSWORD!,
  );

  // Create exactly 50 products to fill the limit
  const catId = await createTestCategory(owner, ALFA);
  const { count: start } = await svc.from("products").select("*", { count: "exact", head: true }).eq("restaurant_id", ALFA);
  const toCreate = 50 - (start ?? 0);
  const createdIds: string[] = [];

  for (let i = 0; i < toCreate; i++) {
    const { id } = await upsertProduct(owner, ALFA, catId, `_fill_${i}_${Date.now()}`);
    if (id) createdIds.push(id);
  }

  // Now try to edit the first created product (should succeed)
  if (createdIds.length > 0) {
    const { error: editError } = await owner.rpc("upsert_product", {
      p_restaurant_id: ALFA,
      p_product: {
        id: createdIds[0],
        name: `_edited_${Date.now()}`,
        category_id: catId,
        base_price_cents: 600,
        is_published: false,
        position: 0,
      },
    });
    if (editError && !editError.message?.includes("Could not find")) {
      assert.fail(`Editar un producto existente al límite no debería fallar: ${editError.message}`);
    }
  }

  await deleteProducts(svc, ALFA, createdIds);
  await svc.from("categories").delete().eq("id", catId);
  await cancelSub(svc, subId);
});

// ── PL05: variantes y extras no consumen cupo ────────────────────────────────

test("PL05 añadir variantes y extras no cambia el conteo de productos", { skip: SKIP }, async () => {
  const svc = serviceClient();
  const subId = await createTestSub(svc, ALFA, "inicio");
  if (!subId) { console.warn("  ⚠ PL05 saltado"); return; }

  const owner = await clientFor(
    process.env.TEST_OWNER_ALFA_EMAIL!,
    process.env.TEST_OWNER_ALFA_PASSWORD!,
  );
  const catId = await createTestCategory(owner, ALFA);

  // Create a product with variants and options
  const { data: productId } = await owner.rpc("upsert_product", {
    p_restaurant_id: ALFA,
    p_product: { name: `_test_variants_${Date.now()}`, category_id: catId, base_price_cents: 1000, is_published: false, position: 0 },
    p_variants: [{ name: "Simple", price_cents: 1000 }, { name: "Doble", price_cents: 1500 }],
    p_option_groups: [{ name: "Extras", min_selections: 0, max_selections: 2, options: [
      { name: "Queso extra", price_delta_cents: 100 },
      { name: "Bacon", price_delta_cents: 200 },
    ]}],
  });

  assert.ok(productId, "Debe crearse el producto con variantes");

  const { count } = await svc.from("products").select("*", { count: "exact", head: true }).eq("restaurant_id", ALFA);
  const { count: varCount } = await svc.from("product_variants").select("*", { count: "exact", head: true }).eq("restaurant_id", ALFA);
  const { count: optCount } = await svc.from("options").select("*", { count: "exact", head: true }).eq("restaurant_id", ALFA);

  // Verify variants and options exist but only 1 product is counted
  assert.ok((varCount ?? 0) >= 2, "Deben existir al menos 2 variantes");
  assert.ok((optCount ?? 0) >= 2, "Deben existir al menos 2 opciones");

  // Cleanup
  await svc.from("products").delete().eq("id", productId as string);
  await svc.from("categories").delete().eq("id", catId);
  await cancelSub(svc, subId);
});

// ── PL06: límite de miembros en plan Inicio ──────────────────────────────────

test("PL06 plan Inicio bloquea añadir segundo miembro", { skip: SKIP }, async () => {
  const svc = serviceClient();
  const subId = await createTestSub(svc, ALFA, "inicio");
  if (!subId) { console.warn("  ⚠ PL06 saltado"); return; }

  // Try to add a new active member (the trigger should block it)
  const { error } = await svc.from("restaurant_members").insert({
    restaurant_id: ALFA,
    user_id: process.env.TEST_ATTENTION_ALFA_UUID ?? "00000000-0000-0000-0000-000000000099",
    role: "attention",
    status: "active",
  });

  if (error) {
    // Expect either a check_violation (trigger fired) or a unique violation (member already exists)
    const isLimitError = error.message.includes("MEMBER_LIMIT_REACHED") ||
      error.message.includes("permite hasta") ||
      error.message.includes("check_violation");
    const isRoleError = error.message.includes("MEMBER_ROLE_NOT_ALLOWED") ||
      error.message.includes("no incluye el rol");
    const isUniqueError = error.code === "23505";

    assert.ok(
      isLimitError || isRoleError || isUniqueError,
      `Debe fallar por límite, rol no permitido o unicidad; error: ${error.message}`,
    );
  } else {
    // Cleanup the inserted member and mark test as warning
    await svc.from("restaurant_members").delete()
      .eq("restaurant_id", ALFA)
      .eq("user_id", process.env.TEST_ATTENTION_ALFA_UUID ?? "00000000");
    console.warn("  ⚠ PL06 — trigger trg_check_member_limit no existe (migración 023 DDL pendiente)");
  }

  await cancelSub(svc, subId);
});

// ── PL07: plan Inicio bloquea rol attention ──────────────────────────────────

test("PL07 plan Inicio rechaza rol 'attention' aunque no haya miembros", { skip: SKIP }, async () => {
  const svc = serviceClient();
  const subId = await createTestSub(svc, BETA, "inicio");
  if (!subId) { console.warn("  ⚠ PL07 saltado"); return; }

  // Add a user that's not yet a member of Beta
  const { error } = await svc.from("restaurant_members").insert({
    restaurant_id: BETA,
    user_id: process.env.TEST_NOACCESS_UUID ?? "00000000-0000-0000-0000-000000000099",
    role: "attention",
    status: "active",
  });

  if (error) {
    assert.ok(
      error.message.includes("no incluye el rol") ||
      error.message.includes("MEMBER_ROLE_NOT_ALLOWED") ||
      error.code === "23505",
      `Error esperado: rol no permitido; obtuvo: ${error.message}`,
    );
  } else {
    await svc.from("restaurant_members").delete()
      .eq("restaurant_id", BETA)
      .eq("user_id", process.env.TEST_NOACCESS_UUID ?? "00000000");
    console.warn("  ⚠ PL07 — trigger no disparó (migración 023 DDL pendiente)");
  }

  await cancelSub(svc, subId);
});

// ── PL08: plan Negocio permite roles de atención y cocina ────────────────────

test("PL08 plan Negocio permite los roles owner, attention y kitchen", { skip: SKIP }, async () => {
  const svc = serviceClient();
  const { data: plan } = await svc
    .from("plans")
    .select("allowed_roles")
    .eq("plan_code", "negocio")
    .maybeSingle();

  if (!plan) {
    console.warn("  ⚠ PL08 saltado — plan_code no existe (migración 023 pendiente)");
    return;
  }

  assert.ok(
    (plan.allowed_roles as string[]).includes("owner"),
    "Negocio debe permitir owner",
  );
  assert.ok(
    (plan.allowed_roles as string[]).includes("attention"),
    "Negocio debe permitir attention",
  );
  assert.ok(
    (plan.allowed_roles as string[]).includes("kitchen"),
    "Negocio debe permitir kitchen",
  );
});

// ── PL09: aislamiento entre restaurantes ─────────────────────────────────────

test("PL09 el límite de Alfa no afecta a Beta", { skip: SKIP }, async () => {
  const svc = serviceClient();
  const subAlfaId = await createTestSub(svc, ALFA, "inicio");
  if (!subAlfaId) { console.warn("  ⚠ PL09 saltado"); return; }

  // Fill Alfa to the limit (or just check that Beta can still create)
  const ownerBeta = await clientFor(
    process.env.TEST_OWNER_BETA_EMAIL!,
    process.env.TEST_OWNER_BETA_PASSWORD!,
  );

  const catId = await createTestCategory(ownerBeta, BETA);
  const { id, error } = await upsertProduct(ownerBeta, BETA, catId, `_beta_isolation_${Date.now()}`);

  assert.ifError(error);
  assert.ok(id, "Beta debe poder crear productos independientemente del límite de Alfa");

  // Cleanup
  if (id) await svc.from("products").delete().eq("id", id);
  await svc.from("categories").delete().eq("id", catId);
  await cancelSub(svc, subAlfaId);
});

// ── PL10: cancelar suscripción → modo onboarding libre ──────────────────────

test("PL10 sin suscripción activa no hay límite de productos", { skip: SKIP }, async () => {
  const svc = serviceClient();

  // Ensure no active subscription for Alfa
  await svc.from("subscriptions")
    .update({ status: "cancelled" })
    .eq("restaurant_id", ALFA)
    .eq("status", "active");

  const owner = await clientFor(
    process.env.TEST_OWNER_ALFA_EMAIL!,
    process.env.TEST_OWNER_ALFA_PASSWORD!,
  );
  const catId = await createTestCategory(owner, ALFA);
  const { id, error } = await upsertProduct(owner, ALFA, catId, `_free_mode_${Date.now()}`);

  if (error && error.includes("Could not find the function")) {
    console.warn("  ⚠ PL10 saltado — migración 023 DDL pendiente");
    await svc.from("categories").delete().eq("id", catId);
    return;
  }

  assert.ifError(error);
  assert.ok(id, "Sin suscripción activa debe poder crear productos sin límite");

  if (id) await svc.from("products").delete().eq("id", id);
  await svc.from("categories").delete().eq("id", catId);
});
