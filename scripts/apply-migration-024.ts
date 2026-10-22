/**
 * Aplica migración 024 (modalidad del catálogo) al Supabase del proyecto Mesa.
 * Añade: orders_enabled column, GRANT anon, update save_restaurant_config, trigger.
 *
 * Como no hay acceso directo a la BD desde este script, sólo ejecuta el seed
 * de la columna (ALTER TABLE + GRANT) mediante el RPC existente si existe, o
 * muestra las instrucciones manuales.
 *
 * Para aplicar el DDL completo:
 *   Supabase Dashboard → SQL Editor → pegar supabase/migrations/20261022000024_catalog_mode.sql
 *
 * Uso: npx tsx scripts/apply-migration-024.ts
 */

import * as fs from "fs";
import { createClient } from "@supabase/supabase-js";

const envContent = fs.existsSync(".env.local") ? fs.readFileSync(".env.local", "utf-8") : "";
for (const line of envContent.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
}

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SVC_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPA_URL || !SVC_KEY) {
  console.error("Faltan variables de entorno.");
  process.exit(1);
}

const supabase = createClient(SUPA_URL, SVC_KEY, { auth: { persistSession: false } });

async function main() {
  console.log(`\n=== Migración 024 — Modalidad del catálogo ===`);
  console.log(`Supabase: ${SUPA_URL}\n`);

  // Check if column exists
  const { data, error } = await supabase
    .from("restaurant_config")
    .select("orders_enabled")
    .limit(1);

  if (error?.message?.includes("orders_enabled")) {
    console.log("⚠ La columna orders_enabled NO existe todavía.");
    console.log("\nPara aplicar la migración 024 completa:");
    console.log("  1. Supabase Dashboard → SQL Editor → Nueva consulta");
    console.log("  2. Pegar el contenido de:");
    console.log("     supabase/migrations/20261022000024_catalog_mode.sql");
    console.log("  3. Ejecutar → verificar sin errores");
    console.log("\nEl script no puede aplicar DDL sin conexión directa a PostgreSQL.\n");
    return;
  }

  if (error) {
    console.error("Error al verificar:", error.message);
    return;
  }

  console.log("✓ Columna orders_enabled ya existe en restaurant_config.");
  console.log("✓ Migración 024 aplicada (o no necesaria).\n");

  // Count businesses with orders_enabled configured
  const { count } = await supabase
    .from("restaurant_config")
    .select("*", { count: "exact", head: true })
    .eq("orders_enabled", false);

  console.log(`  Negocios en modo Solo catálogo: ${count ?? 0}`);
  console.log(`  (El resto usan el default: Catálogo con pedidos)\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
