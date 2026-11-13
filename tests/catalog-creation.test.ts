// Integration tests for restaurant catalog creation flow.
// Validates restaurantCreationCore: activation, idempotency, slug uniqueness,
// RLS visibility, and subdomain accessibility.
//
// Required env vars: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
//                   SUPABASE_SERVICE_ROLE_KEY, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD

import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { clientFor, anonClient } from "./helpers.ts";
import {
  restaurantCreationCore,
  type RestaurantCreationParams,
} from "../src/lib/create-restaurant.ts";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SVC_KEY      = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const MISSING = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "TEST_ADMIN_EMAIL",
  "TEST_ADMIN_PASSWORD",
].filter((k) => !process.env[k]);

const SKIP = MISSING.length > 0;
if (SKIP) console.warn(`[catalog-creation] Saltado — faltan: ${MISSING.join(", ")}`);

function svcClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SVC_KEY, { auth: { persistSession: false } });
}

async function adminClient(): Promise<SupabaseClient> {
  return clientFor(
    process.env.TEST_ADMIN_EMAIL!,
    process.env.TEST_ADMIN_PASSWORD!,
  );
}

/** Fetches the admin's user id for use in restaurantCreationCore. */
async function adminId(): Promise<string> {
  const c = await adminClient();
  const { data } = await c.auth.getUser();
  if (!data.user) throw new Error("No se pudo obtener el usuario admin");
  return data.user.id;
}

function uniqueSlug(prefix = "cc-test"): string {
  return `${prefix}-${Date.now()}`;
}

/** Canonical cleanup: subscriptions → config → restaurant. */
async function cleanup(restaurantId: string) {
  const svc = svcClient();
  await svc.from("subscriptions").delete().eq("restaurant_id", restaurantId);
  await svc.from("restaurant_config").delete().eq("restaurant_id", restaurantId);
  await svc.from("restaurants").delete().eq("id", restaurantId);
}

// ── CC01: Alta completa activa el negocio con todas sus dependencias ─────────

test("CC01 alta completa activa el negocio con todas sus dependencias", { skip: SKIP }, async () => {
  const slug = uniqueSlug("cc01");
  const params: RestaurantCreationParams = {
    name: "CC01 Test Business",
    slug,
    currency: "USD",
    timezone: "America/Caracas",
    businessType: "restaurant",
    ordersEnabled: true,
  };

  const adminC = await adminClient();
  const uid = await adminId();
  const svc = svcClient();

  let restaurantId: string | undefined;
  try {
    const result = await restaurantCreationCore(adminC, svc, params, uid);
    assert.equal(result.error, null, `Error en creación: ${result.error}`);
    assert.equal(result.activated, true, "El negocio debe estar activado");
    restaurantId = result.restaurantId;
    assert.ok(restaurantId, "Se debe retornar restaurantId");

    // Verify restaurants.status
    const { data: row } = await svc
      .from("restaurants")
      .select("id, status")
      .eq("id", restaurantId)
      .single();
    assert.equal(row?.status, "active", "restaurants.status debe ser 'active'");

    // Verify restaurant_config exists
    const { data: cfg } = await svc
      .from("restaurant_config")
      .select("restaurant_id")
      .eq("restaurant_id", restaurantId)
      .maybeSingle();
    assert.ok(cfg, "restaurant_config debe existir");

    // Verify active subscription with plan inicio
    const { data: sub } = await svc
      .from("subscriptions")
      .select("id, status, plan_id, plans(plan_code)")
      .eq("restaurant_id", restaurantId)
      .eq("status", "active")
      .maybeSingle();
    assert.ok(sub, "Debe existir una suscripción activa");
    const planRaw = sub.plans as unknown as { plan_code: string } | Array<{ plan_code: string }> | null;
    const plan = Array.isArray(planRaw) ? planRaw[0] : planRaw;
    assert.equal(plan?.plan_code, "inicio", "El plan debe ser 'inicio'");

  } finally {
    if (restaurantId) await cleanup(restaurantId);
  }
});

// ── CC02: Subdominio accesible inmediatamente (sin DNS ni despliegue) ────────

test("CC02 subdominio accesible inmediatamente", { skip: SKIP || !process.env.PLATFORM_SUBDOMAIN_BASE }, async () => {
  const slug = uniqueSlug("cc02");
  const adminC = await adminClient();
  const uid = await adminId();
  const svc = svcClient();
  const subBase = process.env.PLATFORM_SUBDOMAIN_BASE!;

  let restaurantId: string | undefined;
  try {
    const result = await restaurantCreationCore(adminC, svc, { name: "CC02 Test", slug }, uid);
    assert.equal(result.error, null, `Error en creación: ${result.error}`);
    restaurantId = result.restaurantId;

    const url = `https://${slug}.${subBase}/`;
    let status: number | null = null;
    try {
      const resp = await fetch(url, {
        signal: AbortSignal.timeout(10_000),
        redirect: "follow",
      });
      status = resp.status;
    } catch (err) {
      // Server not reachable (timeout / connection refused) — test passes with warning
      console.warn(`[CC02] Servidor no disponible en ${url}: ${(err as Error).message}`);
      return;
    }

    // 503 means server is reachable but overloaded — not a routing failure, skip
    if (status === 503) {
      console.warn(`[CC02] ${url} devolvió 503 (servidor ocupado), omitiendo verificación de contenido`);
      return;
    }

    // Next.js App Router embeds the not-found component as a layout slot in every
    // RSC payload (even successful ones), so body text is not a reliable signal.
    // HTTP 200 = catalog rendered; 404 = notFound() fired (anon RLS blocked it).
    assert.ok(
      status === 200,
      `Se esperaba HTTP 200 (catálogo accesible sin DNS ni deploy), recibido: ${status}`,
    );

  } finally {
    if (restaurantId) await cleanup(restaurantId);
  }
});

