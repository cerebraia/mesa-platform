/**
 * Aplica la migración 023 (planes comerciales) al Supabase del proyecto Mesa.
 * Se ejecuta en dos fases:
 *   Fase 1 — DDL y seed via pg (PostgreSQL directo), si DATABASE_URL está disponible.
 *   Fase 2 — Solo seed de planes (INSERT) via supabase-js si no hay conexión directa.
 *
 * Uso: npx tsx scripts/apply-migration-023.ts
 *
 * Variables requeridas (en .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   MESA_DATABASE_URL  (opcional — para fase DDL completa)
 */

import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";

// Load .env.local
const envContent = fs.existsSync(".env.local") ? fs.readFileSync(".env.local", "utf-8") : "";
for (const line of envContent.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
}

const SUPA_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SVC_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DB_URL    = process.env.MESA_DATABASE_URL;

if (!SUPA_URL || !SVC_KEY) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(SUPA_URL, SVC_KEY, { auth: { persistSession: false } });

function ok(msg: string) { console.log(`  ✓ ${msg}`); }
function info(msg: string) { console.log(`  ℹ ${msg}`); }

// ── Fase 1: DDL via pg directo (si MESA_DATABASE_URL disponible) ────────────

async function applyFullMigration() {
  if (!DB_URL) {
    info("MESA_DATABASE_URL no disponible — se omite la fase DDL.");
    info("Para aplicar DDL completo, ejecuta el SQL en el Supabase Dashboard:");
    info("  Dashboard → SQL Editor → Nueva consulta → pegar supabase/migrations/20261022000023_commercial_plans.sql");
    return false;
  }

  // pg must be installed separately: npm install pg @types/pg
  let pgModule: { Client: new (opts: { connectionString: string }) => { connect(): Promise<void>; query(sql: string): Promise<unknown>; end(): Promise<void> } };
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pgModule = await import("pg" as string) as any;
  } catch {
    info("Módulo 'pg' no instalado. Instala con: npm install pg");
    return false;
  }

  const client = new pgModule.Client({ connectionString: DB_URL });
  await client.connect();

  const sql = fs.readFileSync(
    path.join(__dirname, "../supabase/migrations/20261022000023_commercial_plans.sql"),
    "utf-8",
  );

  await client.query(sql);
  await client.end();
  ok("Migración 023 aplicada completa (DDL + seed)");
  return true;
}

// ── Fase 2: Solo INSERT de planes (siempre disponible) ──────────────────────

async function seedPlansOnly() {
  console.log("\nVerificando columnas en plans...");

  // Check if plan_code column exists
  const { data: cols } = await supabase.rpc("get_plan_usage", {
    p_restaurant_id: "00000000-0000-0000-0000-000000000000",
  }).abortSignal(AbortSignal.timeout(3000));

  // plan_code column check: if it doesn't exist, DDL needs to be applied first
  const { error: colCheck } = await supabase
    .from("plans")
    .select("plan_code")
    .limit(1);

  if (colCheck?.message?.includes("column") && colCheck.message.includes("plan_code")) {
    console.error("  ✗ La columna plan_code no existe. Aplica el DDL manualmente primero:");
    console.error("    Dashboard → SQL Editor → pegar 20261022000023_commercial_plans.sql");
    return false;
  }

  console.log("Insertando/actualizando planes comerciales...");

  const plans = [
    {
      plan_code: "inicio",
      name: "Mesa Inicio",
      description: "Todo lo que necesitas para publicar tu menú y recibir pedidos.",
      price_cents: 1900, currency: "USD", max_products: 50, max_members: 1,
      allowed_roles: ["owner"],
      is_active: true, is_test: false,
    },
    {
      plan_code: "negocio",
      name: "Mesa Negocio",
      description: "Para equipos que necesitan más espacio y roles especializados.",
      price_cents: 3900, currency: "USD", max_products: 200, max_members: 5,
      allowed_roles: ["owner","attention","kitchen"],
      is_active: true, is_test: false,
    },
    {
      plan_code: "acompanado",
      name: "Mesa Acompañado",
      description: "Más capacidad y ayuda directa de nuestro equipo para tu catálogo.",
      price_cents: 6900, currency: "USD", max_products: 400, max_members: 10,
      allowed_roles: ["owner","attention","kitchen"],
      is_active: true, is_test: false,
    },
  ];

  for (const plan of plans) {
    // Check if plan exists by plan_code
    const { data: existing } = await supabase
      .from("plans")
      .select("id")
      .eq("plan_code", plan.plan_code)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("plans")
        .update({
          name: plan.name, description: plan.description,
          price_cents: plan.price_cents, max_products: plan.max_products,
          max_members: plan.max_members, allowed_roles: plan.allowed_roles,
          is_active: plan.is_active,
        })
        .eq("id", existing.id);
      if (error) { console.error(`  ✗ ${plan.plan_code}: ${error.message}`); continue; }
      ok(`Plan '${plan.plan_code}' actualizado`);
    } else {
      const { error } = await supabase.from("plans").insert(plan);
      if (error) { console.error(`  ✗ ${plan.plan_code}: ${error.message}`); continue; }
      ok(`Plan '${plan.plan_code}' insertado`);
    }
  }
  return true;
}

async function main() {
  console.log(`\n=== Migración 023 — Planes comerciales Mesa ===`);
  console.log(`Supabase: ${SUPA_URL}\n`);

  const fullApplied = await applyFullMigration();

  if (!fullApplied) {
    await seedPlansOnly();

    console.log(`
⚠ PENDIENTE: El DDL (funciones y trigger) debe aplicarse manualmente.
Instrucciones:
  1. Abre el Supabase Dashboard → SQL Editor
  2. Crea una nueva consulta
  3. Pega el contenido de:
     supabase/migrations/20261022000023_commercial_plans.sql
  4. Ejecuta la consulta
  5. Verifica que no hay errores

Las funciones críticas que requieren DDL:
  - get_plan_usage(uuid)          → widget de plan en el panel
  - check_member_limit_on_change() + trigger  → límite de miembros
  - upsert_product actualizado    → límite de productos
`);
  }

  // Verify plans in DB
  console.log("\nVerificación final:");
  const { data: plans, error } = await supabase
    .from("plans")
    .select("plan_code, name, price_cents, max_products, max_members, is_active")
    .eq("is_test", false)
    .eq("is_active", true)
    .order("price_cents");

  if (error) {
    console.error("  ✗ Error al verificar:", error.message);
  } else {
    for (const p of plans ?? []) {
      ok(`${p.plan_code ?? "(sin código)"}: ${p.name} — ${(p.price_cents/100).toFixed(0)} USD, ≤${p.max_products} productos, ≤${p.max_members} usuarios`);
    }
  }
  console.log();
}

main().catch((e) => { console.error(e); process.exit(1); });
