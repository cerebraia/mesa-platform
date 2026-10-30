// Tests de aislamiento RLS entre restaurantes.
// Ejecutar con: npm run test:db
// Prerequisitos: migraciones aplicadas, seed ejecutado, .env.test completo.
// Ver supabase/migrations/README.md para el procedimiento completo.

import test from "node:test";
import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

const ALFA = "aaaaaaaa-0000-0000-0000-000000000001";
const BETA = "bbbbbbbb-0000-0000-0000-000000000002";

// Variables requeridas para los tests de integración.
const NEEDED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "TEST_ADMIN_EMAIL",    "TEST_ADMIN_PASSWORD",
  "TEST_OWNER_ALFA_EMAIL",  "TEST_OWNER_ALFA_PASSWORD",
  "TEST_OWNER_BETA_EMAIL",  "TEST_OWNER_BETA_PASSWORD",
  "TEST_ATTENTION_ALFA_EMAIL", "TEST_ATTENTION_ALFA_PASSWORD",
  "TEST_KITCHEN_ALFA_EMAIL",   "TEST_KITCHEN_ALFA_PASSWORD",
  "TEST_NOACCESS_EMAIL", "TEST_NOACCESS_PASSWORD",
];
const MISSING = NEEDED.filter((k) => !process.env[k]);
const SKIP    = MISSING.length > 0;

if (SKIP) {
  console.warn(
    `[db-isolation] Tests omitidos — faltan variables: ${MISSING.join(", ")}\n` +
    `  Copia .env.test.example a .env.test y completa las credenciales.\n` +
    `  Asegúrate de que las migraciones y el seed han sido aplicados.`
  );
}

