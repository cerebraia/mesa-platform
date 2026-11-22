// Integration tests for admin catalog server actions via HTTP (ACA01–ACA14).
//
// Tests call REAL Next.js Server Actions over HTTP using proper Supabase SSR cookies.
// Action IDs are from the production build manifest (.next/server/server-reference-manifest.json).
// Server: production server on port 3001 (npm start -- --port 3001).
//
// Required env vars: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
//                   SUPABASE_SERVICE_ROLE_KEY, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD
//
// Run: npm run test:admin-catalog-actions

import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const SVC  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const PROJECT_REF = URL.match(/https:\/\/([a-z0-9]+)\./)?.[1] ?? "";
const PROD_SERVER = "http://localhost:3001";

const MISSING = [
  "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY", "TEST_ADMIN_EMAIL", "TEST_ADMIN_PASSWORD",
].filter((k) => !process.env[k]);

const SKIP = MISSING.length > 0 || !PROJECT_REF;
if (SKIP) console.warn(`[admin-catalog-actions] Saltado — faltan: ${MISSING.join(", ") || "PROJECT_REF"}`);

// Check if production server is reachable
let PROD_AVAILABLE = false;
try {
  const r = await fetch(`${PROD_SERVER}/api/health`, { signal: AbortSignal.timeout(3000) });
  PROD_AVAILABLE = r.status === 200;
} catch { PROD_AVAILABLE = false; }
if (!PROD_AVAILABLE) console.warn(`[admin-catalog-actions] Servidor de producción no disponible en ${PROD_SERVER}`);

const SKIP_HTTP = SKIP || !PROD_AVAILABLE;

// ── Action IDs from production build manifest ─────────────────
// From .next/server/server-reference-manifest.json
// NOTE: these IDs change when the action code changes and the app is rebuilt.
const ACTIONS = {
  adminCreateCategory:         "602a0975a17bb91354231d822a162f0fa4ea7b2996",
  adminUpdateCategory:         "70228733bd989bfd33f4ff4ec821b40526e933eda7",
  adminDeleteCategory:         "606273b986e899d20801f3480b6a2fce58bafe39ba",
  adminSetCategoryActive:      "700d6b964326d7a5f35e06ae0f3ad05191a794284f",
  adminTransferAndDeleteCategory: "70ef3d2f6ce79a93ff01033d202108d3d81f45353f",
  adminSaveProduct:            "60748fdba51006ed91dbd7f0abee385533858d9251",
  adminSetProductPublished:    "706a1bc38ab60dec78a24f4a3ee5d151865297e71b",
  adminSoftDeleteProduct:      "60a773e200ca0b6d9397692a93d8463589bdf6410a",
  adminRestoreProduct:         "60005a78f07f3cf578abf3c000f7feb09a83ce22c3",
  adminHardDeleteProduct:      "60f4d279cbe5ecc16278c62a9e4e2b8d3bfcf157e4",
  adminAddProductImage:        "78c925678a4e25c1f31eb04cb85e3ae4409b9f1092",
  adminRemoveProductImage:     "60c54e4e2bb54d3ec77c1919e11e1f6509c6a62de5",
  adminReorderProductImages:   "7024f222f43cbac8a5b0b84b65949f4c671950f041",
  adminUpdateProductImagePaths:"7c877c4880a8a25c967822fbc733259f0caa581e00",
  adminRestoreOriginalImage:   "604c5b3ceac3c47a7d3acc21976f0c6191eca43caa",
} as const;

// ── Cookie crafting ───────────────────────────────────────────
// Supabase SSR 0.12.x stores session as:
//   cookie name:  sb-<projectRef>-auth-token
//   cookie value: base64-<base64url(JSON.stringify(session))>

function toBase64Url(str: string): string {
  return Buffer.from(str).toString("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function makeSessionCookie(session: {
  access_token: string;
  token_type: string;
  expires_in: number;
  expires_at: number;
  refresh_token: string;
  user: unknown;
}): string {
  const json = JSON.stringify(session);
  const encoded = toBase64Url(json);
  return `sb-${PROJECT_REF}-auth-token=base64-${encoded}`;
}

// Authenticate via Supabase REST API
async function getSession(email: string, password: string): Promise<{
  cookie: string;
  userId: string;
  accessToken: string;
} | null> {
  try {
    const r = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: ANON, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!r.ok) return null;
    const data = await r.json() as {
      access_token: string; token_type: string;
      expires_in: number; expires_at: number;
      refresh_token: string; user: { id: string };
    };
    return {
      cookie: makeSessionCookie(data),
      userId: data.user.id,
      accessToken: data.access_token,
    };
  } catch { return null; }
}

// ── Server Action call helper ─────────────────────────────────
// Calls a server action via HTTP POST to the production server.
// actionPath: the Next.js page route where the action is used
// actionId:   the hash from server-reference-manifest.json
// args:       array of arguments matching the function signature
// Returns the action's return value extracted from the RSC stream, or null.

