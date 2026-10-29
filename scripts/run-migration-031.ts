/**
 * Aplica migración 031 (products_draft_support) — base_price_cents nullable.
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
if (!DB_URL) { console.error("MESA_DATABASE_URL falta"); process.exit(1); }

const connString = DB_URL
  .replace(/^["']/, "").replace(/["']$/, "")
  .replace(":6543/", ":5432/")
  .replace("sslmode=require", "sslmode=no-verify");

const client = new pg.Client({ connectionString: connString, ssl: { rejectUnauthorized: false } });

async function main() {
  await client.connect();
  console.log("Conectado.");

  // Check if already applied
  const { rows } = await client.query(
    "SELECT version FROM supabase_migrations.schema_migrations WHERE version = '20261028000031'"
  );
  if (rows.length > 0) {
    console.log("Migración 031 ya aplicada.");
    await client.end();
    return;
  }

  const sql = fs.readFileSync(
    path.join(path.dirname(new URL(import.meta.url).pathname), "../supabase/migrations/20261028000031_products_draft_support.sql"),
    "utf-8"
  );

  await client.query("BEGIN");
  await client.query(sql);
  await client.query(
    "INSERT INTO supabase_migrations.schema_migrations(version, statements, name) VALUES($1, $2, $3)",
    ["20261028000031", `{${sql.substring(0, 80).replace(/'/g, "''")}}`, "031 — draft product support"]
  );
  await client.query("COMMIT");
  console.log("✓ Migración 031 aplicada correctamente.");

  const r = await client.query(
    "SELECT is_nullable FROM information_schema.columns WHERE table_name='products' AND column_name='base_price_cents'"
  );
  console.log("base_price_cents is_nullable:", r.rows[0]?.is_nullable);
  await client.end();
}

main().catch(e => { console.error("Error:", e.message); process.exit(1); });
