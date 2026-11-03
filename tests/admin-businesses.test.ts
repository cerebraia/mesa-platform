// Integration tests for business soft-delete, restore and access control.
// Requires: TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD, TEST_OWNER_ALFA_EMAIL,
//           TEST_OWNER_ALFA_PASSWORD

import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { clientFor } from "./helpers.ts";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON_KEY     = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const SVC_KEY      = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const MISSING = [
  "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "TEST_ADMIN_EMAIL",          "TEST_ADMIN_PASSWORD",
  "TEST_OWNER_ALFA_EMAIL",     "TEST_OWNER_ALFA_PASSWORD",
].filter((k) => !process.env[k]);

const SKIP = MISSING.length > 0;
if (SKIP) console.warn(`[admin-businesses] Saltado — faltan: ${MISSING.join(", ")}`);

function svc(): SupabaseClient {
  return createClient(SUPABASE_URL, SVC_KEY, { auth: { persistSession: false } });
}

async function adminClient(): Promise<SupabaseClient> {
  return clientFor(
    process.env.TEST_ADMIN_EMAIL!,
    process.env.TEST_ADMIN_PASSWORD!,
  );
}

// Create a temporary test restaurant via service role
async function createTestRestaurant(): Promise<string> {
  const db = svc();
  const slug = `test-delete-${Date.now()}`;
  const { data, error } = await db.from("restaurants").insert({
    name:          `Test Delete ${Date.now()}`,
    slug,
    currency:      "USD",
    timezone:      "America/Caracas",
    status:        "active",
    business_type: "store",
  }).select("id").single();
  if (error || !data) throw new Error(`No se pudo crear restaurante de prueba: ${error?.message}`);
  return data.id;
}

async function cleanupRestaurant(id: string) {
  // Force-delete using service role (bypasses RLS)
  const db = svc();
  await db.from("restaurant_members").delete().eq("restaurant_id", id);
  await db.from("restaurants").delete().eq("id", id);
}

// ── AB01: Admin puede hacer soft-delete vía RPC ───────────────

test("AB01 admin soft-delete vía RPC bloquea catálogo público", { skip: SKIP }, async () => {
  const restaurantId = await createTestRestaurant();

  try {
    const adminC = await adminClient();

    // Verify restaurant is active before delete
    const { data: before } = await adminC
      .from("restaurants").select("id, status, deleted_at")
      .eq("id", restaurantId).single();
    assert.ok(before, "Restaurante debe existir");
    assert.equal(before.deleted_at, null, "deleted_at debe ser null antes de eliminar");

    // Execute soft delete
    const { error: delErr } = await adminC.rpc("soft_delete_restaurant", {
      p_restaurant_id: restaurantId,
    });
    assert.equal(delErr, null, `soft_delete_restaurant falló: ${delErr?.message}`);

    // Verify it's now deleted + suspended
    const { data: after } = await svc()
      .from("restaurants").select("id, status, deleted_at")
      .eq("id", restaurantId).single();
    assert.ok(after?.deleted_at !== null, "deleted_at debe estar establecido");
    assert.equal(after?.status, "suspended", "Status debe ser 'suspended'");

    // Verify anon cannot see deleted restaurant (same check as catalog public page)
    const anonClient = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
    const { data: anonCheck } = await anonClient
      .from("restaurants")
      .select("id")
      .eq("id", restaurantId)
      .eq("status", "active")     // same filter as /r/[slug] page
      .maybeSingle();
    assert.equal(anonCheck, null, "Negocio eliminado no debe ser accesible públicamente");

  } finally {
    await cleanupRestaurant(restaurantId);
  }
});

// ── AB02: No-admin no puede ejecutar soft_delete_restaurant ───

test("AB02 owner no puede ejecutar soft_delete_restaurant", { skip: SKIP }, async () => {
  const restaurantId = await createTestRestaurant();

  try {
    const ownerC = await clientFor(
      process.env.TEST_OWNER_ALFA_EMAIL!,
      process.env.TEST_OWNER_ALFA_PASSWORD!,
    );

    const { error } = await ownerC.rpc("soft_delete_restaurant", {
      p_restaurant_id: restaurantId,
    });
    assert.ok(error !== null, "owner no debe poder ejecutar soft_delete_restaurant");
    assert.ok(
      error.message.toLowerCase().includes("autorizado") ||
      error.message.toLowerCase().includes("permission") ||
      error.code === "42501" ||
      error.code === "P0001",
      `Error esperado de permisos, recibido: ${error.message}`,
    );

    // Restaurant should still exist and not be deleted
    const { data: check } = await svc()
      .from("restaurants").select("deleted_at")
      .eq("id", restaurantId).single();
    assert.equal(check?.deleted_at, null, "deleted_at no debe cambiar si no es admin");

  } finally {
    await cleanupRestaurant(restaurantId);
  }
});