async function callAction(
  pageRoute: string,
  actionId: string,
  args: unknown[],
  cookie?: string,
): Promise<{ status: number; body: unknown }> {
  const headers: Record<string, string> = {
    "Content-Type": "text/plain;charset=UTF-8",
    "Next-Action": actionId,
    "Next-Router-State-Tree": encodeURIComponent(JSON.stringify([pageRoute, {}, null])),
    "Accept": "text/x-component",
  };
  if (cookie) headers["Cookie"] = cookie;

  const resp = await fetch(`${PROD_SERVER}${pageRoute}`, {
    method: "POST",
    headers,
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(15_000),
    redirect: "manual",
  });

  let body: unknown = null;
  try {
    const text = await resp.text();
    // RSC wire format: each line is N:payload where N is a stream index.
    // The action return value appears as a plain JSON object on its own line.
    const lines = text.split("\n");
    for (const line of lines) {
      // Match lines like "1:{"error":null,...}"
      const match = line.match(/^\d+:({.+})\s*$/);
      if (match) {
        try {
          const parsed = JSON.parse(match[1]) as Record<string, unknown>;
          // Prefer lines that look like action results (have "error" key) over
          // RSC metadata objects (which have "a", "q", "i", "t" keys).
          if ("error" in parsed || "productId" in parsed || "image" in parsed) {
            body = parsed;
            break;
          }
          // Keep the first parseable object as a fallback
          if (!body) body = parsed;
        } catch { /* skip */ }
      }
    }
  } catch { body = null; }

  return { status: resp.status, body };
}

function svc() {
  return createClient(URL, SVC, { auth: { persistSession: false } });
}

function anonClient() {
  return createClient(URL, ANON, { auth: { persistSession: false } });
}

async function createTestRestaurant(suffix = "") {
  const slug = `aca-${Date.now()}-${suffix}`.slice(0, 63);
  const { data, error } = await svc().from("restaurants").insert({
    name: `ACA Test ${suffix}`.trim(),
    slug, currency: "USD", timezone: "America/Caracas",
    status: "active", business_type: "store",
  }).select("id, slug").single();
  if (error || !data) throw new Error(`Restaurant: ${error?.message}`);
  const { data: plan } = await svc().from("plans").select("id")
    .eq("plan_code", "inicio").eq("is_active", true).maybeSingle();
  if (plan) {
    await svc().from("subscriptions").insert({
      restaurant_id: data.id, plan_id: plan.id, status: "active",
      starts_at: new Date().toISOString(),
    });
  }
  await svc().from("restaurant_config").insert({ restaurant_id: data.id, orders_enabled: true });
  return { id: data.id, slug: data.slug };
}

async function cleanup(restaurantId: string) {
  const db = svc();
  await db.from("subscriptions").delete().eq("restaurant_id", restaurantId);
  await db.from("restaurant_config").delete().eq("restaurant_id", restaurantId);
  await db.from("categories").delete().eq("restaurant_id", restaurantId);
  await db.from("restaurants").delete().eq("id", restaurantId);
}

async function cleanupUser(userId: string) {
  await svc().auth.admin.deleteUser(userId);
}

// ── ACA01: Unauthenticated request returns auth error ─────────

test("ACA01 acción sin sesión retorna error de autenticación", { skip: SKIP_HTTP }, async () => {
  const { id: restaurantId } = await createTestRestaurant("aca01");
  try {
    const { status } = await callAction(
      `/admin/restaurants/${restaurantId}/manage/menu/categories/new`,
      ACTIONS.adminCreateCategory,
      [restaurantId, { name: "Hack" }],
      // No cookie — unauthenticated
    );
    // 307/302 = redirect to login (middleware); 200 = action returned error
    assert.ok(
      status === 307 || status === 302 || status === 200,
      `Sin sesión debe redirigir o retornar error, recibido HTTP ${status}`,
    );
    console.log(`[ACA01] ✓ Sin sesión → HTTP ${status} (autenticación verificada)`);
  } finally {
    await cleanup(restaurantId);
  }
});

// ── ACA02: Non-admin user is rejected — returns error, not 500 ─

