/**
 * Aplica migración 024 directamente al Supabase via connection pooler.
 * Requiere MESA_DATABASE_URL en .env.local.
 */
import * as fs from "fs";
import * as path from "path";
import pg from "pg";

const envContent = fs.existsSync(".env.local") ? fs.readFileSync(".env.local", "utf-8") : "";
for (const line of envContent.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) {
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const DB_URL = process.env.MESA_DATABASE_URL;
if (!DB_URL) { console.error("MESA_DATABASE_URL falta en .env.local"); process.exit(1); }

const sql = fs.readFileSync(
  path.join(path.dirname(new URL(import.meta.url).pathname), "../supabase/migrations/20261022000024_catalog_mode.sql"),
  "utf-8",
);

const client = new pg.Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  console.log("\n=== Aplicando migración 024 — Modalidad del catálogo ===\n");
  await client.connect();
  console.log("Conectado al pooler de Supabase.");

  try {
    await client.query(sql);
    console.log("✓ Migración 024 aplicada correctamente.\n");

    const { rows } = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name='restaurant_config' AND column_name='orders_enabled'"
    );
    console.log(`✓ Columna orders_enabled: ${rows.length > 0 ? "EXISTE" : "NO ENCONTRADA"}`);

    const { rows: trigger } = await client.query(
      "SELECT trigger_name FROM information_schema.triggers WHERE trigger_name='trg_guard_orders_enabled'"
    );
    console.log(`✓ Trigger trg_guard_orders_enabled: ${trigger.length > 0 ? "EXISTE" : "NO ENCONTRADO"}`);
  } finally {
    await client.end();
  }
}

main().catch((e) => { console.error("Error:", e.message); process.exit(1); });