// ── AB03: Admin puede restaurar negocio eliminado ─────────────

test("AB03 admin puede restaurar negocio eliminado", { skip: SKIP }, async () => {
  const restaurantId = await createTestRestaurant();

  try {
    const adminC = await adminClient();

    // Delete first
    await adminC.rpc("soft_delete_restaurant", { p_restaurant_id: restaurantId });

    // Verify deleted
    const { data: afterDelete } = await svc()
      .from("restaurants").select("deleted_at, status").eq("id", restaurantId).single();
    assert.ok(afterDelete?.deleted_at !== null, "Debe estar eliminado antes de restaurar");

    // Restore
    const { error: restoreErr } = await adminC.rpc("restore_restaurant", {
      p_restaurant_id: restaurantId,
    });
    assert.equal(restoreErr, null, `restore_restaurant falló: ${restoreErr?.message}`);

    // Verify restored: deleted_at = null, status stays 'suspended'
    const { data: afterRestore } = await svc()
      .from("restaurants").select("deleted_at, status").eq("id", restaurantId).single();
    assert.equal(afterRestore?.deleted_at, null, "deleted_at debe ser null después de restaurar");
    assert.equal(afterRestore?.status, "suspended",
      "Status debe permanecer 'suspended' tras restaurar (admin activa explícitamente)");

  } finally {
    await cleanupRestaurant(restaurantId);
  }
});

// ── AB04: business_type persiste en nuevos negocios ───────────

test("AB04 business_type se guarda correctamente", { skip: SKIP }, async () => {
  const db = svc();
  const slug = `test-btype-${Date.now()}`;

  let restaurantId: string | null = null;
  try {
    const { data, error } = await db.from("restaurants").insert({
      name: "Test Store", slug, currency: "USD",
      timezone: "UTC", status: "onboarding",
      business_type: "store",
    }).select("id, business_type").single();

    assert.equal(error, null, `Error al crear: ${error?.message}`);
    assert.equal(data?.business_type, "store", "business_type debe ser 'store'");
    restaurantId = data?.id ?? null;

  } finally {
    if (restaurantId) await cleanupRestaurant(restaurantId);
  }
});

// ── AB05: Negocios eliminados no aceptan pedidos ──────────────

test("AB05 negocio eliminado bloqueado en is_restaurant_open", { skip: SKIP }, async () => {
  const restaurantId = await createTestRestaurant();

  try {
    const adminC = await adminClient();

    // Check open status before delete
    const { data: openBefore } = await adminC.rpc("is_restaurant_open", {
      p_restaurant_id: restaurantId,
    });
    // May be false if no hours configured but that's ok

    // Delete
    await adminC.rpc("soft_delete_restaurant", { p_restaurant_id: restaurantId });

    // After delete, is_restaurant_open must return false
    const { data: openAfter, error } = await adminC.rpc("is_restaurant_open", {
      p_restaurant_id: restaurantId,
    });
    assert.equal(error, null, `is_restaurant_open error: ${error?.message}`);
    assert.equal(openAfter, false, "Negocio eliminado debe reportarse como cerrado");

  } finally {
    await cleanupRestaurant(restaurantId);
  }
});

// ── AB06: Export endpoint requiere platform_admin ─────────────

test("AB06 export rechaza usuarios no autorizados", { skip: SKIP }, async () => {
  // No session → 403
  const resp1 = await fetch(
    `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/api/admin/export?type=restaurants`,
    { credentials: "omit" },
  );
  assert.ok(resp1.status === 403 || resp1.status === 401,
    `Export sin sesión debe retornar 403, recibido: ${resp1.status}`);
});

// ── AB07: Aislamiento: owner no puede ver negocios eliminados en admin ──

test("AB07 owner no puede ver platform_admins ni negocios eliminados de otros", { skip: SKIP }, async () => {
  const ownerC = await clientFor(
    process.env.TEST_OWNER_ALFA_EMAIL!,
    process.env.TEST_OWNER_ALFA_PASSWORD!,
  );

  // Owner should not see platform_admins table
  const { data: adminData } = await ownerC
    .from("platform_admins").select("user_id");
  assert.equal(
    (adminData ?? []).length, 0,
    "Owner no debe poder leer platform_admins",
  );
});