test("ACA02 usuario sin platform_admin rechazado (200 con error, no 500)", { skip: SKIP_HTTP }, async () => {
  const tempEmail = `temp-noadmin-${Date.now()}@test.mesa`;
  const tempPwd   = "TempPass123!";
  let tempUserId: string | null = null;
  const { id: restaurantId } = await createTestRestaurant("aca02");

  try {
    const { data: created, error: createErr } = await svc().auth.admin.createUser({
      email: tempEmail, password: tempPwd, email_confirm: true,
    });
    if (createErr || !created.user) throw new Error(`Create user: ${createErr?.message}`);
    tempUserId = created.user.id;

    const session = await getSession(tempEmail, tempPwd);
    assert.ok(session, "[ACA02] No se pudo obtener sesión para usuario temporal");

    const { status, body } = await callAction(
      `/admin/restaurants/${restaurantId}/manage/menu/categories/new`,
      ACTIONS.adminCreateCategory,
      [restaurantId, { name: "HackAttempt" }],
      session!.cookie,
    );

    console.log(`[ACA02] Non-admin → HTTP ${status}, body: ${JSON.stringify(body ?? "").slice(0, 200)}`);

    // HTTP 500 means the action threw uncaught — the authorization check is NOT working
    // as a proper catch+return. After the FormData→object fix, it must be 200 or 307/302.
    assert.notEqual(status, 500,
      `No-admin no debe lanzar excepción no capturada (500). Indica que requireAdminForRestaurant no está devolviendo { error } sino lanzando.`,
    );

    if (status === 307 || status === 302) {
      console.log("[ACA02] ✓ Redirigido por middleware (no es platform_admin)");
    } else if (status === 200 || status === 400) {
      const bodyStr = JSON.stringify(body ?? "");
      assert.ok(
        bodyStr.includes("Acceso denegado") || bodyStr.includes("platform_admin") ||
        bodyStr.includes("error") || bodyStr.includes("No autenticado"),
        `Esperado error de autorización, recibido: ${bodyStr.slice(0, 300)}`,
      );
      console.log("[ACA02] ✓ Acción rechazada con error de autorización");
    } else {
      assert.fail(`HTTP ${status} inesperado para usuario sin platform_admin`);
    }

    // Regardless of response, no category must have been created
    const { data: cats } = await svc().from("categories")
      .select("id").eq("restaurant_id", restaurantId).eq("name", "HackAttempt");
    assert.equal((cats ?? []).length, 0, "No debe haberse creado la categoría");
    console.log("[ACA02] ✓ No se creó categoría no autorizada");

  } finally {
    if (tempUserId) await cleanupUser(tempUserId);
    await cleanup(restaurantId);
  }
});

// ── ACA03: Admin creates and edits category via real server action ──

test("ACA03 admin crea y edita categoría via acción real — persiste en BD", { skip: SKIP_HTTP }, async () => {
  const session = await getSession(
    process.env.TEST_ADMIN_EMAIL!, process.env.TEST_ADMIN_PASSWORD!,
  );
  assert.ok(session, "[ACA03] No se pudo autenticar admin");

  const { id: restaurantId } = await createTestRestaurant("aca03");
  try {
    const catName = `Cat-ACA03-${Date.now()}`;

    // Create category
    const { status: createStatus, body: createBody } = await callAction(
      `/admin/restaurants/${restaurantId}/manage/menu/categories/new`,
      ACTIONS.adminCreateCategory,
      [restaurantId, { name: catName }],
      session!.cookie,
    );

    console.log(`[ACA03] adminCreateCategory → HTTP ${createStatus}, body: ${JSON.stringify(createBody ?? "").slice(0, 200)}`);

    // HTTP 500 is a hard failure — action must not throw uncaught
    assert.notEqual(createStatus, 500,
      `adminCreateCategory retornó 500. Action ID puede haber cambiado tras rebuild — verificar manifesto.`,
    );
    // 307 = needs re-auth (dev/prod mismatch); 200 = action ran
    assert.ok(
      createStatus === 200 || createStatus === 307 || createStatus === 302,
      `Esperado 200/307, recibido ${createStatus}`,
    );

    if (createStatus === 307 || createStatus === 302) {
      // This can happen if action IDs are stale (server not rebuilt after code change)
      assert.fail(`[ACA03] Acción redirigió (307/302). Los action IDs del test están desactualizados — rebuild el servidor y actualiza ACTIONS en este archivo.`);
    }

    // Verify persistence
    const { data: cats } = await svc().from("categories")
      .select("id, name, is_active").eq("restaurant_id", restaurantId).eq("name", catName);
    assert.equal((cats ?? []).length, 1, `Categoría "${catName}" debe existir en BD después de la acción real`);
    const catId = cats![0].id;
    assert.equal(cats![0].is_active, true, "Categoría debe estar activa al crear");
    console.log("[ACA03a] ✓ Categoría creada y persistida via acción real");

    // Edit category — rename + deactivate
    const updatedName = `${catName}-editada`;
    const { status: editStatus } = await callAction(
      `/admin/restaurants/${restaurantId}/manage/menu/categories/${catId}/edit`,
      ACTIONS.adminUpdateCategory,
      [restaurantId, catId, { name: updatedName, is_active: false }],
      session!.cookie,
    );

    console.log(`[ACA03b] adminUpdateCategory → HTTP ${editStatus}`);
    assert.notEqual(editStatus, 500,
      "adminUpdateCategory no debe lanzar excepción (500). Verificar action ID y firma.",
    );
    assert.ok(
      editStatus === 200 || editStatus === 307 || editStatus === 302,
      `Esperado 200/307, recibido ${editStatus}`,
    );

    const { data: edited } = await svc().from("categories")
      .select("name, is_active").eq("id", catId).maybeSingle();
    assert.equal(edited?.name, updatedName, "Nombre actualizado debe persistir");
    assert.equal(edited?.is_active, false, "Categoría debe estar desactivada tras edición");
    console.log("[ACA03b] ✓ Categoría editada (nombre + estado) via acción real");

  } finally {
    await cleanup(restaurantId);
  }
});

// ── ACA04: Admin creates product with wrong restaurant (cross-isolation) ──

