// Tests de aislamiento de catálogo entre restaurantes.
// Ejecutar con: npm run test:catalog
// Prerequisites: migraciones 004-007 aplicadas, seed + usuarios de prueba.

import test from "node:test";
import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

const ALFA = "aaaaaaaa-0000-0000-0000-000000000001";
const BETA = "bbbbbbbb-0000-0000-0000-000000000002";

const NEEDED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "TEST_OWNER_ALFA_EMAIL",   "TEST_OWNER_ALFA_PASSWORD",
  "TEST_OWNER_BETA_EMAIL",   "TEST_OWNER_BETA_PASSWORD",
  "TEST_ATTENTION_ALFA_EMAIL", "TEST_ATTENTION_ALFA_PASSWORD",
  "TEST_NOACCESS_EMAIL",     "TEST_NOACCESS_PASSWORD",
  "TEST_ADMIN_EMAIL",        "TEST_ADMIN_PASSWORD",
];
const MISSING = NEEDED.filter((k) => !process.env[k]);
const SKIP    = MISSING.length > 0;
if (SKIP) {
  console.warn(`[catalog] Skipped — missing: ${MISSING.join(", ")}`);
}

async function clientFor(email: string, password: string): Promise<SupabaseClient> {
  const resp = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "apikey": ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const json = await resp.json() as Record<string, unknown>;
  if (!resp.ok || !json.access_token) {
    throw new Error(`Auth fallido ${email}: ${String(json.error_description ?? json.error ?? resp.status)}`);
  }
  return createClient(URL, ANON, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${json.access_token}` } },
  });
}

function anonClient(): SupabaseClient {
  return createClient(URL, ANON, { auth: { persistSession: false } });
}

// ── C01: Owner Alfa puede insertar una categoría en su restaurante ────────
test("C01 owner de Alfa crea categoría en Alfa", { skip: SKIP }, async () => {
  const c = await clientFor(process.env.TEST_OWNER_ALFA_EMAIL!, process.env.TEST_OWNER_ALFA_PASSWORD!);
  const { data, error } = await c.from("categories").insert({
    restaurant_id: ALFA,
    name: "Test Categoría Alfa",
    position: 999,
  }).select("id, name").single();
  assert.ifError(error);
  assert.ok(data?.id, "Debe devolver la categoría creada");
  // Cleanup
  await c.from("categories").delete().eq("id", data.id);
});

// ── C02: Owner Alfa NO puede insertar categoría en Beta ──────────────────
test("C02 owner de Alfa NO puede crear categoría en Beta", { skip: SKIP }, async () => {
  const c = await clientFor(process.env.TEST_OWNER_ALFA_EMAIL!, process.env.TEST_OWNER_ALFA_PASSWORD!);
  const { error } = await c.from("categories").insert({
    restaurant_id: BETA,
    name: "Intruso desde Alfa",
    position: 999,
  });
  assert.ok(error != null, "INSERT en Beta por owner de Alfa debe fallar");
});

// ── C03: Owner Alfa puede insertar producto en Alfa ──────────────────────
test("C03 owner de Alfa crea producto en Alfa via upsert_product", { skip: SKIP }, async () => {
  const c = await clientFor(process.env.TEST_OWNER_ALFA_EMAIL!, process.env.TEST_OWNER_ALFA_PASSWORD!);

  // First create a category to reference
  const { data: cat } = await c.from("categories").insert({
    restaurant_id: ALFA, name: "Cat para test C03", position: 998,
  }).select("id").single();
  assert.ok(cat?.id);

  const { data: productId, error } = await c.rpc("upsert_product", {
    p_restaurant_id: ALFA,
    p_product: {
      category_id: cat.id,
      name: "Producto test C03",
      description: "Test",
      base_price_cents: 1000,
      is_available: true,
      is_published: false,
    },
    p_variants: [{ name: "Regular", price_cents: 1000, is_available: true }],
    p_option_groups: [],
  });

  assert.ifError(error);
  assert.ok(typeof productId === "string", "RPC debe devolver el UUID del producto");

  // Cleanup
  await c.from("products").delete().eq("id", productId);
  await c.from("categories").delete().eq("id", cat.id);
});

// ── C04: Owner Alfa NO puede crear producto con categoría de Beta ────────
test("C04 owner de Alfa NO puede usar categoría de Beta en upsert_product", { skip: SKIP }, async () => {
  const adminC = await clientFor(process.env.TEST_ADMIN_EMAIL!, process.env.TEST_ADMIN_PASSWORD!);

  // Admin creates a category in Beta for this test
  const { data: betaCat } = await adminC.from("categories").insert({
    restaurant_id: BETA, name: "Cat Beta para test C04", position: 998,
  }).select("id").single();
  assert.ok(betaCat?.id);

  const alfaC = await clientFor(process.env.TEST_OWNER_ALFA_EMAIL!, process.env.TEST_OWNER_ALFA_PASSWORD!);
  const { error } = await alfaC.rpc("upsert_product", {
    p_restaurant_id: ALFA,
    p_product: {
      category_id: betaCat.id,   // Beta category in Alfa product!
      name: "Intruso",
      base_price_cents: 100,
    },
    p_variants: [],
    p_option_groups: [],
  });

  assert.ok(error != null, "Usar categoría de otro restaurante debe fallar");

  // Cleanup
  await adminC.from("categories").delete().eq("id", betaCat.id);
});

// ── C05: Owner Beta NO puede leer productos de Alfa ──────────────────────
test("C05 owner de Beta no lee productos de Alfa", { skip: SKIP }, async () => {
  const c = await clientFor(process.env.TEST_OWNER_BETA_EMAIL!, process.env.TEST_OWNER_BETA_PASSWORD!);
  const { data, error } = await c.from("products").select("id").eq("restaurant_id", ALFA);
  assert.ifError(error);
  assert.equal(data?.length ?? 0, 0, "Beta no debe ver productos de Alfa");
});

// ── C06: Attention de Alfa NO puede crear ni editar productos ────────────
test("C06 attention de Alfa no puede crear producto", { skip: SKIP }, async () => {
  const c = await clientFor(process.env.TEST_ATTENTION_ALFA_EMAIL!, process.env.TEST_ATTENTION_ALFA_PASSWORD!);
  const { error } = await c.rpc("upsert_product", {
    p_restaurant_id: ALFA,
    p_product: { category_id: "00000000-0000-0000-0000-000000000000", name: "Intruso", base_price_cents: 100 },
    p_variants: [],
    p_option_groups: [],
  });
  assert.ok(error != null, "Attention no debe poder crear productos");
});

// ── C07: Usuario sin membresía no puede leer ni escribir catálogo ────────
test("C07 usuario sin membresía no lee ni escribe catálogo", { skip: SKIP }, async () => {
  const c = await clientFor(process.env.TEST_NOACCESS_EMAIL!, process.env.TEST_NOACCESS_PASSWORD!);
  const { data: cats } = await c.from("categories").select("id");
  assert.equal(cats?.length ?? 0, 0, "Sin membresía: 0 categorías");

  const { data: prods } = await c.from("products").select("id");
  assert.equal(prods?.length ?? 0, 0, "Sin membresía: 0 productos");
});

// ── C08: Anónimo solo lee contenido publicado ────────────────────────────
// Uses owner-alfa for product operations: upsert_product/set_product_published
// require member_role = 'owner'; platform_admin has no restaurant membership.
test("C08 anónimo solo lee categorías activas y productos publicados", { skip: SKIP }, async () => {
  const owner = await clientFor(process.env.TEST_OWNER_ALFA_EMAIL!, process.env.TEST_OWNER_ALFA_PASSWORD!);

  // Create a category and an unpublished product in Alfa
  const { data: cat } = await owner.from("categories").insert({
    restaurant_id: ALFA, name: "Cat anon test C08", position: 997, is_active: true,
  }).select("id").single();
  assert.ok(cat?.id);

  const { data: prodId } = await owner.rpc("upsert_product", {
    p_restaurant_id: ALFA,
    p_product: {
      category_id: cat.id,
      name: "Borrador C08",
      base_price_cents: 500,
      is_published: false,
      is_available: true,
    },
    p_variants: [{ name: "Regular", price_cents: 500, is_available: true }],
    p_option_groups: [],
  });
  assert.ok(prodId, "upsert_product debe devolver un UUID");

  // Anon should NOT see the unpublished product
  const anon = anonClient();
  const { data: anonProds } = await anon.from("products").select("id").eq("id", prodId as string);
  assert.equal(anonProds?.length ?? 0, 0, "Anon no debe ver productos no publicados");

  // Publish the product via owner
  await owner.rpc("set_product_published", {
    p_restaurant_id: ALFA,
    p_product_id: prodId,
    p_published: true,
  });

  // Anon SHOULD see it now
  const { data: anonProdsPublished } = await anon.from("products").select("id").eq("id", prodId as string);
  assert.equal(anonProdsPublished?.length ?? 0, 1, "Anon debe ver producto publicado");

  // Unpublish and confirm disappears
  await owner.rpc("set_product_published", {
    p_restaurant_id: ALFA,
    p_product_id: prodId,
    p_published: false,
  });
  const { data: anonProdsUnpublished } = await anon.from("products").select("id").eq("id", prodId as string);
  assert.equal(anonProdsUnpublished?.length ?? 0, 0, "Después de despublicar: anon no lo ve");

  // Cleanup
  await owner.from("products").delete().eq("id", prodId as string);
  await owner.from("categories").delete().eq("id", cat.id);
});

// ── C09: Aislamiento Storage — owner de Beta no puede subir en Alfa ──────
test("C09 owner de Beta no puede subir imagen al directorio de Alfa", { skip: SKIP }, async () => {
  const c = await clientFor(process.env.TEST_OWNER_BETA_EMAIL!, process.env.TEST_OWNER_BETA_PASSWORD!);
  const fakeFile = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]); // JPEG magic bytes
  const { error } = await c.storage
    .from("product-images")
    .upload(`${ALFA}/test-intrusion.jpg`, fakeFile, { contentType: "image/jpeg", upsert: false });
  assert.ok(error != null, "Beta no debe poder subir al directorio de Alfa en Storage");
});

// ── C10: Composite FK — INSERT producto con categoría de otro restaurante ─
test("C10 INSERT directo con categoría de otro restaurante es bloqueado por FK", { skip: SKIP }, async () => {
  const adminC = await clientFor(process.env.TEST_ADMIN_EMAIL!, process.env.TEST_ADMIN_PASSWORD!);

  // Create category in Beta
  const { data: betaCat } = await adminC.from("categories").insert({
    restaurant_id: BETA, name: "FK test cat C10", position: 996,
  }).select("id").single();

  // Try to insert product in Alfa with Beta's category directly (bypassing RPC)
  const { error } = await adminC.from("products").insert({
    restaurant_id: ALFA,
    category_id: betaCat!.id,  // Cross-restaurant!
    name: "FK violation test",
    base_price_cents: 100,
  });
  assert.ok(error != null, "Composite FK debe bloquear la inserción cross-restaurant");

  // Cleanup
  await adminC.from("categories").delete().eq("id", betaCat!.id);
});
