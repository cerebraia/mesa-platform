/**
 * Aplica migración 032 (product_soft_delete).
 * Uso: npx tsx scripts/run-migration-032.ts
 */
import * as fs from "fs";
import * as path from "path";
import pg from "pg";

const envContent = fs.existsSync(".env.local") ? fs.readFileSync(".env.local", "utf-8") : "";
for (const line of envContent.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.+)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const DB_URL = process.env.MESA_DATABASE_URL;
if (!DB_URL) { console.error("MESA_DATABASE_URL falta en .env.local"); process.exit(1); }

const connString = DB_URL
  .replace(/^["']/, "").replace(/["']$/, "")
  .replace(":6543/", ":5432/")
  .replace("sslmode=require", "sslmode=no-verify");

const client = new pg.Client({ connectionString: connString, ssl: { rejectUnauthorized: false } });

async function main() {
  await client.connect();
  console.log("Conectado.");

  const { rows } = await client.query(
    "SELECT version FROM supabase_migrations.schema_migrations WHERE version = '20261029000032'"
  );
  if (rows.length > 0) {
    console.log("Migración 032 ya aplicada.");
    await client.end();
    return;
  }

  const sql = fs.readFileSync(
    path.join(path.dirname(new URL(import.meta.url).pathname), "../supabase/migrations/20261029000032_product_soft_delete.sql"),
    "utf-8"
  );

  await client.query("BEGIN");
  await client.query(sql);
  await client.query(
    "INSERT INTO supabase_migrations.schema_migrations(version, statements, name) VALUES($1, $2, $3)",
    ["20261029000032", `{${sql.substring(0, 80).replace(/'/g, "''")}}`, "032 — product soft delete"]
  );
  await client.query("COMMIT");
  console.log("✓ Migración 032 aplicada correctamente.");

  // Verify
  const c1 = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name='products' AND column_name='deleted_at'");
  console.log("products.deleted_at:", c1.rows[0]?.column_name ?? "MISSING");
  const c2 = await client.query("SELECT proname FROM pg_proc WHERE proname IN ('soft_delete_product','restore_product')");
  console.log("RPCs:", c2.rows.map((r:any)=>r.proname).join(", "));
  const c3 = await client.query("SELECT trigger_name FROM information_schema.triggers WHERE trigger_name='trg_order_item_no_deleted_product'");
  console.log("Trigger:", c3.rows[0]?.trigger_name ?? "MISSING");

  await client.end();
}

main().catch(e => { console.error("Error:", e.message); process.exit(1); });