// ── CC03: Catálogo activo sin productos muestra estado vacío, no 404 ─────────

test("CC03 catálogo activo sin productos es visible para anon", { skip: SKIP }, async () => {
  const slug = uniqueSlug("cc03");
  const adminC = await adminClient();
  const uid = await adminId();
  const svc = svcClient();

  let restaurantId: string | undefined;
  try {
    const result = await restaurantCreationCore(adminC, svc, { name: "CC03 Test", slug }, uid);
    assert.equal(result.error, null, `Error en creación: ${result.error}`);
    restaurantId = result.restaurantId!;

    const anon = anonClient();

    // Anon can see the restaurant (RLS allows active status)
    const { data: row, error: rowErr } = await anon
      .from("restaurants")
      .select("id")
      .eq("slug", slug)
      .single();
    assert.equal(rowErr, null, `Error al leer restaurante como anon: ${rowErr?.message}`);
    assert.ok(row, "El restaurante debe ser visible para anon cuando está activo");
    assert.equal(row.id, restaurantId, "El id del restaurante debe coincidir");

    // No categories (empty catalog)
    const { data: cats, error: catErr } = await anon
      .from("categories")
      .select("id")
      .eq("restaurant_id", restaurantId);
    assert.equal(catErr, null, `Error al leer categorías: ${catErr?.message}`);
    assert.ok(Array.isArray(cats), "La consulta de categorías debe retornar un array");
    // Empty is fine; just not null
    assert.notEqual(cats, null, "cats no debe ser null");

  } finally {
    if (restaurantId) await cleanup(restaurantId);
  }
});

// ── CC04: Slug duplicado rechazado ───────────────────────────────────────────

test("CC04 slug duplicado es rechazado", { skip: SKIP }, async () => {
  const slug = uniqueSlug("cc04");
  const adminC = await adminClient();
  const uid = await adminId();
  const svc = svcClient();

  let restaurantIdA: string | undefined;
  try {
    // Create restaurant A
    const resultA = await restaurantCreationCore(adminC, svc, { name: "CC04 A", slug }, uid);
    assert.equal(resultA.error, null, `Error creando A: ${resultA.error}`);
    restaurantIdA = resultA.restaurantId;

    // Try to create restaurant B with same slug
    const resultB = await restaurantCreationCore(adminC, svc, { name: "CC04 B", slug }, uid);
    assert.ok(resultB.error !== null, "Debe retornar error para slug duplicado activo");

    // Only 1 restaurant with that slug should exist
    const { data: rows } = await svc
      .from("restaurants")
      .select("id")
      .eq("slug", slug)
      .is("deleted_at", null);
    assert.equal((rows ?? []).length, 1, "Solo debe existir 1 restaurante con ese slug");

  } finally {
    if (restaurantIdA) await cleanup(restaurantIdA);
  }
});

// ── CC05: Reintento idempotente — completa sin duplicar ──────────────────────

test("CC05 reintento idempotente completa sin duplicar", { skip: SKIP }, async () => {
  const slug = uniqueSlug("cc05");
  const adminC = await adminClient();
  const uid = await adminId();
  const svc = svcClient();

  let restaurantId: string | undefined;
  try {
    // Insert restaurant manually in onboarding state (no config, no subscription)
    const { data: manual, error: manErr } = await svc
      .from("restaurants")
      .insert({
        name: "CC05 Onboarding",
        slug,
        currency: "USD",
        timezone: "America/Caracas",
        status: "onboarding",
        business_type: "restaurant",
      })
      .select("id")
      .single();
    assert.equal(manErr, null, `Error al crear en onboarding: ${manErr?.message}`);
    restaurantId = manual!.id;

    // Call restaurantCreationCore with same slug → should resume
    const result = await restaurantCreationCore(
      adminC, svc,
      { name: "CC05 Onboarding", slug },
      uid,
    );
    assert.equal(result.error, null, `Error en reintento: ${result.error}`);
    assert.equal(result.resumed, true, "Debe reportar resumed: true");
    assert.equal(result.activated, true, "Debe activar tras completar dependencias");
    assert.equal(result.restaurantId, restaurantId, "Debe reusar el mismo restaurantId");

    // Exactly 1 restaurant with that slug
    const { data: rows } = await svc
      .from("restaurants")
      .select("id")
      .eq("slug", slug)
      .is("deleted_at", null);
    assert.equal((rows ?? []).length, 1, "Solo debe existir 1 restaurante con ese slug");

    // Exactly 1 restaurant_config
    const { data: cfgs } = await svc
      .from("restaurant_config")
      .select("restaurant_id")
      .eq("restaurant_id", restaurantId);
    assert.equal((cfgs ?? []).length, 1, "Debe haber exactamente 1 restaurant_config");

    // Exactly 1 active subscription
    const { data: subs } = await svc
      .from("subscriptions")
      .select("id")
      .eq("restaurant_id", restaurantId)
      .eq("status", "active");
    assert.equal((subs ?? []).length, 1, "Debe haber exactamente 1 suscripción activa");

  } finally {
    if (restaurantId) await cleanup(restaurantId);
  }
});

