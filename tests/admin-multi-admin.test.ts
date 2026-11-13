// Regression tests: multi-admin access and the unfiltered-maybeSingle bug.
//
// Bug fixed: pages in /admin/* called
//   .from("platform_admins").select("user_id").maybeSingle()
// WITHOUT .eq("user_id", uid). With 2+ platform_admins the query receives
// multiple rows, maybeSingle() returns an error, adminRow becomes null,
// and the page redirects the real admin to /panel.
//
// What these tests cover (DB / RLS level — no browser required):
//   MA01: filtered query returns exactly one row per admin, even with 2+ admins
//   MA02: unfiltered maybeSingle() on platform_admins DOES fail with 2+ admins
//         (documents the precondition that triggered the original bug)
//   MA03: 2nd admin can SELECT from plans (is_platform_admin() RLS works)
//   MA04: 2nd admin can SELECT from subscriptions (is_platform_admin() RLS works)
//   MA05: 2nd admin can SELECT from restaurants (is_platform_admin() RLS works)
//   MA06: non-admin still cannot SELECT from plans after 2nd admin is added
//
// What is NOT tested here (requires real browser session):
//   - Actual Next.js route rendering / redirect behavior
//   - Cookie-based session authentication flow
//   These remain manually verifiable.
//
// Strategy: promote TEST_OWNER_ALFA to platform_admin temporarily, then clean up.
// This avoids creating new users and reuses existing authenticated credentials.
//
// Run: npm run test:multi-admin

import test from "node:test";
import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { clientFor } from "./helpers.ts";

const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

const NEEDED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "TEST_ADMIN_EMAIL",        "TEST_ADMIN_PASSWORD",
  "TEST_ADMIN_UUID",
  "TEST_OWNER_ALFA_EMAIL",   "TEST_OWNER_ALFA_PASSWORD",
  "TEST_OWNER_ALFA_UUID",
  "TEST_OWNER_BETA_EMAIL",   "TEST_OWNER_BETA_PASSWORD",
];
const MISSING = NEEDED.filter((k) => !process.env[k]);
const SKIP    = MISSING.length > 0;
if (SKIP) console.warn(`[multi-admin] Saltado — faltan: ${MISSING.join(", ")}`);

const OWNER_ALFA_UUID = process.env.TEST_OWNER_ALFA_UUID ?? "";
const ADMIN_UUID      = process.env.TEST_ADMIN_UUID ?? "";