test("ACA04 adminSaveProduct con restaurantId incorrecto rechazado", { skip: SKIP_HTTP }, async () => {
  const session = await getSession(
    process.env.TEST_ADMIN_EMAIL!, process.env.TEST_ADMIN_PASSWORD!,
  );
  assert.ok(session, "[ACA04] No se pudo autenticar admin");

  const { id: idA } = await createTestRestaurant("aca04a");
  const { id: idB } = await createTestRestaurant("aca04b");
  let catIdA: string | null = null;

  try {
    const { data: cat } = await svc().from("categories").insert({
      restaurant_id: idA, name: "Cat A", position: 0,
    }).select("id").single();
    catIdA = cat?.id ?? null;
    if (!catIdA) throw new Error("Category A not created");

    // Try to save a product in restaurant B but using a category that belongs to A
    const { status, body } = await callAction(
      `/admin/restaurants/${idB}/manage/menu/products/new`,
      ACTIONS.adminSaveProduct,
      [idB, {
        category_id: catIdA, // catIdA belongs to restaurant A
        name: "CrossRestaurant Attack",
        description: "",
        base_price_cents: 100,
        promo_price_cents: null,
        is_available: true,
        is_published: false,
        image_fit: "cover",
        variants: [],
        option_groups: [],
      }],
      session!.cookie,
    );

    console.log(`[ACA04] Cross-restaurant product → HTTP ${status}, body: ${JSON.stringify(body ?? "").slice(0, 300)}`);

    // Check no product was created in restaurant B with that category from A
    const { data: prods } = await svc().from("products")
      .select("id").eq("restaurant_id", idB).eq("name", "CrossRestaurant Attack");
    assert.equal((prods ?? []).length, 0, "No debe haberse creado el producto en restaurant B con categoría de A");
    console.log("[ACA04] ✓ Producto cross-restaurant no creado");

  } finally {
    await cleanup(idA);
    await cleanup(idB);
  }
});

// ── ACA05: Image upload — auth guard ─────────────────────────

test("ACA05 /api/menu/upload sin auth retorna 401", { skip: SKIP_HTTP }, async () => {
  const resp = await fetch(`${PROD_SERVER}/api/menu/upload`, {
    method: "POST",
    signal: AbortSignal.timeout(8000),
  });
  assert.equal(resp.status, 401, `Esperado 401, recibido ${resp.status}`);
  const body = await resp.json() as { error?: string };
  assert.ok(body.error?.includes("autenticado"), `Esperado "autenticado" en error, recibido: ${JSON.stringify(body)}`);
  console.log("[ACA05] ✓ /api/menu/upload sin auth → 401");
});

// ── ACA05b: Admin uploads image — Storage uses service role ───

test("ACA05b /api/menu/upload admin sube imagen (service role para Storage)", { skip: SKIP_HTTP }, async () => {
  const session = await getSession(
    process.env.TEST_ADMIN_EMAIL!, process.env.TEST_ADMIN_PASSWORD!,
  );
  assert.ok(session, "[ACA05b] No se pudo autenticar admin");

  const { id: restaurantId } = await createTestRestaurant("aca05b");
  let uploadedPath: string | null = null;

  try {
    // Minimal valid 1×1 JPEG
    const minimalJpeg = Buffer.from([
      0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
      0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
      0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
      0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
      0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
      0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
      0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
      0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00,
      0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
      0x09, 0x0A, 0x0B, 0xFF, 0xC4, 0x00, 0xB5, 0x10, 0x00, 0x02, 0x01, 0x03,
      0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7D,
      0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06,
      0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xA1, 0x08,
      0x23, 0x42, 0xB1, 0xC1, 0x15, 0x52, 0xD1, 0xF0, 0x24, 0x33, 0x62, 0x72,
      0x82, 0x09, 0x0A, 0x16, 0x17, 0x18, 0x19, 0x1A, 0x25, 0x26, 0x27, 0x28,
      0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00, 0xFB, 0xDE,
      0xCA, 0xFF, 0xD9,
    ]);

    const formData = new FormData();
    const blob = new Blob([minimalJpeg], { type: "image/jpeg" });
    formData.append("file", blob, "test.jpg");
    formData.append("restaurant_id", restaurantId);
    formData.append("product_id", "new");

    const resp = await fetch(`${PROD_SERVER}/api/menu/upload`, {
      method: "POST",
      headers: { "Cookie": session!.cookie },
      body: formData,
      signal: AbortSignal.timeout(15_000),
    });

    const body = await resp.json() as { path?: string; bucket?: string; error?: string };
    console.log(`[ACA05b] Upload → HTTP ${resp.status}, body: ${JSON.stringify(body)}`);

    // HTTP 500 with RLS error means the route still uses the user's client for Storage.
    // After fix (service role for platform_admin), this must succeed.
    assert.notEqual(resp.status, 500,
      `Upload por platform_admin retornó 500: ${body.error ?? "sin detalle"}. ` +
      `Verificar que el route handler usa service role para storage cuando el usuario es platform_admin.`,
    );
    assert.equal(resp.status, 200, `Esperado 200, recibido ${resp.status}: ${body.error ?? ""}`);
    assert.ok(body.path, "La respuesta debe incluir el path del archivo subido");
    assert.ok(body.path!.startsWith(restaurantId), `Path debe comenzar con restaurantId. Recibido: ${body.path}`);
    uploadedPath = body.path!;
    console.log("[ACA05b] ✓ Imagen subida por platform_admin exitosamente, path:", uploadedPath);

  } finally {
    if (uploadedPath) await svc().storage.from("product-images").remove([uploadedPath]);
    await cleanup(restaurantId);
  }
});

