/**
 * Aplica migraciones 023-030 en orden al Supabase configurado en .env.local.
 * Todas las migraciones son aditivas (no borran datos ni hacen reset).
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

const MIGRATIONS = [
  { version: "20261022000023", file: "20261022000023_commercial_plans.sql",     label: "023 — Planes comerciales" },
  { version: "20261022000024", file: "20261022000024_catalog_mode.sql",         label: "024 — Modo catálogo" },
  { version: "20261026000025", file: "20261026000025_catalog_appearance.sql",   label: "025 — Apariencia catálogo" },
  { version: "20261026000026", file: "20261026000026_product_image_fit.sql",    label: "026 — Image fit producto" },
  { version: "20261026000027", file: "20261026000027_product_image_thumbnail.sql", label: "027 — Thumbnail producto" },
  { version: "20261027000028", file: "20261027000028_financial_movements.sql",  label: "028 — Movimientos financieros" },
  { version: "20261027000029", file: "20261027000029_product_cost_stock.sql",   label: "029 — Costo y stock producto" },
  { version: "20261027000030", file: "20261027000030_stock_tracking_config.sql",label: "030 — Config seguimiento stock" },
];

// Use session mode (port 5432) — transaction mode (6543) doesn't support DDL
const connString = DB_URL
  .replace(":6543/", ":5432/")
  .replace("sslmode=require", "sslmode=no-verify");
const client = new pg.Client({ connectionString: connString, ssl: { rejectUnauthorized: false } });

async function main() {
  console.log("\n=== Runner de migraciones 023-030 ===\n");
  await client.connect();
  console.log("Conectado.\n");

  // Fetch already-applied migrations
  const { rows: applied } = await client.query(
    "SELECT version FROM supabase_migrations.schema_migrations ORDER BY version"
  );
  const appliedSet = new Set(applied.map((r: { version: string }) => r.version));
  console.log(`Migraciones ya aplicadas: ${applied.length} (hasta ${applied[applied.length-1]?.version ?? 'ninguna'})\n`);

  let applied_count = 0;
  let skipped_count = 0;

  for (const mig of MIGRATIONS) {
    if (appliedSet.has(mig.version)) {
      console.log(`  ↳ ${mig.label} — ya aplicada, omitiendo.`);
      skipped_count++;
      continue;
    }

    const filePath = path.join(
      path.dirname(new URL(import.meta.url).pathname),
      "../supabase/migrations",
      mig.file
    );

    if (!fs.existsSync(filePath)) {
      // Try alternate filename (in case of date discrepancy)
      const dir = path.join(path.dirname(new URL(import.meta.url).pathname), "../supabase/migrations");
      const match = fs.readdirSync(dir).find(f => f.startsWith(mig.version));
      if (!match) {
        console.error(`  ✗ ${mig.label} — archivo no encontrado: ${mig.file}`);
        process.exit(1);
      }
      const altPath = path.join(dir, match);
      console.log(`  → ${mig.label} — usando ${match}`);
      const sql = fs.readFileSync(altPath, "utf-8");
      await applyMigration(mig.version, mig.label, sql);
    } else {
      const sql = fs.readFileSync(filePath, "utf-8");
      await applyMigration(mig.version, mig.label, sql);
    }
    applied_count++;
  }

  console.log(`\n=== Resultado: ${applied_count} aplicadas, ${skipped_count} omitidas ===\n`);

  // Post-apply verification
  console.log("Verificando objetos creados...");
  const checks = await client.query(`
    SELECT
      (SELECT COUNT(*) FROM pg_tables WHERE schemaname='public' AND tablename='financial_movements')::int AS fin_table,
      (SELECT COUNT(*) FROM pg_proc WHERE proname='get_financial_summary')::int AS fin_rpc,
      (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='products' AND column_name='cost_cents')::int AS cost_col,
      (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='restaurant_config' AND column_name='stock_tracking_enabled')::int AS stock_col,
      (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='restaurant_config' AND column_name='orders_enabled')::int AS orders_col
  `);
  const v = checks.rows[0];
  console.log(`  financial_movements table : ${v.fin_table ? '✓' : '✗'}`);
  console.log(`  get_financial_summary RPC : ${v.fin_rpc ? '✓' : '✗'}`);
  console.log(`  products.cost_cents       : ${v.cost_col ? '✓' : '✗'}`);
  console.log(`  restaurant_config.stock   : ${v.stock_col ? '✓' : '✗'}`);
  console.log(`  restaurant_config.orders  : ${v.orders_col ? '✓' : '✗'}`);

  await client.end();
}

async function applyMigration(version: string, label: string, sql: string) {
  console.log(`  → Aplicando ${label}...`);
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query(
      "INSERT INTO supabase_migrations.schema_migrations (version, statements, name) VALUES ($1, $2, $3) ON CONFLICT (version) DO NOTHING",
      [version, `{${sql.substring(0,100).replace(/'/g, "''")}...}`, label]
    );
    await client.query("COMMIT");
    console.log(`  ✓ ${label} — OK`);
  } catch (e) {
    await client.query("ROLLBACK");
    const err = e as Error;
    console.error(`  ✗ ${label} — FALLÓ: ${err.message}`);
    throw e;
  }
}

main().catch((e) => { console.error("Error fatal:", e.message); process.exit(1); });
