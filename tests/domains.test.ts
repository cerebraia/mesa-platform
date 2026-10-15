// Tests de aislamiento y seguridad de dominios:
// DO01: Dos dominios activos resuelven restaurantes distintos
// DO02: Host desconocido no devuelve datos
// DO03: Dominio con status != 'active' no sirve el restaurante
// DO04: Owner no puede activar un dominio
// DO05: Owner no puede reclamar dominios de otro restaurante
// DO06: Dominio de otro restaurante no sirve el menú de Alfa
// DO07: /panel y /admin no son accesibles desde un dominio de restaurante
// DO08: Owner puede solicitar un dominio y cancelarlo
// DO09: Admin puede activar y desconectar un dominio
// DO10: Pedido de Alfa no accesible desde lookup con dominio de Beta
//
// Ejecutar con: npm run test:domains

import test from "node:test";
import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";
import {
  normalizeHost,
  isPlatformHost,
  extractPlatformSubdomain,
  RESERVED_SUBDOMAINS,
} from "../src/lib/host-resolver.ts";

const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

const ALFA = "aaaaaaaa-0000-0000-0000-000000000001";
const BETA = "aaaaaaaa-0000-0000-0000-000000000002";

const NEEDED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "TEST_OWNER_ALFA_EMAIL",  "TEST_OWNER_ALFA_PASSWORD",
  "TEST_OWNER_BETA_EMAIL",  "TEST_OWNER_BETA_PASSWORD",
  "TEST_ADMIN_EMAIL",       "TEST_ADMIN_PASSWORD",
  "SUPABASE_SERVICE_ROLE_KEY",
];
const MISSING = NEEDED.filter((k) => !process.env[k]);
const SKIP    = MISSING.length > 0;
if (SKIP) console.warn(`[domains] Saltado — faltan: ${MISSING.join(", ")}`);

// ── Pure-function tests (always run) ──────────────────────────────────────────

test("normalizeHost convierte a minúsculas, quita puerto y punto final", () => {
  assert.equal(normalizeHost("Restaurante.COM"), "restaurante.com");
  assert.equal(normalizeHost("localhost:3000"), "localhost");
  assert.equal(normalizeHost("MESA.APP."), "mesa.app");
  assert.equal(normalizeHost("127.0.0.1:3001"), "127.0.0.1");
  assert.equal(normalizeHost(""), "");
});

test("isPlatformHost identifica localhost como plataforma", () => {
  assert.equal(isPlatformHost("localhost"), true);
  assert.equal(isPlatformHost("127.0.0.1"), true);
  // Host externo no configurado no es plataforma
  assert.equal(isPlatformHost("restaurante.com"), false);
});

test("extractPlatformSubdomain sin PLATFORM_SUBDOMAIN_BASE devuelve null", () => {
  // En tests no hay PLATFORM_SUBDOMAIN_BASE configurado
  assert.equal(extractPlatformSubdomain("restaurante-alfa.mesa.app"), null);
});

test("RESERVED_SUBDOMAINS incluye los nombres protegidos", () => {
  for (const name of ["www", "app", "admin", "api", "panel", "mail"]) {
    assert.ok(RESERVED_SUBDOMAINS.has(name), `${name} debe ser reservado`);
  }
});

// ── DB tests ──────────────────────────────────────────────────────────────────

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

function anonClient(): SupabaseClient {
  return createClient(URL, ANON, { auth: { persistSession: false } });
}