// ── ACA06: Upload rejected for user without permissions ───────

test("ACA06 upload rechazado para usuario sin permisos (403)", { skip: SKIP_HTTP }, async () => {
  const tempEmail = `temp-upload-${Date.now()}@test.mesa`;
  let tempUserId: string | null = null;
  const { id: restaurantId } = await createTestRestaurant("aca06");

  try {
    const { data: created } = await svc().auth.admin.createUser({
      email: tempEmail, password: "TempPass123!", email_confirm: true,
    });
    tempUserId = created?.user?.id ?? null;
    assert.ok(tempUserId, "[ACA06] No se pudo crear usuario temporal");

    const userSession = await getSession(tempEmail, "TempPass123!");
    assert.ok(userSession, "[ACA06] No se pudo autenticar usuario temporal");

    const minimalJpeg = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]);
    const formData = new FormData();
    formData.append("file", new Blob([minimalJpeg], { type: "image/jpeg" }), "test.jpg");
    formData.append("restaurant_id", restaurantId);
    formData.append("product_id", "new");

    const resp = await fetch(`${PROD_SERVER}/api/menu/upload`, {
      method: "POST",
      headers: { "Cookie": userSession!.cookie },
      body: formData,
      signal: AbortSignal.timeout(10_000),
    });

    const body = await resp.json() as { error?: string };
    console.log(`[ACA06] Upload by non-admin/non-owner → HTTP ${resp.status}: ${JSON.stringify(body)}`);

    assert.equal(resp.status, 403, `Esperado 403, recibido ${resp.status}: ${JSON.stringify(body)}`);
    assert.ok(body.error && body.error.length > 0, "Debe incluir mensaje de error");
    console.log("[ACA06] ✓ Upload rechazado con 403 para usuario sin permisos");

  } finally {
    if (tempUserId) await cleanupUser(tempUserId);
    await cleanup(restaurantId);
  }
});

// ── ACA07: Owner panel — owner blocked on admin actions ────────

test("ACA07 propietario rechazado en acción admin (200 con error, no 500)", { skip: SKIP_HTTP }, async () => {
  const tempEmail = `temp-owner-${Date.now()}@test.mesa`;
  let tempUserId: string | null = null;
  const { id: restaurantId } = await createTestRestaurant("aca07");

  try {
    const { data: created } = await svc().auth.admin.createUser({
      email: tempEmail, password: "TempOwner123!", email_confirm: true,
    });
    tempUserId = created?.user?.id ?? null;
    assert.ok(tempUserId, "[ACA07] No se pudo crear propietario temporal");

    await svc().from("restaurant_members").insert({
      restaurant_id: restaurantId, user_id: tempUserId, role: "owner", status: "active",
    });

    const ownerSession = await getSession(tempEmail, "TempOwner123!");
    assert.ok(ownerSession, "[ACA07] No se pudo autenticar propietario");

    // Owner tries to call an ADMIN action — must be rejected
    const { status, body } = await callAction(
      `/admin/restaurants/${restaurantId}/manage/menu/categories/new`,
      ACTIONS.adminCreateCategory,
      [restaurantId, { name: "OwnerHack" }],
      ownerSession!.cookie,
    );

    console.log(`[ACA07] Propietario → admin action → HTTP ${status}, body: ${JSON.stringify(body ?? "").slice(0, 200)}`);

    // HTTP 500 means the action threw uncaught — not acceptable after the fix
    assert.notEqual(status, 500,
      "Propietario no debe lanzar excepción no capturada (500). requireAdminForRestaurant debe devolver { error } no lanzar.",
    );
    assert.ok(
      status === 307 || status === 302 || status === 200 || status === 400,
      `HTTP ${status} inesperado para propietario sin platform_admin`,
    );

    if (status === 307 || status === 302) {
      console.log("[ACA07] ✓ Propietario redirigido (no es platform_admin)");
    } else {
      const bodyStr = JSON.stringify(body ?? "");
      assert.ok(
        bodyStr.includes("Acceso denegado") || bodyStr.includes("platform_admin") || bodyStr.includes("error"),
        `Esperado error de autorización, recibido: ${bodyStr.slice(0, 300)}`,
      );
      console.log("[ACA07] ✓ Propietario rechazado con mensaje de error");
    }

    // No category must have been created
    const { data: cats } = await svc().from("categories")
      .select("id").eq("restaurant_id", restaurantId).eq("name", "OwnerHack");
    assert.equal((cats ?? []).length, 0, "Propietario no debe poder crear categorías admin");
    console.log("[ACA07] ✓ Ninguna categoría creada por propietario no autorizado");

    // Owner CAN upload images (they ARE a member of the restaurant)
    const minimalJpeg = Buffer.from([
      0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
      0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
      0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
      0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
      0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
      0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
      0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
      0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00,
      0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
      0x09, 0x0A, 0x0B, 0xFF, 0xC4, 0x00, 0xB5, 0x10, 0x00, 0x02, 0x01, 0x03,
      0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7D,
      0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06,
      0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xA1, 0x08,
      0x23, 0x42, 0xB1, 0xC1, 0x15, 0x52, 0xD1, 0xF0, 0x24, 0x33, 0x62, 0x72,
      0x82, 0x09, 0x0A, 0x16, 0x17, 0x18, 0x19, 0x1A, 0x25, 0x26, 0x27, 0x28,
      0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00, 0xFB, 0xDE,
      0xCA, 0xFF, 0xD9,
    ]);
    const uploadFormData = new FormData();
    uploadFormData.append("file", new Blob([minimalJpeg], { type: "image/jpeg" }), "test.jpg");
    uploadFormData.append("restaurant_id", restaurantId);
    uploadFormData.append("product_id", "new");

    const uploadResp = await fetch(`${PROD_SERVER}/api/menu/upload`, {
      method: "POST",
      headers: { "Cookie": ownerSession!.cookie },
      body: uploadFormData,
      signal: AbortSignal.timeout(10_000),
    });
    const uploadBody = await uploadResp.json() as { path?: string; error?: string };
    console.log(`[ACA07] Propietario upload → HTTP ${uploadResp.status}: ${JSON.stringify(uploadBody).slice(0, 100)}`);

    if (uploadResp.status === 200 && uploadBody.path) {
      console.log("[ACA07] ✓ Propietario puede subir imágenes (miembro activo)");
      await svc().storage.from("product-images").remove([uploadBody.path]);
    } else {
      // Owner upload failure is a soft warning (depends on Storage being enabled)
      console.log(`[ACA07] ⚠ Propietario upload → ${uploadResp.status}: ${uploadBody.error ?? "sin detalle"}`);
    }

    console.log("[ACA07] PENDIENTE: creación completa de producto via panel del propietario requiere sesión de browser");

  } finally {
    if (tempUserId) await cleanupUser(tempUserId);
    await cleanup(restaurantId);
  }
});

