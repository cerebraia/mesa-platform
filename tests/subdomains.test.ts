// Tests de resolución de subdominios para restaurantes.
//
// Todos los tests son de funciones puras (sin DB, sin red, sin Edge Runtime).
// Prueban la lógica de extracción de slug y de enrutamiento de paths que el
// proxy ejecuta para hosts del tipo restaurante-alfa.DOMINIO_PROPIO.
//
// Grupos:
//   SD01-SD11: extractPlatformSubdomainFor — extracción de slug desde subdominio
//   SD12-SD19: resolveRestaurantPath — decisión de acción por pathname
//   SD20:      normalizeHost + extractPlatformSubdomainFor — flujo integrado
//
// Ejecutar con: npm run test:subdomains

import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeHost,
  isPlatformHost,
  extractPlatformSubdomainFor,
  SLUG_RE,
  RESERVED_SUBDOMAINS,
  resolveRestaurantPath,
} from "../src/lib/host-resolver.ts";

// BASE ficticio usado en todos los tests de subdominios.
const BASE = "menus.example.com";

// ── SD01-SD11: extractPlatformSubdomainFor ────────────────────────────────────

test("SD01 slug válido extraído correctamente", () => {
  assert.equal(extractPlatformSubdomainFor("restaurante-alfa.menus.example.com", BASE), "restaurante-alfa");
  assert.equal(extractPlatformSubdomainFor("mi-restaurante.menus.example.com",   BASE), "mi-restaurante");
  assert.equal(extractPlatformSubdomainFor("abc123.menus.example.com",            BASE), "abc123");
});

test("SD02 www rechazado (reservado)", () => {
  assert.equal(extractPlatformSubdomainFor("www.menus.example.com", BASE), null);
});

test("SD03 app rechazado (reservado)", () => {
  assert.equal(extractPlatformSubdomainFor("app.menus.example.com", BASE), null);
});

test("SD04 admin rechazado (reservado)", () => {
  assert.equal(extractPlatformSubdomainFor("admin.menus.example.com", BASE), null);
});

test("SD05 api rechazado (reservado)", () => {
  assert.equal(extractPlatformSubdomainFor("api.menus.example.com", BASE), null);
});

test("SD06 panel rechazado (reservado)", () => {
  assert.equal(extractPlatformSubdomainFor("panel.menus.example.com", BASE), null);
});

test("SD07 subdominio multi-nivel rechazado (foo.bar.BASE)", () => {
  // "foo.bar" contiene un punto → no es un label DNS único
  assert.equal(extractPlatformSubdomainFor("foo.bar.menus.example.com", BASE), null);
});

test("SD08 slug con mayúsculas rechazado (host debe llegar normalizado)", () => {
  // El proxy siempre pasa por normalizeHost primero;
  // directamente con mayúsculas falla el SLUG_RE
  assert.equal(extractPlatformSubdomainFor("Restaurante.menus.example.com", BASE), null);
});

test("SD09 slug con caracteres inválidos rechazado", () => {
  assert.equal(extractPlatformSubdomainFor("rest_aurant.menus.example.com", BASE), null);
  assert.equal(extractPlatformSubdomainFor("rest.aurant.menus.example.com", BASE), null);
  assert.equal(extractPlatformSubdomainFor("-rest.menus.example.com",        BASE), null);
  assert.equal(extractPlatformSubdomainFor("rest-.menus.example.com",        BASE), null);
});

test("SD10 base vacío devuelve null siempre", () => {
  assert.equal(extractPlatformSubdomainFor("restaurante-alfa.menus.example.com", ""),    null);
  assert.equal(extractPlatformSubdomainFor("restaurante-alfa.menus.example.com", "   "), null);
});

test("SD11 host que no termina en el sufijo devuelve null", () => {
  assert.equal(extractPlatformSubdomainFor("restaurante-alfa.other.com",   BASE), null);
  assert.equal(extractPlatformSubdomainFor("menus.example.com",            BASE), null); // base itself, no subdomain
  assert.equal(extractPlatformSubdomainFor("restaurante-alfa.example.com", BASE), null); // wrong base
});

// ── SD12-SD19: resolveRestaurantPath ─────────────────────────────────────────

const SLUG = "restaurante-alfa";

test("SD12 raíz / reescribe al menú del restaurante", () => {
  const r = resolveRestaurantPath("/", SLUG);
  assert.equal(r.kind, "rewrite");
  if (r.kind === "rewrite") assert.equal(r.to, `/r/${SLUG}`);
});