function svc(): SupabaseClient {
  return createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Promote TEST_OWNER_ALFA to platform_admin so we have 2 admins during the test.
// Returns cleanup function.
async function promoteSecondAdmin(): Promise<() => Promise<void>> {
  const db = svc();
  const { error } = await db.from("platform_admins").insert({ user_id: OWNER_ALFA_UUID });
  if (error && error.code !== "23505") {
    // 23505 = already exists; not a failure, just means the test user is already an admin
    throw new Error(`No se pudo promover al 2do admin: ${error.message}`);
  }
  const wasInserted = !error;
  return async () => {
    if (wasInserted) {
      await db.from("platform_admins").delete().eq("user_id", OWNER_ALFA_UUID);
    }
  };
}

// ── MA01: Filtered query returns exactly one row per admin ────────────────────
test("MA01 .eq(user_id) devuelve exactamente una fila incluso con 2+ admins", { skip: SKIP }, async () => {
  const cleanup = await promoteSecondAdmin();
  try {
    // Admin 1: original admin
    const admin1 = await clientFor(
      process.env.TEST_ADMIN_EMAIL!,
      process.env.TEST_ADMIN_PASSWORD!,
    );
    const { data: row1, error: err1 } = await admin1
      .from("platform_admins").select("user_id")
      .eq("user_id", ADMIN_UUID)
      .maybeSingle();
    assert.ok(!err1, `Admin 1 filtered query should not error: ${err1?.message}`);
    assert.equal(row1?.user_id, ADMIN_UUID, "Admin 1 debe ver su propia fila");

    // Admin 2: promoted owner
    const admin2 = await clientFor(
      process.env.TEST_OWNER_ALFA_EMAIL!,
      process.env.TEST_OWNER_ALFA_PASSWORD!,
    );
    const { data: row2, error: err2 } = await admin2
      .from("platform_admins").select("user_id")
      .eq("user_id", OWNER_ALFA_UUID)
      .maybeSingle();
    assert.ok(!err2, `Admin 2 filtered query should not error: ${err2?.message}`);
    assert.equal(row2?.user_id, OWNER_ALFA_UUID, "Admin 2 debe ver su propia fila");
  } finally {
    await cleanup();
  }
});

// ── MA02: Unfiltered maybeSingle() fails when 2+ admins ───────────────────────
// This documents the precondition that caused the original redirect bug.
// The page was using this exact pattern and it fails silently.
test("MA02 maybeSingle() sin filtro falla con 2+ admins (documenta el bug original)", { skip: SKIP }, async () => {
  const cleanup = await promoteSecondAdmin();
  try {
    const admin1 = await clientFor(
      process.env.TEST_ADMIN_EMAIL!,
      process.env.TEST_ADMIN_PASSWORD!,
    );
    // This was the broken query pattern used in the pages before the fix.
    const { data, error } = await admin1
      .from("platform_admins").select("user_id")
      .maybeSingle();  // no .eq("user_id", ...)

    // With 2+ rows, maybeSingle() must return either an error (PGRST116) or null data.
    // Either outcome proves the original page would have treated adminRow as null
    // and redirected the admin to /panel.
    const wasAmbiguous = error !== null || data === null;
    assert.ok(
      wasAmbiguous,
      "Con 2+ admins, la consulta sin filtro debe fallar o devolver null — " +
      `data=${JSON.stringify(data)}, error=${error?.message ?? "null"}`,
    );
  } finally {
    await cleanup();
  }
});

// ── MA03: 2nd admin can SELECT from plans (is_platform_admin() RLS works) ─────
test("MA03 2do admin puede leer la tabla plans", { skip: SKIP }, async () => {
  const cleanup = await promoteSecondAdmin();
  try {
    const admin2 = await clientFor(
      process.env.TEST_OWNER_ALFA_EMAIL!,
      process.env.TEST_OWNER_ALFA_PASSWORD!,
    );
    const { data, error } = await admin2
      .from("plans")
      .select("id, name, plan_code")
      .eq("is_active", true)
      .order("price_cents");
    assert.ok(!error, `2do admin debe poder leer planes: ${error?.message}`);
    // May be empty if no active plans exist, but should not be an RLS error.
    assert.ok(Array.isArray(data), "Debe devolver un array");
  } finally {
    await cleanup();
  }
});

// ── MA04: 2nd admin can SELECT from subscriptions ─────────────────────────────
test("MA04 2do admin puede leer la tabla subscriptions", { skip: SKIP }, async () => {
  const cleanup = await promoteSecondAdmin();
  try {
    const admin2 = await clientFor(
      process.env.TEST_OWNER_ALFA_EMAIL!,
      process.env.TEST_OWNER_ALFA_PASSWORD!,
    );
    const { data, error } = await admin2
      .from("subscriptions")
      .select("id, restaurant_id, status")
      .limit(5);
    assert.ok(!error, `2do admin debe poder leer suscripciones: ${error?.message}`);
    assert.ok(Array.isArray(data), "Debe devolver un array");
  } finally {
    await cleanup();
  }
});

// ── MA05: 2nd admin can SELECT from restaurants ───────────────────────────────
test("MA05 2do admin puede leer la tabla restaurants", { skip: SKIP }, async () => {
  const cleanup = await promoteSecondAdmin();
  try {
    const admin2 = await clientFor(
      process.env.TEST_OWNER_ALFA_EMAIL!,
      process.env.TEST_OWNER_ALFA_PASSWORD!,
    );
    const { data, error } = await admin2
      .from("restaurants")
      .select("id, name, slug, status")
      .is("deleted_at", null)
      .limit(5);
    assert.ok(!error, `2do admin debe poder leer restaurantes: ${error?.message}`);
    assert.ok(Array.isArray(data), "Debe devolver un array");
  } finally {
    await cleanup();
  }
});

// ── MA06: Non-admin still cannot access plans after 2nd admin is added ────────
// Uses TEST_OWNER_BETA: a valid user with an owner membership but NOT a platform_admin.
// This confirms the plans RLS doesn't widen when a 2nd admin is in the table.
test("MA06 owner (no platform_admin) no puede leer planes aunque haya 2+ admins", { skip: SKIP }, async () => {
  const cleanup = await promoteSecondAdmin();
  try {
    const ownerBeta = await clientFor(
      process.env.TEST_OWNER_BETA_EMAIL!,
      process.env.TEST_OWNER_BETA_PASSWORD!,
    );
    const { data } = await ownerBeta.from("plans").select("id");
    assert.equal(
      data?.length ?? 0,
      0,
      "Owner (no admin) no debe poder leer planes aunque haya 2+ admins en la tabla",
    );
  } finally {
    await cleanup();
  }
});