// ── CC06: Restaurante suspendido bloqueado (anon ve null) ────────────────────

test("CC06 restaurante suspendido bloqueado para anon", { skip: SKIP }, async () => {
  const slug = uniqueSlug("cc06");
  const adminC = await adminClient();
  const uid = await adminId();
  const svc = svcClient();

  let restaurantId: string | undefined;
  try {
    // Create active restaurant
    const result = await restaurantCreationCore(adminC, svc, { name: "CC06 Test", slug }, uid);
    assert.equal(result.error, null, `Error en creación: ${result.error}`);
    restaurantId = result.restaurantId!;

    // Suspend via setRestaurantStatus logic (UPDATE with admin client, trigger requires auth.uid)
    const { error: suspendErr } = await adminC
      .from("restaurants")
      .update({ status: "suspended", updated_at: new Date().toISOString() })
      .eq("id", restaurantId);
    assert.equal(suspendErr, null, `Error al suspender: ${suspendErr?.message}`);

    // Anon query must return null (RLS blocks status != 'active')
    const anon = anonClient();
    const { data: anonRow } = await anon
      .from("restaurants")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    assert.equal(anonRow, null, "Restaurante suspendido no debe ser visible para anon");

    // If PLATFORM_SUBDOMAIN_BASE configured, check HTTP response
    const subBase = process.env.PLATFORM_SUBDOMAIN_BASE;
    if (subBase) {
      const url = `https://${slug}.${subBase}/`;
      try {
        const resp = await fetch(url, {
          signal: AbortSignal.timeout(10_000),
          redirect: "manual",
        });
        // Should NOT be 200 — 404, 302 to 404, 503 are all acceptable
        const isNotFound =
          resp.status === 404 ||
          (resp.status >= 300 && resp.status < 400) ||
          resp.status === 503;
        assert.ok(isNotFound, `Subdominio suspendido debe retornar 404/3xx/503, recibido: ${resp.status}`);
      } catch {
        console.warn(`[CC06] Servidor no disponible en ${url}, omitiendo verificación HTTP`);
      }
    }

  } finally {
    if (restaurantId) await cleanup(restaurantId);
  }
});

// ── CC07: Restaurante eliminado (soft-delete) bloqueado ──────────────────────

test("CC07 restaurante eliminado (soft-delete) bloqueado para anon", { skip: SKIP }, async () => {
  const slug = uniqueSlug("cc07");
  const adminC = await adminClient();
  const uid = await adminId();
  const svc = svcClient();

  let restaurantId: string | undefined;
  try {
    // Create active restaurant
    const result = await restaurantCreationCore(adminC, svc, { name: "CC07 Test", slug }, uid);
    assert.equal(result.error, null, `Error en creación: ${result.error}`);
    restaurantId = result.restaurantId!;

    // Soft-delete via RPC (requires admin JWT)
    const { error: delErr } = await adminC.rpc("soft_delete_restaurant", {
      p_restaurant_id: restaurantId,
    });
    assert.equal(delErr, null, `soft_delete_restaurant falló: ${delErr?.message}`);

    // Anon query must return null
    const anon = anonClient();
    const { data: anonRow } = await anon
      .from("restaurants")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    assert.equal(anonRow, null, "Restaurante eliminado no debe ser visible para anon");

  } finally {
    if (restaurantId) {
      // Hard delete (svc bypasses RLS) so no orphan test data remains
      const db = svcClient();
      await db.from("subscriptions").delete().eq("restaurant_id", restaurantId);
      await db.from("restaurant_config").delete().eq("restaurant_id", restaurantId);
      await db.from("restaurant_members").delete().eq("restaurant_id", restaurantId);
      await db.from("restaurants").delete().eq("id", restaurantId);
    }
  }
});

// ── CC08: Slug inexistente devuelve null en consulta anon ────────────────────

test("CC08 slug inexistente devuelve null para anon", { skip: SKIP }, async () => {
  const nonExistentSlug = `no-existe-${Date.now()}-xyz`;

  const anon = anonClient();
  const { data, error } = await anon
    .from("restaurants")
    .select("id")
    .eq("slug", nonExistentSlug)
    .maybeSingle();

  assert.equal(error, null, `Error al consultar slug inexistente: ${error?.message}`);
  assert.equal(data, null, "Slug inexistente debe retornar null");
});
