/**
 * Reparación idempotente de prueba-barbara.
 * Usa MESA_DATABASE_URL (conexión directa postgres) y simula la sesión
 * autenticada del admin via set_config('request.jwt.claims', ...).
 * Nunca deshabilita triggers ni relaja RLS.
 *
 * Ejecutar: npx tsx scripts/repair-prueba-barbara.ts
 */

import * as fs from "fs";
import pg from "pg";

// Read .env.local manually (no dotenv dependency — same as other scripts)
const envContent = fs.existsSync(".env.local")
  ? fs.readFileSync(".env.local", "utf-8")
  : "";
for (const line of envContent.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const dbUrl = process.env.MESA_DATABASE_URL;
if (!dbUrl) {
  console.error("MESA_DATABASE_URL no configurada en .env.local");
  process.exit(1);
}

// pg v8 / Node 24: bypass cert chain verification for Supabase pooler.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const client = new pg.Client({ connectionString: dbUrl });

async function main() {
  await client.connect();

  try {
    await client.query("BEGIN");

    // 1. Get a platform admin UUID to simulate authenticated session
    const adminRes = await client.query<{ user_id: string }>(
      "SELECT user_id FROM platform_admins LIMIT 1"
    );
    if (adminRes.rowCount === 0) {
      throw new Error("No se encontró ningún platform_admin");
    }
    const adminId = adminRes.rows[0].user_id;
    console.log(`Admin encontrado: ${adminId}`);

    // 2. Set JWT claims — simulates what the authenticated session client does.
    //    auth.uid() reads request.jwt.claims.sub; is_platform_admin() returns true.
    await client.query(
      `SELECT set_config('request.jwt.claims',
        jsonb_build_object('sub', $1::text, 'role', 'authenticated')::text,
        true)`,
      [adminId]
    );

    // 3. Verify is_platform_admin() now returns true
    const checkRes = await client.query<{ is_admin: boolean }>(
      "SELECT EXISTS(SELECT 1 FROM platform_admins WHERE user_id = auth.uid()) AS is_admin"
    );
    if (!checkRes.rows[0].is_admin) {
      throw new Error("JWT claims setup falló — is_platform_admin() sigue siendo false");
    }
    console.log("is_platform_admin() = true verificado");

    // 4. Find prueba-barbara
    const restRes = await client.query<{ id: string; status: string }>(
      "SELECT id, status FROM restaurants WHERE slug = 'prueba-barbara' AND deleted_at IS NULL"
    );
    if (restRes.rowCount === 0) {
      throw new Error("No se encontró el negocio con slug=prueba-barbara (o está eliminado)");
    }
    const { id: restaurantId, status: currentStatus } = restRes.rows[0];
    console.log(`Negocio: id=${restaurantId}, status=${currentStatus}`);

    // 5. Activate if not already active (guard trigger checks is_platform_admin() = true)
    if (currentStatus !== "active") {
      await client.query(
        "UPDATE restaurants SET status = 'active', updated_at = now() WHERE id = $1",
        [restaurantId]
      );
      console.log(`Estado: ${currentStatus} → active`);
    } else {
      console.log("Ya estaba active, sin cambio");
    }

    // 6. Ensure restaurant_config (idempotent)
    await client.query(
      `INSERT INTO restaurant_config (restaurant_id, orders_enabled)
       VALUES ($1, true)
       ON CONFLICT (restaurant_id) DO NOTHING`,
      [restaurantId]
    );
    console.log("restaurant_config: ok");

    // 7. Ensure active subscription (only if none exists — no duplicates)
    const subRes = await client.query<{ count: string }>(
      `SELECT COUNT(*) FROM subscriptions
       WHERE restaurant_id = $1 AND status = 'active'
         AND (ends_at IS NULL OR ends_at > now())`,
      [restaurantId]
    );
    const hasSub = parseInt(subRes.rows[0].count, 10) > 0;
    if (!hasSub) {
      const planRes = await client.query<{ id: string }>(
        "SELECT id FROM plans WHERE plan_code = 'inicio' AND is_active = true LIMIT 1"
      );
      if (planRes.rowCount && planRes.rowCount > 0) {
        await client.query(
          `INSERT INTO subscriptions (restaurant_id, plan_id, status, starts_at)
           VALUES ($1, $2, 'active', now())`,
          [restaurantId, planRes.rows[0].id]
        );
        console.log("Suscripción creada con plan inicio");
      } else {
        console.warn("ADVERTENCIA: plan inicio no encontrado, suscripción no creada");
      }
    } else {
      console.log("Suscripción activa ya existe, sin cambio");
    }

    await client.query("COMMIT");
    console.log("\n=== Reparación completada para prueba-barbara ===");

    // Verification read
    const verifyRes = await client.query(
      `SELECT r.id, r.slug, r.status, r.deleted_at,
              rc.orders_enabled,
              s.status AS sub_status,
              p.plan_code, p.price_cents
       FROM restaurants r
       LEFT JOIN restaurant_config rc ON rc.restaurant_id = r.id
       LEFT JOIN subscriptions s ON s.restaurant_id = r.id
         AND s.status = 'active' AND (s.ends_at IS NULL OR s.ends_at > now())
       LEFT JOIN plans p ON p.id = s.plan_id
       WHERE r.slug = 'prueba-barbara'`
    );
    console.log("\nEstado final:");
    console.table(verifyRes.rows);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("ERROR — transacción revertida:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
