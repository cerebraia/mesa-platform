/**
 * Aplica migración 034 (fix anon RLS child policies).
 * URGENTE: corrige 500 en todos los catálogos públicos.
 * Uso: npx tsx scripts/run-migration-034.ts
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
    "SELECT version FROM supabase_migrations.schema_migrations WHERE version = '20261030000034'"
  );
  if (rows.length > 0) {
    console.log("Migración 034 ya aplicada.");
    await client.end();
    return;
  }

  const sql = fs.readFileSync(
    path.join(path.dirname(new URL(import.meta.url).pathname), "../supabase/migrations/20261030000034_fix_anon_child_rls_policies.sql"),
    "utf-8"
  );

  await client.query("BEGIN");
  await client.query(sql);
  await client.query(
    "INSERT INTO supabase_migrations.schema_migrations(version, statements, name) VALUES($1, $2, $3)",
    ["20261030000034", `{${sql.substring(0, 80).replace(/'/g, "''")}}`, "034 — fix anon child RLS policies"]
  );
  await client.query("COMMIT");
  console.log("✓ Migración 034 aplicada correctamente.");

  // Verify policies exist
  const check = await client.query(`
    SELECT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('product_images','product_variants','option_groups','options')
      AND policyname IN (
        'product_images_anon_select',
        'product_variants_anon_select',
        'option_groups_anon_select',
        'options_anon_select'
      )
    ORDER BY tablename, policyname
  `);
  console.log("Políticas activas:", check.rows.map((r: any) => `${r.tablename}.${r.policyname}`).join(", "));

  await client.end();
}

main().catch(e => { console.error("Error:", e.message); process.exit(1); });