// Autentica vía REST directo (signInWithPassword de supabase-js v2 no es
// compatible con el formato sb_publishable_ en este entorno) y devuelve
// un cliente con el JWT resultante para verificar RLS con la clave pública.
async function clientFor(email: string, password: string): Promise<SupabaseClient> {
  const resp = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "apikey": ANON,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
  const json = await resp.json() as Record<string, unknown>;
  if (!resp.ok || !json.access_token) {
    throw new Error(
      `Auth fallido para ${email}: ${String(json.error_description ?? json.error ?? resp.status)}`
    );
  }
  return createClient(URL, ANON, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${json.access_token}` } },
  });
}

// Cliente anon (sin autenticación).
function anonClient(): SupabaseClient {
  return createClient(URL, ANON, { auth: { persistSession: false } });
}

// ── Prueba 1: owner de Alfa ve solo su restaurante ────────────
test("P01 owner de Alfa ve exactamente 1 restaurante (su propio)", { skip: SKIP }, async () => {
  const c = await clientFor(
    process.env.TEST_OWNER_ALFA_EMAIL!,
    process.env.TEST_OWNER_ALFA_PASSWORD!
  );
  const { data, error } = await c.from("restaurants").select("id, name");
  assert.ifError(error);
  assert.equal(data?.length, 1,
    `Owner de Alfa debe ver 1 restaurante, vio ${data?.length}: ${JSON.stringify(data)}`);
  assert.equal(data![0].id, ALFA,
    `El restaurante visible debe ser Alfa, es ${data![0].id}`);
});

// ── Prueba 2: owner de Alfa no puede leer Restaurante Beta ────
test("P02 owner de Alfa no lee datos de Restaurante Beta", { skip: SKIP }, async () => {
  const c = await clientFor(
    process.env.TEST_OWNER_ALFA_EMAIL!,
    process.env.TEST_OWNER_ALFA_PASSWORD!
  );
  const { data, error } = await c
    .from("restaurants")
    .select("id")
    .eq("id", BETA);
  assert.ifError(error);
  assert.equal(data?.length, 0,
    `Owner de Alfa no debe ver Restaurante Beta, vio ${data?.length} filas`);
});

// ── Prueba 3: owner de Alfa puede actualizar su restaurante ───
test("P03 owner de Alfa puede actualizar nombre de Alfa", { skip: SKIP }, async () => {
  const c = await clientFor(
    process.env.TEST_OWNER_ALFA_EMAIL!,
    process.env.TEST_OWNER_ALFA_PASSWORD!
  );
  const { error } = await c
    .from("restaurants")
    .update({ name: "Restaurante Alfa (actualizado)" })
    .eq("id", ALFA);
  assert.ifError(error);

  // Restaurar el nombre original.
  await c.from("restaurants")
    .update({ name: "Restaurante Alfa" })
    .eq("id", ALFA);
});

// ── Prueba 4: owner de Alfa no puede modificar Restaurante Beta
test("P04 owner de Alfa no modifica Restaurante Beta", { skip: SKIP }, async () => {
  const c = await clientFor(
    process.env.TEST_OWNER_ALFA_EMAIL!,
    process.env.TEST_OWNER_ALFA_PASSWORD!
  );
  const { data, error } = await c
    .from("restaurants")
    .update({ name: "Restaurante Beta Hackeado" })
    .eq("id", BETA)
    .select("id");
  // PostgREST devuelve error o 0 filas; en ambos casos no debe haber filas afectadas.
  assert.equal(
    (data?.length ?? 0), 0,
    `Owner de Alfa no debe poder modificar Beta. Filas afectadas: ${data?.length}`
  );
});

// ── Prueba 5: owner de Alfa no puede cambiar status del restaurante
test("P05 owner de Alfa no puede cambiar status del restaurante", { skip: SKIP }, async () => {
  const c = await clientFor(
    process.env.TEST_OWNER_ALFA_EMAIL!,
    process.env.TEST_OWNER_ALFA_PASSWORD!
  );
  const { error } = await c
    .from("restaurants")
    .update({ status: "suspended" })
    .eq("id", ALFA);
  // El trigger guard_restaurant_status debe rechazar este UPDATE.
  assert.ok(error != null,
    "Cambiar status debe devolver un error para el owner; no se devolvió ninguno");
  // Código 42501 = PostgreSQL insufficient_privilege; mensaje en español del trigger.
  assert.ok(
    error!.code === "42501" || /plataforma|platform|insufficient/i.test(error!.message),
    `El error debe indicar privilegios insuficientes (42501). Recibido: ${JSON.stringify(error)}`
  );
});

// ── Prueba 6: owner de Alfa no puede insertar miembros ────────
test("P06 owner de Alfa no puede insertar miembros (fase 2)", { skip: SKIP }, async () => {
  const c = await clientFor(
    process.env.TEST_OWNER_ALFA_EMAIL!,
    process.env.TEST_OWNER_ALFA_PASSWORD!
  );
  const { error } = await c.from("restaurant_members").insert({
    restaurant_id: ALFA,
    user_id: "00000000-0000-0000-0000-000000000099",
    role: "kitchen",
    status: "active",
  });
  assert.ok(error != null,
    "INSERT de miembro por owner debe fallar con error; no falló");
});

// ── Prueba 7: owner de Alfa no ve membresías de Beta ──────────
test("P07 owner de Alfa no lee membresías de Restaurante Beta", { skip: SKIP }, async () => {
  const c = await clientFor(
    process.env.TEST_OWNER_ALFA_EMAIL!,
    process.env.TEST_OWNER_ALFA_PASSWORD!
  );
  const { data, error } = await c
    .from("restaurant_members")
    .select("id")
    .eq("restaurant_id", BETA);
  assert.ifError(error);
  assert.equal(data?.length, 0,
    `Owner de Alfa no debe ver miembros de Beta; vio ${data?.length}`);
});

// ── Prueba 8: attention no puede gestionar miembros ───────────
test("P08 attention de Alfa no puede insertar miembros", { skip: SKIP }, async () => {
  const c = await clientFor(
    process.env.TEST_ATTENTION_ALFA_EMAIL!,
    process.env.TEST_ATTENTION_ALFA_PASSWORD!
  );
  const { error } = await c.from("restaurant_members").insert({
    restaurant_id: ALFA,
    user_id: "00000000-0000-0000-0000-000000000099",
    role: "kitchen",
    status: "active",
  });
  assert.ok(error != null,
    "INSERT de miembro por attention debe fallar con error; no falló");
});

// ── Prueba 9: attention solo ve su propia membresía ───────────
test("P09 attention de Alfa solo ve su propia membresía", { skip: SKIP }, async () => {
  const c = await clientFor(
    process.env.TEST_ATTENTION_ALFA_EMAIL!,
    process.env.TEST_ATTENTION_ALFA_PASSWORD!
  );
  const { data, error } = await c.from("restaurant_members").select("id, user_id");
  assert.ifError(error);
  assert.equal(data?.length, 1,
    `Attention debe ver 1 membresía (la propia), vio ${data?.length}`);
});

// ── Prueba 10: nadie puede asignarse platform_admin ───────────
test("P10 usuario autenticado no puede asignarse platform_admin", { skip: SKIP }, async () => {
  const ownerUuid = process.env.TEST_OWNER_ALFA_UUID ?? "00000000-0000-0000-0000-000000000099";
  const c = await clientFor(
    process.env.TEST_OWNER_ALFA_EMAIL!,
    process.env.TEST_OWNER_ALFA_PASSWORD!
  );
  const { error } = await c
    .from("platform_admins")
    .insert({ user_id: ownerUuid });
  assert.ok(error != null,
    "INSERT en platform_admins por usuario no-admin debe fallar con error; no falló");
});

// ── Prueba 11: usuario sin membresía no lee restaurantes ──────
test("P11 usuario sin membresía no ve ningún restaurante", { skip: SKIP }, async () => {
  const c     = await clientFor(process.env.TEST_NOACCESS_EMAIL!, process.env.TEST_NOACCESS_PASSWORD!);
  const admin = await clientFor(process.env.TEST_ADMIN_EMAIL!, process.env.TEST_ADMIN_PASSWORD!);

  // Remove stale memberships so the invariant "noaccess has no memberships" is guaranteed.
  const { data: { user: noAccessUser } } = await c.auth.getUser();
  assert.ok(noAccessUser?.id, "Usuario noaccess debe autenticarse");
  await admin.from("restaurant_members").delete().eq("user_id", noAccessUser!.id);

  const { data, error } = await c.from("restaurants").select("id");
  assert.ifError(error);
  assert.equal(data?.length, 0,
    `Usuario sin membresía debe ver 0 restaurantes, vio ${data?.length}`);
});

// ── Prueba 12: usuario anónimo no accede a datos privados ─────
test("P12 anónimo solo lee restaurantes activos; tablas privadas inaccesibles", { skip: SKIP }, async () => {
  const c = anonClient();
  const [r, rm, pa, rd] = await Promise.all([
    c.from("restaurants").select("id"),
    c.from("restaurant_members").select("id"),
    c.from("platform_admins").select("user_id"),
    c.from("restaurant_domains").select("id"),
  ]);

  // restaurants: anon puede leer negocios activos (política pública para el menú).
  // El seed tiene 2 restaurantes activos, así que se esperan ≥1.
  assert.ok(
    (r.data?.length ?? 0) >= 1,
    `Anon debe ver restaurantes activos (menú público); vio ${r.data?.length}`
  );

  // Las demás tablas siguen siendo inaccesibles para anon.
  for (const [name, result] of [
    ["restaurant_members", rm],
    ["platform_admins", pa],
    ["restaurant_domains", rd],
  ] as [string, typeof rm][]) {
    const rows = result.data?.length ?? 0;
    assert.equal(rows, 0,
      `Anon no debe ver filas en ${name}; vio ${rows}`);
  }
});

// ── Prueba 13: owner no puede activar verified en dominios ────
test("P13 owner de Alfa no puede activar verified en restaurant_domains", { skip: SKIP }, async () => {
  const c = await clientFor(
    process.env.TEST_OWNER_ALFA_EMAIL!,
    process.env.TEST_OWNER_ALFA_PASSWORD!
  );
  const { data, error } = await c
    .from("restaurant_domains")
    .update({ verified: true })
    .eq("restaurant_id", ALFA)
    .select("id");
  // RLS bloquea: 0 filas o error.
  assert.equal(
    data?.length ?? 0, 0,
    `Owner no debe poder activar verified; afectó ${data?.length} filas`
  );
});

// ── Prueba 14: platform_admin ve todos los restaurantes ───────
test("P14 platform_admin ve todos los restaurantes y miembros", { skip: SKIP }, async () => {
  const c = await clientFor(
    process.env.TEST_ADMIN_EMAIL!,
    process.env.TEST_ADMIN_PASSWORD!
  );
  const { data: rests, error: e1 } = await c.from("restaurants").select("id");
  assert.ifError(e1);
  assert.ok(
    (rests?.length ?? 0) >= 2,
    `Admin debe ver ≥2 restaurantes, vio ${rests?.length}`
  );

  const { data: members, error: e2 } = await c.from("restaurant_members").select("id");
  assert.ifError(e2);
  assert.ok(
    (members?.length ?? 0) >= 4,
    `Admin debe ver ≥4 miembros, vio ${members?.length}`
  );
});

// ── Prueba 15: owner Beta aislado de Alfa ─────────────────────
test("P15 owner de Beta no ve Restaurante Alfa", { skip: SKIP }, async () => {
  const c = await clientFor(
    process.env.TEST_OWNER_BETA_EMAIL!,
    process.env.TEST_OWNER_BETA_PASSWORD!
  );
  const { data, error } = await c
    .from("restaurants")
    .select("id")
    .eq("id", ALFA);
  assert.ifError(error);
  assert.equal(data?.length, 0,
    `Owner de Beta no debe ver Alfa; vio ${data?.length} filas`);
});

// ── Prueba 16: anónimo no puede insertar en ninguna tabla ─────
test("P16 anónimo no puede insertar registros", { skip: SKIP }, async () => {
  const c = anonClient();

  // INSERT en restaurants → RLS no tiene política INSERT para anon → error
  const { error: e1 } = await c.from("restaurants").insert({
    name: "Intruso", slug: "intruso-anon", currency: "USD", timezone: "UTC",
  });
  assert.ok(e1 != null,
    "Anon no debe poder insertar en restaurants; no se devolvió error");

  // INSERT en restaurant_members → debe fallar
  const { error: e2 } = await c.from("restaurant_members").insert({
    restaurant_id: ALFA,
    user_id: "00000000-0000-0000-0000-000000000099",
    role: "owner",
    status: "active",
  });
  assert.ok(e2 != null,
    "Anon no debe poder insertar en restaurant_members; no se devolvió error");
});

// ── Prueba 17: anónimo no puede actualizar ni eliminar ────────
test("P17 anónimo no puede modificar ni borrar datos", { skip: SKIP }, async () => {
  const c = anonClient();

  // UPDATE restaurants → sin USING policy para anon → 0 filas afectadas
  const { data: upd } = await c
    .from("restaurants")
    .update({ name: "Hackeado" })
    .eq("id", ALFA)
    .select("id");
  assert.equal((upd?.length ?? 0), 0,
    `Anon no debe poder actualizar restaurants; filas afectadas: ${upd?.length}`);

  // DELETE restaurants → sin USING policy para anon → 0 filas eliminadas
  const { data: del } = await c
    .from("restaurants")
    .delete()
    .eq("id", ALFA)
    .select("id");
  assert.equal((del?.length ?? 0), 0,
    `Anon no debe poder eliminar restaurants; filas eliminadas: ${del?.length}`);

  // Confirmar que el restaurante sigue existiendo — anon ahora puede leerlo
  // porque se añadió política pública para el menú (restaurantes activos).
  // La prueba 18 verifica que el nombre no fue alterado.
  const { data: check } = await c.from("restaurants").select("id").eq("id", ALFA);
  assert.equal((check?.length ?? 0), 1,
    "Restaurante Alfa debe ser visible como activo para anon (política de menú público)");
});

// ── Prueba 18: datos íntegros tras intentos de anon ──────────
// Verifica con service_role que los datos no fueron alterados por pruebas 16-17.
test("P18 datos intactos tras intentos de escritura anónima", { skip: SKIP }, async () => {
  // Esta prueba usa la clave publicable con usuario autenticado (admin)
  // para confirmar que el restaurante Alfa sigue con su nombre correcto.
  const c = await clientFor(
    process.env.TEST_ADMIN_EMAIL!,
    process.env.TEST_ADMIN_PASSWORD!
  );
  const { data, error } = await c
    .from("restaurants")
    .select("id, name")
    .eq("id", ALFA);
  assert.ifError(error);
  assert.equal(data?.length, 1, "Restaurante Alfa debe seguir existiendo");
  assert.equal(data?.[0]?.name, "Restaurante Alfa",
    `Nombre debe ser 'Restaurante Alfa', es '${data?.[0]?.name}'`);
});