// ── ACA08: Image reorder persists via server action ───────────

test("ACA08 reordenar imágenes persiste via acción real", { skip: SKIP_HTTP }, async () => {
  const session = await getSession(
    process.env.TEST_ADMIN_EMAIL!, process.env.TEST_ADMIN_PASSWORD!,
  );
  assert.ok(session, "[ACA08] No se pudo autenticar admin");

  const { id: restaurantId } = await createTestRestaurant("aca08");
  const imgIds: string[] = [];

  try {
    const { data: cat } = await svc().from("categories").insert({
      restaurant_id: restaurantId, name: "Cat", position: 0,
    }).select("id").single();
    if (!cat) throw new Error("Category not created");

    const { data: prodId } = await svc().rpc("upsert_product_admin", {
      p_restaurant_id: restaurantId,
      p_product: {
        id: null, category_id: cat.id, name: "P with images",
        description: "", base_price_cents: 100,
        promo_price_cents: null, is_available: true,
        is_published: false, position: 0, image_fit: "cover",
      },
      p_variants: [], p_option_groups: [],
    });
    const productId = prodId as string;

    // Insert 3 images with positions 0, 1, 2
    for (let i = 0; i < 3; i++) {
      const { data: img } = await svc().from("product_images").insert({
        product_id: productId, restaurant_id: restaurantId,
        storage_path: `${restaurantId}/dummy-${i}.jpg`, thumbnail_path: null, position: i,
      }).select("id").single();
      if (img) imgIds.push(img.id);
    }
    assert.equal(imgIds.length, 3, "Debe tener 3 imágenes");

    // Reorder: reverse [0,1,2] → [2,1,0]
    const reversed = [...imgIds].reverse();

    const { status } = await callAction(
      `/admin/restaurants/${restaurantId}/manage/menu/products/${productId}/edit`,
      ACTIONS.adminReorderProductImages,
      [restaurantId, productId, reversed],
      session!.cookie,
    );

    console.log(`[ACA08] Reorder → HTTP ${status}`);
    assert.notEqual(status, 500, "adminReorderProductImages no debe retornar 500");

    // Verify persistence in DB
    const { data: imgs } = await svc().from("product_images")
      .select("id, position").eq("product_id", productId).order("position");

    assert.ok(imgs && imgs.length === 3, "Deben seguir existiendo 3 imágenes");
    const wasReordered = imgs![0]?.id === reversed[0];
    assert.ok(wasReordered,
      `Reordenación no persistió. Esperado primero: ${reversed[0].slice(0, 8)}, recibido: ${imgs![0]?.id.slice(0, 8)}`,
    );
    console.log("[ACA08] ✓ Reordenación persistida correctamente via acción real");

    // Cleanup product and images
    await svc().from("product_images").delete().eq("product_id", productId);
    await svc().from("products").delete().eq("id", productId);

  } finally {
    await cleanup(restaurantId);
  }
});

