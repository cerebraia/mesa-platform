// Tests de aislamiento y persistencia de configuración del restaurante.
// Ejecutar con: npm run test:config
// Prerequisitos: migraciones 011-014 aplicadas, seed + usuarios de prueba.

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
  "TEST_OWNER_ALFA_EMAIL",     "TEST_OWNER_ALFA_PASSWORD",
  "TEST_OWNER_BETA_EMAIL",     "TEST_OWNER_BETA_PASSWORD",
  "TEST_ATTENTION_ALFA_EMAIL", "TEST_ATTENTION_ALFA_PASSWORD",
  "TEST_KITCHEN_ALFA_EMAIL",   "TEST_KITCHEN_ALFA_PASSWORD",
];
const MISSING = NEEDED.filter((k) => !process.env[k]);
const SKIP    = MISSING.length > 0;
if (SKIP) {
  console.warn(`[config] Skipped — missing: ${MISSING.join(", ")}`);
}

async function clientFor(email: string, password: string): Promise<SupabaseClient> {
  const resp = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
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

// ── CF01: Owner puede guardar configuración vía RPC ───────────────────────
test("CF01 owner de Alfa puede guardar configuración", { skip: SKIP }, async () => {
  const c = await clientFor(process.env.TEST_OWNER_ALFA_EMAIL!, process.env.TEST_OWNER_ALFA_PASSWORD!);

  const { error } = await c.rpc("save_restaurant_config", {
    p_restaurant_id: ALFA,
    p_name: "Restaurante Alfa CF01",
    p_timezone: "America/Caracas",
    p_config: {
      description: "Test CF01",
      primary_color: "#703BE6",
      phone: "+58 412 000 0001",
      whatsapp: "",
      instagram_url: "",
      facebook_url: "",
      twitter_url: "",
      address: "Av. Test CF01",
      pickup_enabled: true,
      pickup_address: "Local 1",
      pickup_notes: "",
      delivery_enabled: false,
      is_temporarily_closed: false,
      closed_message: "",
    },
  });

  assert.ifError(error);

  // Verify persisted
  const { data } = await c
    .from("restaurant_config")
    .select("description, phone, address")
    .eq("restaurant_id", ALFA)
    .single();

  assert.equal(data?.description, "Test CF01");
  assert.equal(data?.phone, "+58 412 000 0001");
  assert.equal(data?.address, "Av. Test CF01");
});

// ── CF02: Owner de Beta NO puede guardar config de Alfa ───────────────────
test("CF02 owner de Beta no puede guardar configuración de Alfa", { skip: SKIP }, async () => {
  const c = await clientFor(process.env.TEST_OWNER_BETA_EMAIL!, process.env.TEST_OWNER_BETA_PASSWORD!);

  const { error } = await c.rpc("save_restaurant_config", {
    p_restaurant_id: ALFA,
    p_name: "Intrusión desde Beta",
    p_timezone: "UTC",
    p_config: { description: "Intrusión", primary_color: "#000000" },
  });

  assert.ok(error != null, "Owner de Beta no debe poder modificar config de Alfa");
});

// ── CF03: Atención NO puede guardar config ────────────────────────────────
test("CF03 atención no puede guardar configuración", { skip: SKIP }, async () => {
  const c = await clientFor(process.env.TEST_ATTENTION_ALFA_EMAIL!, process.env.TEST_ATTENTION_ALFA_PASSWORD!);

  const { error } = await c.rpc("save_restaurant_config", {
    p_restaurant_id: ALFA,
    p_name: "Modificado por atención",
    p_timezone: "UTC",
    p_config: { description: "Intrusión de atención" },
  });

  assert.ok(error != null, "Atención no debe modificar configuración");
});

// ── CF04: Cocina NO puede guardar config ──────────────────────────────────
test("CF04 cocina no puede guardar configuración", { skip: SKIP }, async () => {
  const c = await clientFor(process.env.TEST_KITCHEN_ALFA_EMAIL!, process.env.TEST_KITCHEN_ALFA_PASSWORD!);

  const { error } = await c.rpc("save_restaurant_config", {
    p_restaurant_id: ALFA,
    p_name: "Modificado por cocina",
    p_timezone: "UTC",
    p_config: { description: "Intrusión de cocina" },
  });

  assert.ok(error != null, "Cocina no debe modificar configuración");
});

// ── CF05: Anon NO puede leer campos internos de restaurant_config ─────────
test("CF05 anon no puede leer campos internos de restaurant_config", { skip: SKIP }, async () => {
  const anon = anonClient();

  // updated_at is an internal field — anon grant excludes it (migration 012)
  const { error } = await anon
    .from("restaurant_config")
    .select("updated_at")
    .eq("restaurant_id", ALFA);

  // Supabase returns an error for columns not granted to anon
  assert.ok(error != null, "Anon no debe poder leer updated_at");
});

// ── CF06: Anon NO puede leer closed_until ────────────────────────────────
test("CF06 anon no puede leer closed_until de restaurant_config", { skip: SKIP }, async () => {
  const anon = anonClient();

  const { error } = await anon
    .from("restaurant_config")
    .select("closed_until")
    .eq("restaurant_id", ALFA);

  assert.ok(error != null, "Anon no debe poder leer closed_until");
});

// ── CF07: Anon puede leer campos públicos de restaurant_config ────────────
test("CF07 anon puede leer campos públicos de restaurant_config", { skip: SKIP }, async () => {
  const anon = anonClient();

  const { data, error } = await anon
    .from("restaurant_config")
    .select("description, logo_path, cover_path, primary_color, pickup_enabled, delivery_enabled, is_temporarily_closed")
    .eq("restaurant_id", ALFA)
    .maybeSingle();

  assert.ifError(error);
  // May be null if no config row, but query must succeed
  assert.ok(data !== undefined);
});

// ── CF08: Owner puede crear zona de delivery ──────────────────────────────
test("CF08 owner crea zona de delivery en Alfa", { skip: SKIP }, async () => {
  const c = await clientFor(process.env.TEST_OWNER_ALFA_EMAIL!, process.env.TEST_OWNER_ALFA_PASSWORD!);

  const { data, error } = await c
    .from("delivery_zones")
    .insert({
      restaurant_id: ALFA,
      name: "Zona test CF08",
      fee_cents: 150,
      minimum_order_cents: 1000,
      position: 99,
    })
    .select("id")
    .single();

  assert.ifError(error);
  assert.ok(data?.id);

  // Cleanup
  await c.from("delivery_zones").delete().eq("id", data.id);
});

// ── CF09: Owner Beta NO puede crear zona en Alfa ──────────────────────────
test("CF09 owner Beta no puede crear zona de delivery en Alfa", { skip: SKIP }, async () => {
  const c = await clientFor(process.env.TEST_OWNER_BETA_EMAIL!, process.env.TEST_OWNER_BETA_PASSWORD!);

  const { error } = await c
    .from("delivery_zones")
    .insert({
      restaurant_id: ALFA,
      name: "Zona intrusa CF09",
      fee_cents: 0,
      minimum_order_cents: 0,
      position: 98,
    });

  assert.ok(error != null, "Owner de Beta no debe crear zona en Alfa");
});

// ── CF10: Tarifa negativa es rechazada por constraint ────────────────────
test("CF10 tarifa negativa es rechazada por constraint", { skip: SKIP }, async () => {
  const c = await clientFor(process.env.TEST_OWNER_ALFA_EMAIL!, process.env.TEST_OWNER_ALFA_PASSWORD!);

  const { error } = await c
    .from("delivery_zones")
    .insert({
      restaurant_id: ALFA,
      name: "Zona tarifa negativa CF10",
      fee_cents: -100,
      minimum_order_cents: 0,
      position: 97,
    });

  assert.ok(error != null, "Tarifa negativa debe ser rechazada");
});

// ── CF11: Mínimo negativo es rechazado por constraint ────────────────────
test("CF11 mínimo negativo es rechazado por constraint", { skip: SKIP }, async () => {
  const c = await clientFor(process.env.TEST_OWNER_ALFA_EMAIL!, process.env.TEST_OWNER_ALFA_PASSWORD!);

  const { error } = await c
    .from("delivery_zones")
    .insert({
      restaurant_id: ALFA,
      name: "Zona mínimo negativo CF11",
      fee_cents: 0,
      minimum_order_cents: -500,
      position: 96,
    });

  assert.ok(error != null, "Mínimo negativo debe ser rechazado");
});

// ── CF12: Owner puede guardar horarios vía RPC ────────────────────────────
test("CF12 owner puede guardar horarios normales", { skip: SKIP }, async () => {
  const c = await clientFor(process.env.TEST_OWNER_ALFA_EMAIL!, process.env.TEST_OWNER_ALFA_PASSWORD!);

  const { error } = await c.rpc("save_business_hours", {
    p_restaurant_id: ALFA,
    p_hours: [
      { day_of_week: 1, opens_at: "09:00", closes_at: "22:00", is_active: true },
      { day_of_week: 2, opens_at: "09:00", closes_at: "22:00", is_active: true },
    ],
  });

  assert.ifError(error);

  const { data } = await c
    .from("business_hours")
    .select("day_of_week, opens_at, closes_at")
    .eq("restaurant_id", ALFA)
    .order("day_of_week");

  assert.ok(Array.isArray(data));
  // Monday and Tuesday must be present (replaces previous rows atomically)
  const days = data.map((r) => r.day_of_week);
  assert.ok(days.includes(1), "Lunes debe estar en los horarios");
  assert.ok(days.includes(2), "Martes debe estar en los horarios");
});

// ── CF13: Horario con cruce de medianoche se acepta ───────────────────────
test("CF13 horario de cruce de medianoche (closes_at < opens_at) se acepta", { skip: SKIP }, async () => {
  const c = await clientFor(process.env.TEST_OWNER_ALFA_EMAIL!, process.env.TEST_OWNER_ALFA_PASSWORD!);

  const { error } = await c.rpc("save_business_hours", {
    p_restaurant_id: ALFA,
    p_hours: [
      { day_of_week: 5, opens_at: "22:00", closes_at: "02:00", is_active: true },
    ],
  });

  // closes_at < opens_at is valid (midnight crossing) — not rejected by DB
  assert.ifError(error);

  const { data } = await c
    .from("business_hours")
    .select("opens_at, closes_at")
    .eq("restaurant_id", ALFA)
    .eq("day_of_week", 5)
    .single();

  assert.ok(data?.opens_at.startsWith("22:"), "Apertura debe ser 22:00");
  assert.ok(data?.closes_at.startsWith("02:"), "Cierre debe ser 02:00");
});

// ── CF14: Cierre temporal cambia resultado de is_restaurant_open ──────────
test("CF14 cierre temporal manual hace is_restaurant_open falso", { skip: SKIP }, async () => {
  const c = await clientFor(process.env.TEST_OWNER_ALFA_EMAIL!, process.env.TEST_OWNER_ALFA_PASSWORD!);

  // Set temporarily closed
  await c.rpc("save_restaurant_config", {
    p_restaurant_id: ALFA,
    p_name: "Restaurante Alfa",
    p_timezone: "America/Caracas",
    p_config: {
      is_temporarily_closed: true,
      closed_message: "Test CF14",
    },
  });

  const anon = anonClient();
  const { data: isOpen } = await anon.rpc("is_restaurant_open", {
    p_restaurant_id: ALFA,
  });

  assert.equal(isOpen, false, "Con cierre temporal, is_restaurant_open debe ser false");

  // Restore
  await c.rpc("save_restaurant_config", {
    p_restaurant_id: ALFA,
    p_name: "Restaurante Alfa",
    p_timezone: "America/Caracas",
    p_config: { is_temporarily_closed: false, closed_message: "" },
  });
});

// ── CF15: Owner puede crear y leer medios de pago; anon no ve instrucciones
test("CF15 owner crea medio de pago; instrucciones no son visibles para anon", { skip: SKIP }, async () => {
  const c = await clientFor(process.env.TEST_OWNER_ALFA_EMAIL!, process.env.TEST_OWNER_ALFA_PASSWORD!);

  const { data: pm, error } = await c
    .from("payment_methods")
    .insert({
      restaurant_id: ALFA,
      name: "Transferencia test CF15",
      type: "transfer",
      instructions: "Cuenta secreta 1234",
      position: 0,
    })
    .select("id")
    .single();

  assert.ifError(error);
  assert.ok(pm?.id);

  // Anon cannot read instructions (column not granted in migration 012)
  const anon = anonClient();
  const { error: anonError } = await anon
    .from("payment_methods")
    .select("instructions")
    .eq("id", pm.id);

  assert.ok(anonError != null, "Anon no debe poder leer instrucciones de pago");

  // Anon CAN read public columns (id, name, type, position)
  const { data: anonPm, error: anonPmError } = await anon
    .from("payment_methods")
    .select("id, name, type, position")
    .eq("id", pm.id)
    .maybeSingle();

  assert.ifError(anonPmError);
  assert.equal(anonPm?.name, "Transferencia test CF15");

  // Cleanup
  await c.from("payment_methods").delete().eq("id", pm.id);
});

// ── CF16: Owner Beta no puede leer config de Alfa ─────────────────────────
test("CF16 owner de Beta no puede leer restaurant_config de Alfa", { skip: SKIP }, async () => {
  const c = await clientFor(process.env.TEST_OWNER_BETA_EMAIL!, process.env.TEST_OWNER_BETA_PASSWORD!);

  const { data } = await c
    .from("restaurant_config")
    .select("description")
    .eq("restaurant_id", ALFA);

  assert.equal(data?.length ?? 0, 0, "Owner de Beta no debe leer config de Alfa");
});

// ── CF17: Atención puede leer config de su restaurante ────────────────────
test("CF17 atención puede leer restaurant_config de su restaurante", { skip: SKIP }, async () => {
  const c = await clientFor(process.env.TEST_ATTENTION_ALFA_EMAIL!, process.env.TEST_ATTENTION_ALFA_PASSWORD!);

  const { data, error } = await c
    .from("restaurant_config")
    .select("description, pickup_enabled, delivery_enabled")
    .eq("restaurant_id", ALFA)
    .maybeSingle();

  assert.ifError(error);
  // Query must succeed (atención can read, not write)
  assert.ok(data !== undefined);
});

// ── CF18: Owner puede subir imagen en restaurant-assets de su restaurante ──
test("CF18 owner no puede subir imagen de assets en directorio de otro restaurante", { skip: SKIP }, async () => {
  const c = await clientFor(process.env.TEST_OWNER_BETA_EMAIL!, process.env.TEST_OWNER_BETA_PASSWORD!);

  const fakeFile = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
  const { error } = await c.storage
    .from("restaurant-assets")
    .upload(`${ALFA}/logo/intrusion.jpg`, fakeFile, {
      contentType: "image/jpeg",
      upsert: false,
    });

  assert.ok(error != null, "Owner de Beta no debe poder subir a assets de Alfa");
});