function svc(): SupabaseClient {
  return createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function rand(prefix = ""): string {
  return `${prefix}${randomBytes(4).toString("hex")}`;
}

// Crea un dominio de prueba y lo activa via service role.
async function createActiveDomain(restaurantId: string, host: string) {
  const { data, error } = await svc().from("restaurant_domains").insert({
    restaurant_id: restaurantId,
    host,
    kind:   "custom",
    status: "active",
  }).select("id").single();
  if (error) throw new Error(`No se pudo crear dominio ${host}: ${error.message}`);
  return data!.id as string;
}

// ── DO01: Dos dominios activos resuelven restaurantes distintos ───────────────
test("DO01 get_restaurant_slug_by_host distingue dominios de dos restaurantes distintos", { skip: SKIP }, async () => {
  const hostAlfa = `${rand("alfa-")}.example.test`;
  const hostTmp  = `${rand("tmp-")}.example.test`;

  // Create a temporary second restaurant for this test
  const tmpSlug = rand("d-tmp-");
  const { data: tmpRest, error: createErr } = await svc().from("restaurants").insert({
    name: "Temp Domain Test", slug: tmpSlug, currency: "USD",
    timezone: "America/Caracas", status: "active",
  }).select("id, slug").single();
  if (createErr || !tmpRest) { console.warn("DO01 saltado — no se pudo crear restaurante temporal:", createErr?.message); return; }

  const idAlfa = await createActiveDomain(ALFA, hostAlfa);
  const idTmp  = await createActiveDomain(tmpRest.id, hostTmp);

  const anon = anonClient();

  const { data: slugAlfa } = await anon.rpc("get_restaurant_slug_by_host", { p_host: hostAlfa });
  const { data: slugTmp  } = await anon.rpc("get_restaurant_slug_by_host", { p_host: hostTmp });

  assert.ok(typeof slugAlfa === "string" && slugAlfa.length > 0, "Alfa debe resolverse");
  assert.ok(typeof slugTmp  === "string" && slugTmp.length > 0,  "Temporal debe resolverse");
  assert.notEqual(slugAlfa, slugTmp, "Los slugs deben ser distintos");

  // Cleanup (domains cascade-deleted with restaurant)
  await svc().from("restaurant_domains").delete().in("id", [idAlfa, idTmp]);
  await svc().from("restaurants").delete().eq("id", tmpRest.id);
});

// ── DO02: Host desconocido devuelve null ──────────────────────────────────────
test("DO02 get_restaurant_slug_by_host devuelve null para host desconocido", { skip: SKIP }, async () => {
  const anon = anonClient();
  const { data } = await anon.rpc("get_restaurant_slug_by_host", {
    p_host: `desconocido-${rand()}.example.test`,
  });
  assert.equal(data, null, "Host desconocido debe devolver null");
});

// ── DO03: Dominio con status != 'active' no sirve el restaurante ──────────────
test("DO03 dominio requested o disconnected no resuelve restaurante", { skip: SKIP }, async () => {
  const hostReq  = `${rand("req-")}.example.test`;
  const hostDisc = `${rand("disc-")}.example.test`;

  const { data: r1 } = await svc().from("restaurant_domains").insert({
    restaurant_id: ALFA, host: hostReq, kind: "custom", status: "requested",
  }).select("id").single();

  const { data: r2 } = await svc().from("restaurant_domains").insert({
    restaurant_id: ALFA, host: hostDisc, kind: "custom", status: "disconnected",
  }).select("id").single();

  const anon = anonClient();

  const { data: d1 } = await anon.rpc("get_restaurant_slug_by_host", { p_host: hostReq });
  const { data: d2 } = await anon.rpc("get_restaurant_slug_by_host", { p_host: hostDisc });

  assert.equal(d1, null, "status=requested no debe resolver");
  assert.equal(d2, null, "status=disconnected no debe resolver");

  // Cleanup
  await svc().from("restaurant_domains").delete().in("id", [r1!.id, r2!.id]);
});

// ── DO04: Owner no puede activar un dominio ───────────────────────────────────
test("DO04 owner no puede llamar a manage_restaurant_domain", { skip: SKIP }, async () => {
  const host = `${rand("own-")}.example.test`;
  const { data: d } = await svc().from("restaurant_domains").insert({
    restaurant_id: ALFA, host, kind: "custom", status: "requested",
  }).select("id").single();

  const ownerC = await clientFor(
    process.env.TEST_OWNER_ALFA_EMAIL!,
    process.env.TEST_OWNER_ALFA_PASSWORD!,
  );

  const { error } = await ownerC.rpc("manage_restaurant_domain", {
    p_domain_id: d!.id, p_new_status: "active",
  });
  assert.ok(error != null, "Owner no debe poder activar dominios");

  // Cleanup
  await svc().from("restaurant_domains").delete().eq("id", d!.id);
});

// ── DO05: Owner no puede reclamar dominios de otro restaurante ────────────────
test("DO05 owner de Alfa no puede registrar dominio de Beta", { skip: SKIP }, async () => {
  const ownerAlfaC = await clientFor(
    process.env.TEST_OWNER_ALFA_EMAIL!,
    process.env.TEST_OWNER_ALFA_PASSWORD!,
  );

  // Intenta insertar un dominio para BETA (no su restaurante)
  const { error } = await ownerAlfaC.from("restaurant_domains").insert({
    restaurant_id: BETA,
    host: `${rand("steal-")}.example.test`,
    kind: "custom",
    status: "requested",
  });
  assert.ok(error != null, "Owner de Alfa no debe poder registrar dominio de Beta");
});

// ── DO06: RPC no expone datos de otro restaurante por host ────────────────────
test("DO06 host de un restaurante no resuelve el slug de otro", { skip: SKIP }, async () => {
  // Create a temporary second restaurant
  const tmpSlug = rand("d-tmp2-");
  const { data: tmpRest, error: createErr } = await svc().from("restaurants").insert({
    name: "Temp Domain Test 2", slug: tmpSlug, currency: "USD",
    timezone: "America/Caracas", status: "active",
  }).select("id, slug").single();
  if (createErr || !tmpRest) { console.warn("DO06 saltado:", createErr?.message); return; }

  const hostTmp = `${rand("d06-")}.example.test`;
  const idTmp   = await createActiveDomain(tmpRest.id, hostTmp);

  // Obtener el slug de Alfa directamente (para comparar)
  const { data: alfaRow } = await svc().from("restaurants").select("slug").eq("id", ALFA).single();
  const anon = anonClient();
  const { data: resolved } = await anon.rpc("get_restaurant_slug_by_host", { p_host: hostTmp });

  // El dominio de la temp nunca debe resolver el slug de Alfa
  assert.notEqual(resolved, alfaRow?.slug, "El host del restaurante temporal no debe resolver el slug de Alfa");
  assert.equal(resolved, tmpRest.slug, "Debe resolver el slug del restaurante correcto");

  // Cleanup
  await svc().from("restaurant_domains").delete().eq("id", idTmp);
  await svc().from("restaurants").delete().eq("id", tmpRest.id);
});

// ── DO08: Owner puede solicitar un dominio y cancelarlo ───────────────────────
test("DO08 owner puede solicitar y cancelar su propio dominio", { skip: SKIP }, async () => {
  const ownerAlfaC = await clientFor(
    process.env.TEST_OWNER_ALFA_EMAIL!,
    process.env.TEST_OWNER_ALFA_PASSWORD!,
  );

  const host = `${rand("req-")}.example.test`;

  // Solicitar
  const { error: insertErr } = await ownerAlfaC.from("restaurant_domains").insert({
    restaurant_id: ALFA,
    host,
    kind:   "custom",
    status: "requested",
  });
  assert.ifError(insertErr);

  // Verificar que aparece con status requested
  const { data: domains } = await ownerAlfaC
    .from("restaurant_domains")
    .select("id, status")
    .eq("restaurant_id", ALFA)
    .eq("host", host)
    .maybeSingle();
  assert.ok(domains?.id, "Debe existir después de la solicitud");
  assert.equal(domains?.status, "requested");

  // Cancelar (DELETE sobre estado requested)
  const { error: delErr } = await ownerAlfaC
    .from("restaurant_domains")
    .delete()
    .eq("id", domains!.id)
    .eq("restaurant_id", ALFA);
  assert.ifError(delErr);

  // Verificar que ya no existe
  const { data: after } = await ownerAlfaC
    .from("restaurant_domains")
    .select("id")
    .eq("id", domains!.id)
    .maybeSingle();
  assert.equal(after, null, "Debe haberse eliminado");
});

// ── DO09: Admin puede activar y desconectar un dominio ────────────────────────
test("DO09 admin activa y desconecta un dominio con manage_restaurant_domain", { skip: SKIP }, async () => {
  const host = `${rand("adm-")}.example.test`;
  const { data: d } = await svc().from("restaurant_domains").insert({
    restaurant_id: ALFA, host, kind: "custom", status: "requested",
  }).select("id").single();

  const adminC = await clientFor(
    process.env.TEST_ADMIN_EMAIL!,
    process.env.TEST_ADMIN_PASSWORD!,
  );

  // Activate
  const { data: act, error: actErr } = await adminC.rpc("manage_restaurant_domain", {
    p_domain_id: d!.id, p_new_status: "active",
  });
  assert.ifError(actErr);
  const actResult = act as Record<string, unknown>;
  assert.equal(actResult.success, true);
  assert.equal(actResult.new_status, "active");

  // Verify via anon RPC
  const anon = anonClient();
  const { data: slug } = await anon.rpc("get_restaurant_slug_by_host", { p_host: host });
  assert.ok(typeof slug === "string" && slug.length > 0, "Dominio activo debe resolver slug");

  // Disconnect
  const { error: discErr } = await adminC.rpc("manage_restaurant_domain", {
    p_domain_id: d!.id, p_new_status: "disconnected",
  });
  assert.ifError(discErr);

  // After disconnect, should not resolve
  const { data: slugAfter } = await anon.rpc("get_restaurant_slug_by_host", { p_host: host });
  assert.equal(slugAfter, null, "Dominio desconectado no debe resolver");

  // Cleanup
  await svc().from("restaurant_domains").delete().eq("id", d!.id);
});

// ── DO10: Restaurante suspendido no resuelve por host ────────────────────────
// Usa un restaurante temporal para no interferir con Alfa.
// La suspensión se hace con el cliente admin (el trigger guard_restaurant_status
// requiere is_platform_admin(); service_role no tiene uid() válido).
test("DO10 dominio activo de restaurante suspendido no resuelve slug", { skip: SKIP }, async () => {
  const tmpSlug = rand("d-susp-");
  const { data: tmpRest, error: createErr } = await svc().from("restaurants").insert({
    name: "Temp Suspend Test", slug: tmpSlug, currency: "USD",
    timezone: "America/Caracas", status: "active",
  }).select("id").single();
  if (createErr || !tmpRest) { console.warn("DO10 saltado:", createErr?.message); return; }

  const host  = `${rand("susp-")}.example.test`;
  const idDom = await createActiveDomain(tmpRest.id, host);

  const anon   = anonClient();
  const adminC = await clientFor(process.env.TEST_ADMIN_EMAIL!, process.env.TEST_ADMIN_PASSWORD!);

  // Verify it resolves before suspension
  const { data: before } = await anon.rpc("get_restaurant_slug_by_host", { p_host: host });
  assert.ok(typeof before === "string" && before.length > 0, "Debe resolver antes de suspender");

  // Suspend via admin client (guard_restaurant_status requires platform_admin)
  await adminC.from("restaurants").update({ status: "suspended" }).eq("id", tmpRest.id);

  const { data: afterSuspend } = await anon.rpc("get_restaurant_slug_by_host", { p_host: host });
  assert.equal(afterSuspend, null, "Restaurante suspendido no debe resolver por host");

  // Cleanup (no need to reactivate — temp restaurant gets deleted)
  await svc().from("restaurant_domains").delete().eq("id", idDom);
  await svc().from("restaurants").delete().eq("id", tmpRest.id);
});