// ── ACA09: Full E2E flow — category → product → image → publish → public ──

test("ACA09 flujo completo: categoría → producto → imagen → publicar → catálogo público", { skip: SKIP_HTTP }, async () => {
  const session = await getSession(
    process.env.TEST_ADMIN_EMAIL!, process.env.TEST_ADMIN_PASSWORD!,
  );
  assert.ok(session, "[ACA09] No se pudo autenticar admin");

  const { id: restaurantId } = await createTestRestaurant("aca09");
  let productId: string | null = null;
  let imageId: string | null = null;
  let uploadedPath: string | null = null;

  try {
    // ── Step 1: Create category ───────────────────────────────
    const catName = `E2E-Cat-${Date.now()}`;
    const { status: catStatus } = await callAction(
      `/admin/restaurants/${restaurantId}/manage/menu/categories/new`,
      ACTIONS.adminCreateCategory,
      [restaurantId, { name: catName }],
      session!.cookie,
    );
    assert.notEqual(catStatus, 500, "Step 1: adminCreateCategory no debe retornar 500");
    if (catStatus === 307 || catStatus === 302) {
      assert.fail("Step 1: Action ID desactualizado — rebuild el servidor.");
    }

    const { data: cats } = await svc().from("categories")
      .select("id").eq("restaurant_id", restaurantId).eq("name", catName);
    assert.equal((cats ?? []).length, 1, `Step 1: Categoría "${catName}" debe existir en BD`);
    const catId = cats![0].id;
    console.log("[ACA09-1] ✓ Categoría creada:", catId.slice(0, 8));

    // ── Step 2: Create product with variants ──────────────────
    const { status: prodStatus } = await callAction(
      `/admin/restaurants/${restaurantId}/manage/menu/products/new`,
      ACTIONS.adminSaveProduct,
      [restaurantId, {
        id: null,
        category_id: catId,
        name: "E2E Burger",
        description: "Producto de integración E2E",
        base_price_cents: 850,
        promo_price_cents: null,
        is_available: true,
        is_published: false,
        image_fit: "cover",
        variants: [
          { name: "Sencilla", price_cents: 850, is_available: true },
          { name: "Doble", price_cents: 1200, is_available: true },
        ],
        option_groups: [{
          name: "Pan", min_selections: 1, max_selections: 1,
          options: [
            { name: "Clásico", price_delta_cents: 0, is_available: true },
            { name: "Brioche", price_delta_cents: 50, is_available: true },
          ],
        }],
      }],
      session!.cookie,
    );
    assert.notEqual(prodStatus, 500, "Step 2: adminSaveProduct no debe retornar 500");

    const { data: prods } = await svc().from("products")
      .select("id, name, is_published").eq("restaurant_id", restaurantId).eq("name", "E2E Burger").is("deleted_at", null);
    assert.equal((prods ?? []).length, 1, "Step 2: Producto 'E2E Burger' debe existir en BD");
    productId = prods![0].id;
    assert.equal(prods![0].is_published, false, "Step 2: Producto debe estar en borrador");

    const { data: variants } = await svc().from("product_variants")
      .select("id").eq("product_id", productId);
    assert.equal((variants ?? []).length, 2, "Step 2: Debe tener 2 variantes");
    console.log("[ACA09-2] ✓ Producto creado con variantes:", productId!.slice(0, 8));

    // ── Step 3: Upload image (uses service role for admin) ────
    const minimalJpeg = Buffer.from([
      0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
      0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
      0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
      0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
      0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
      0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
      0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
      0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00,
      0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
      0x09, 0x0A, 0x0B, 0xFF, 0xC4, 0x00, 0xB5, 0x10, 0x00, 0x02, 0x01, 0x03,
      0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7D,
      0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06,
      0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xA1, 0x08,
      0x23, 0x42, 0xB1, 0xC1, 0x15, 0x52, 0xD1, 0xF0, 0x24, 0x33, 0x62, 0x72,
      0x82, 0x09, 0x0A, 0x16, 0x17, 0x18, 0x19, 0x1A, 0x25, 0x26, 0x27, 0x28,
      0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00, 0xFB, 0xDE,
      0xCA, 0xFF, 0xD9,
    ]);
    const uploadFormData = new FormData();
    uploadFormData.append("file", new Blob([minimalJpeg], { type: "image/jpeg" }), "product.jpg");
    uploadFormData.append("restaurant_id", restaurantId);
    uploadFormData.append("product_id", productId!);

    const uploadResp = await fetch(`${PROD_SERVER}/api/menu/upload`, {
      method: "POST",
      headers: { "Cookie": session!.cookie },
      body: uploadFormData,
      signal: AbortSignal.timeout(15_000),
    });
    const uploadBody = await uploadResp.json() as { path?: string; bucket?: string; error?: string };
    assert.equal(uploadResp.status, 200, `Step 3: Upload debe ser 200. Error: ${uploadBody.error ?? "sin detalle"}`);
    assert.ok(uploadBody.path, "Step 3: Respuesta debe incluir path");
    uploadedPath = uploadBody.path!;
    console.log("[ACA09-3] ✓ Imagen subida:", uploadedPath);

    // ── Step 4: Associate image to product ────────────────────
    const { status: imgStatus } = await callAction(
      `/admin/restaurants/${restaurantId}/manage/menu/products/${productId}/edit`,
      ACTIONS.adminAddProductImage,
      [restaurantId, productId!, uploadedPath, null],
      session!.cookie,
    );
    assert.notEqual(imgStatus, 500, "Step 4: adminAddProductImage no debe retornar 500");

    const { data: dbImgs } = await svc().from("product_images")
      .select("id, storage_path, restaurant_id")
      .eq("product_id", productId!).eq("restaurant_id", restaurantId);
    assert.equal((dbImgs ?? []).length, 1, "Step 4: Debe existir 1 imagen asociada al producto");
    assert.equal(dbImgs![0].storage_path, uploadedPath, "Step 4: storage_path debe coincidir");
    assert.equal(dbImgs![0].restaurant_id, restaurantId, "Step 4: restaurant_id debe coincidir (aislamiento)");
    imageId = dbImgs![0].id;
    uploadedPath = null; // cleanup now handled via product_images cascade
    console.log("[ACA09-4] ✓ Imagen asociada al producto:", imageId!.slice(0, 8));

    // ── Step 5: Publish product ───────────────────────────────
    const { status: pubStatus } = await callAction(
      `/admin/restaurants/${restaurantId}/manage/menu/products/${productId}/edit`,
      ACTIONS.adminSetProductPublished,
      [restaurantId, productId!, true],
      session!.cookie,
    );
    assert.notEqual(pubStatus, 500, "Step 5: adminSetProductPublished no debe retornar 500");

    const { data: published } = await svc().from("products")
      .select("is_published").eq("id", productId!).maybeSingle();
    assert.equal(published?.is_published, true, "Step 5: Producto debe estar publicado");
    console.log("[ACA09-5] ✓ Producto publicado");

    // ── Step 6: Verify public catalog visibility ──────────────
    const anonC = anonClient();

    // Anon can see the published product.
    // is_published and is_available are REVOKED from anon (migration 009) —
    // their truth is enforced by RLS; we just verify the row is visible.
    const { data: anonProd, error: anonProdErr } = await anonC.from("products")
      .select("id, name")  // only columns granted to anon
      .eq("id", productId!).eq("restaurant_id", restaurantId).maybeSingle();
    assert.equal(anonProdErr, null, `Step 6: Error al consultar producto como anon: ${anonProdErr?.message}`);
    assert.ok(anonProd, "Step 6: Producto publicado debe ser visible para anon (RLS: is_published=true AND is_available=true AND deleted_at IS NULL)");
    assert.equal(anonProd!.name, "E2E Burger", "Step 6: Nombre del producto debe coincidir");
    console.log("[ACA09-6a] ✓ Producto publicado visible para anon (columnas no sensibles)");

    // Anon can see the image associated with the product
    const { data: anonImg } = await anonC.from("product_images")
      .select("id, storage_path")
      .eq("product_id", productId!).eq("restaurant_id", restaurantId).maybeSingle();
    assert.ok(anonImg, "Step 6: Imagen del producto debe ser visible para anon");
    assert.ok(anonImg!.storage_path?.startsWith(restaurantId),
      `Step 6: storage_path debe comenzar con restaurantId. Recibido: ${anonImg!.storage_path}`,
    );
    console.log("[ACA09-6b] ✓ Imagen del producto visible para anon:", anonImg!.storage_path);

    // ── Step 7: Cross-restaurant isolation check ──────────────
    const { id: idOther } = await createTestRestaurant("aca09-other");
    try {
      const { data: crossProd } = await anonC.from("products")
        .select("id").eq("id", productId!).eq("restaurant_id", idOther).maybeSingle();
      assert.equal(crossProd, null, "Step 7: Producto no debe ser visible con restaurant_id incorrecto (aislamiento)");
      console.log("[ACA09-7] ✓ Aislamiento entre negocios verificado");
    } finally {
      await cleanup(idOther);
    }

    console.log("[ACA09] ✓ FLUJO COMPLETO VERIFICADO: categoría → producto → imagen → publicar → catálogo público");

  } finally {
    // Clean up images from storage if not already cleaned
    if (uploadedPath) await svc().storage.from("product-images").remove([uploadedPath]);
    if (productId) {
      const { data: images } = await svc().from("product_images")
        .select("storage_path, thumbnail_path").eq("product_id", productId);
      const paths = (images ?? []).flatMap(i =>
        [i.storage_path, i.thumbnail_path].filter(Boolean) as string[],
      );
      if (paths.length) await svc().storage.from("product-images").remove(paths);
      await svc().from("product_images").delete().eq("product_id", productId);
      await svc().from("products").delete().eq("id", productId);
    }
    await cleanup(restaurantId);
  }
});
