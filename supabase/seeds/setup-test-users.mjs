/**
 * Crea los 6 usuarios de prueba en Supabase Auth y sus membresías.
 * Requiere: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *           MESA_DATABASE_URL en .env.local
 * Escribe las credenciales en .env.test (gitignoreado).
 * Idempotente: reutiliza usuarios si ya existen.
 * NO guarda contraseñas en archivos versionados.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const URL   = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SRK   = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON  = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!URL || !SRK || !ANON) {
  console.error("Faltan variables de entorno. Ejecutar con --env-file=.env.local");
  process.exit(1);
}

const admin = createClient(URL, SRK, { auth: { persistSession: false } });

const ALFA = "aaaaaaaa-0000-0000-0000-000000000001";
const BETA = "bbbbbbbb-0000-0000-0000-000000000002";

// Lee contraseñas existentes de .env.test para ser idempotente
function readExistingPasswords() {
  const passwords = {};
  if (existsSync(".env.test")) {
    for (const line of readFileSync(".env.test", "utf8").split("\n")) {
      const m = line.match(/^(\w+_PASSWORD)=(.+)$/);
      if (m) passwords[m[1]] = m[2];
    }
  }
  return passwords;
}

// Contraseña por defecto para el entorno de prueba (no en Git)
const DEFAULT_PASS = "Mesa#Test2026!";

const existing = readExistingPasswords();
const USERS = [
  { key: "ADMIN",          email: "admin@test.mesa",          role: null,        restaurant: null },
  { key: "OWNER_ALFA",     email: "owner-alfa@test.mesa",     role: "owner",     restaurant: ALFA },
  { key: "OWNER_BETA",     email: "owner-beta@test.mesa",     role: "owner",     restaurant: BETA },
  { key: "ATTENTION_ALFA", email: "attention-alfa@test.mesa", role: "attention", restaurant: ALFA },
  { key: "KITCHEN_ALFA",   email: "kitchen-alfa@test.mesa",   role: "kitchen",   restaurant: ALFA },
  { key: "NOACCESS",       email: "noaccess@test.mesa",       role: null,        restaurant: null },
];

// Listar usuarios existentes
const { data: authData } = await admin.auth.admin.listUsers({ perPage: 100 });
const existingByEmail = Object.fromEntries(
  (authData?.users ?? []).map(u => [u.email, u])
);

const results = [];

for (const def of USERS) {
  const password = existing[`TEST_${def.key}_PASSWORD`] ?? DEFAULT_PASS;
  let user = existingByEmail[def.email];

  if (user) {
    console.log(`  Reutilizando ${def.email} (${user.id})`);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: def.email,
      password,
      email_confirm: true,   // sin enviar correo, confirmado de inmediato
    });
    if (error) {
      console.error(`  ERROR creando ${def.email}: ${error.message}`);
      process.exit(1);
    }
    user = data.user;
    console.log(`  Creado ${def.email} (${user.id})`);
  }

  results.push({ ...def, id: user.id, password });
}

// Insertar membresías vía service_role (omite RLS)
console.log("\nInsertando membresías...");
for (const u of results.filter(u => u.role && u.restaurant)) {
  const { error } = await admin.from("restaurant_members").upsert(
    { restaurant_id: u.restaurant, user_id: u.id, role: u.role, status: "active" },
    { onConflict: "restaurant_id,user_id" }
  );
  if (error) {
    console.error(`  ERROR membresía ${u.email}: ${error.message}`);
    process.exit(1);
  }
  console.log(`  ${u.email} → ${u.role} en ${u.restaurant === ALFA ? "Alfa" : "Beta"}`);
}

// Insertar platform_admin
const adminUser = results.find(u => u.key === "ADMIN");
const { error: adminErr } = await admin.from("platform_admins").upsert(
  { user_id: adminUser.id, created_by: null },
  { onConflict: "user_id" }
);
if (adminErr) {
  console.error(`  ERROR platform_admin: ${adminErr.message}`);
  process.exit(1);
}
console.log(`  ${adminUser.email} → platform_admin`);

// Escribir .env.test (gitignoreado)
const envLines = [
  "# Credenciales de prueba — generadas por setup-test-users.mjs",
  "# NO subir al repositorio (.gitignore)",
  "",
];
for (const u of results) {
  envLines.push(`TEST_${u.key}_EMAIL=${u.email}`);
  // Citar el password para que Node.js --env-file no trunce en '#' u otros caracteres
  envLines.push(`TEST_${u.key}_PASSWORD="${u.password}"`);
  envLines.push(`TEST_${u.key}_UUID=${u.id}`);
  envLines.push("");
}
writeFileSync(".env.test", envLines.join("\n"));
console.log("\n.env.test actualizado con UUIDs y credenciales.");
console.log("\nResumen:");
for (const u of results) {
  console.log(`  ${u.email.padEnd(35)} ${u.id}`);
}