test("SD13 /pedido/ reescribe a la confirmación del restaurante", () => {
  const r = resolveRestaurantPath("/pedido/", SLUG);
  assert.equal(r.kind, "rewrite");
  if (r.kind === "rewrite") assert.equal(r.to, `/r/${SLUG}/pedido`);
});

test("SD14 /pedido/TOKEN reescribe conservando el token", () => {
  const r = resolveRestaurantPath("/pedido/abc123deadbeef", SLUG);
  assert.equal(r.kind, "rewrite");
  if (r.kind === "rewrite") assert.equal(r.to, `/r/${SLUG}/pedido/abc123deadbeef`);
});

test("SD15 /api/orders pasa como api-passthrough (para el header de slug)", () => {
  const r = resolveRestaurantPath("/api/orders", SLUG);
  assert.equal(r.kind, "api-passthrough");
});

test("SD16 /_next/static pasa como static-passthrough", () => {
  const r = resolveRestaurantPath("/_next/static/chunks/foo.js", SLUG);
  assert.equal(r.kind, "static-passthrough");
});

test("SD17 /favicon.ico pasa como static-passthrough", () => {
  const r = resolveRestaurantPath("/favicon.ico", SLUG);
  assert.equal(r.kind, "static-passthrough");
});

test("SD18 /r/[slug] redirige a la raíz limpia (301 para marcadores viejos)", () => {
  const r1 = resolveRestaurantPath(`/r/${SLUG}`, SLUG);
  assert.equal(r1.kind, "redirect");
  if (r1.kind === "redirect") assert.equal(r1.to, "/");

  const r2 = resolveRestaurantPath(`/r/${SLUG}/pedido/`, SLUG);
  assert.equal(r2.kind, "redirect");
  if (r2.kind === "redirect") assert.equal(r2.to, "/pedido/");
});

test("SD19 ruta desconocida devuelve not-found", () => {
  assert.equal(resolveRestaurantPath("/login",  SLUG).kind, "not-found");
  assert.equal(resolveRestaurantPath("/panel",  SLUG).kind, "not-found");
  assert.equal(resolveRestaurantPath("/admin",  SLUG).kind, "not-found");
  assert.equal(resolveRestaurantPath("/about",  SLUG).kind, "not-found");
});

// ── SD20: flujo integrado normalizeHost + extractPlatformSubdomainFor ─────────

test("SD20 normalizeHost + extractPlatformSubdomainFor — flujo completo del proxy", () => {
  // Simula el flujo que sigue el proxy para un host entrante:
  // rawHost → normalizeHost → extractPlatformSubdomainFor

  function simulate(rawHost: string): string | null {
    const host = normalizeHost(rawHost);
    return extractPlatformSubdomainFor(host, BASE);
  }

  // Puerto descartado antes de comparar
  assert.equal(simulate("restaurante-alfa.menus.example.com:443"), "restaurante-alfa");
  // Mayúsculas normalizadas
  assert.equal(simulate("Restaurante-Alfa.Menus.Example.Com"), "restaurante-alfa");
  // Punto final (FQDN) descartado
  assert.equal(simulate("restaurante-alfa.menus.example.com."), "restaurante-alfa");
  // Reservado rechazado incluso tras normalización
  assert.equal(simulate("Admin.menus.example.com"), null);
  // Host desconocido rechazado
  assert.equal(simulate("restaurante-alfa.other.com"), null);
  // Localhost nunca es subdominio de restaurante (isPlatformHost lo ataja antes)
  assert.equal(isPlatformHost("localhost"), true); // proxy lo detecta en paso 1
});

// ── Invariantes adicionales del conjunto de reservados ────────────────────────

test("RESERVED_SUBDOMAINS contiene todos los nombres protegidos requeridos", () => {
  const required = ["www", "app", "admin", "api", "panel", "mail", "auth", "dashboard"];
  for (const name of required) {
    assert.ok(RESERVED_SUBDOMAINS.has(name), `"${name}" debe estar reservado`);
  }
});

test("SLUG_RE acepta slugs válidos y rechaza los inválidos", () => {
  // SLUG_RE requiere mínimo 3 chars: [a-z0-9] + [a-z0-9-]{1,61} + [a-z0-9]
  const valid   = ["restaurante-alfa", "mi-restaurante", "abc", "abc123", "a1b2c3d4"];
  const invalid = ["-empieza-mal", "termina-mal-", "con_guion_bajo", "CON-MAYUS", "a", "aa", ""];
  for (const s of valid)   assert.ok(SLUG_RE.test(s),  `SLUG_RE debería aceptar "${s}"`);
  for (const s of invalid) assert.ok(!SLUG_RE.test(s), `SLUG_RE debería rechazar "${s}"`);
});
