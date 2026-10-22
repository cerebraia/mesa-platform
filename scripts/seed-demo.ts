/**
 * Seed script — restaurante-alfa demo data.
 *
 * Idempotente: usa upsert por nombre/ID para no duplicar datos.
 * Solo modifica restaurante-alfa (ID hardcodeado).
 * No toca otros restaurantes.
 *
 * Ejecutar: npx tsx scripts/seed-demo.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
// Load .env.local manually without dotenv dependency
import * as fsEnv from "fs";
const envContent = fsEnv.existsSync(".env.local") ? fsEnv.readFileSync(".env.local", "utf-8") : "";
for (const line of envContent.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

const RESTAURANT_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const RESTAURANT_NAME = "Restaurante Alfa";

// ── Helpers ────────────────────────────────────────────────────

function ok(label: string, data: unknown) {
  console.log(`  ✓ ${label}`);
  return data;
}

function fail(label: string, error: { message: string } | null) {
  console.error(`  ✗ ${label}: ${error?.message}`);
  process.exit(1);
}

async function uploadImage(
  bucket: "restaurant-assets" | "product-images",
  storagePath: string,
  localPath: string,
  contentType = "image/png",
): Promise<string> {
  if (!fs.existsSync(localPath)) {
    console.warn(`  ⚠ Imagen no encontrada localmente: ${localPath} — se omite`);
    return "";
  }
  const fileBuffer = fs.readFileSync(localPath);
  const { error } = await supabase.storage
    .from(bucket)
    .upload(storagePath, fileBuffer, {
      contentType,
      upsert: true,
    });
  if (error) fail(`upload ${storagePath}`, error);
  return storagePath;
}

// ── 1. Config del restaurante ──────────────────────────────────

async function seedConfig(coverPath: string) {
  console.log("\n1. Configuración del restaurante");
  const { error } = await supabase
    .from("restaurant_config")
    .upsert(
      {
        restaurant_id: RESTAURANT_ID,
        description: "Smash burgers, bebidas artesanales y postres caseros.",
        primary_color: "#E63B3B",
        cover_path: coverPath || null,
        logo_path: null, // Mostrará iniciales "RA" — se puede reemplazar desde el panel
        pickup_enabled: true,
        pickup_address: "Av. Principal, Locales Comerciales, Local 4",
        pickup_notes: "Pide en ventanilla y retira en mostrador.",
        delivery_enabled: true,
        is_temporarily_closed: false,
        closed_message: null,
        phone: "+58 212 555 0001",
        whatsapp: "+582125550001",
        address: "Av. Principal, Caracas",
      },
      { onConflict: "restaurant_id" },
    );
  if (error) fail("upsert restaurant_config", error);
  ok("restaurant_config actualizado", null);
}

// ── 2. Horarios (todos los días 11:00-22:00) ───────────────────

async function seedHours() {
  console.log("\n2. Horarios de atención");
  // Borrar horarios existentes para este restaurante
  const { error: delErr } = await supabase
    .from("business_hours")
    .delete()
    .eq("restaurant_id", RESTAURANT_ID);
  if (delErr) fail("delete business_hours", delErr);

  const rows = Array.from({ length: 7 }, (_, i) => ({
    restaurant_id: RESTAURANT_ID,
    day_of_week: i, // 0=Dom, 1=Lun … 6=Sáb
    opens_at: "11:00:00",
    closes_at: "22:00:00",
    is_active: true,
  }));

  const { error } = await supabase.from("business_hours").insert(rows);
  if (error) fail("insert business_hours", error);
  ok("7 días × 11:00-22:00", null);
}

// ── 3. Zonas de delivery ───────────────────────────────────────

async function seedDelivery() {
  console.log("\n3. Zonas de delivery");
  // Evitar duplicados: borrar existentes
  const { error: delErr } = await supabase
    .from("delivery_zones")
    .delete()
    .eq("restaurant_id", RESTAURANT_ID);
  if (delErr) fail("delete delivery_zones", delErr);

  const { error } = await supabase.from("delivery_zones").insert([
    {
      restaurant_id: RESTAURANT_ID,
      name: "Zona Centro",
      fee_cents: 200,
      minimum_order_cents: 500,
      is_active: true,
      position: 0,
    },
    {
      restaurant_id: RESTAURANT_ID,
      name: "Zona Este",
      fee_cents: 350,
      minimum_order_cents: 800,
      is_active: true,
      position: 1,
    },
  ]);
  if (error) fail("insert delivery_zones", error);
  ok("2 zonas creadas", null);
}

// ── 4. Métodos de pago ─────────────────────────────────────────

async function seedPayments() {
  console.log("\n4. Métodos de pago");
  const { error: delErr } = await supabase
    .from("payment_methods")
    .delete()
    .eq("restaurant_id", RESTAURANT_ID);
  if (delErr) fail("delete payment_methods", delErr);

  const { error } = await supabase.from("payment_methods").insert([
    {
      restaurant_id: RESTAURANT_ID,
      name: "Efectivo",
      type: "cash",
      is_active: true,
      instructions: "Paga en efectivo al recibir tu pedido o en ventanilla.",
      position: 0,
    },
    {
      restaurant_id: RESTAURANT_ID,
      name: "Transferencia Bancaria",
      type: "transfer",
      is_active: true,
      instructions: "Banco: Mercantil\nCuenta: 0105-0000-11-1234567890\nRIF: J-00000000-0\nEnvía comprobante al WhatsApp.",
      position: 1,
    },
    {
      restaurant_id: RESTAURANT_ID,
      name: "Pago Móvil",
      type: "mobile_payment",
      is_active: true,
      instructions: "Banco: Mercantil\nTeléfono: 0412-5550001\nRIF: J-00000000-0",
      position: 2,
    },
  ]);
  if (error) fail("insert payment_methods", error);
  ok("3 métodos de pago", null);
}

// ── 5. Categorías ──────────────────────────────────────────────

async function ensureCategory(name: string, position: number): Promise<string> {
  const { data: existing } = await supabase
    .from("categories")
    .select("id")
    .eq("restaurant_id", RESTAURANT_ID)
    .eq("name", name)
    .maybeSingle();

  if (existing) return existing.id;

  const { data, error } = await supabase
    .from("categories")
    .insert({ restaurant_id: RESTAURANT_ID, name, position, is_active: true })
    .select("id")
    .single();
  if (error) fail(`insert category ${name}`, error);
  return data!.id;
}

// ── 6. Productos ───────────────────────────────────────────────

interface ProductDef {
  name: string;
  description: string;
  base_price_cents: number;
  promo_price_cents?: number;
  position: number;
  imagePath?: string; // local path for upload
}

async function upsertProduct(
  categoryId: string,
  def: ProductDef,
  uploadedImagePath?: string,
): Promise<string> {
  const { data: existing } = await supabase
    .from("products")
    .select("id")
    .eq("restaurant_id", RESTAURANT_ID)
    .eq("name", def.name)
    .maybeSingle();

  let productId: string;

  if (existing) {
    const { data, error } = await supabase
      .from("products")
      .update({
        description: def.description,
        base_price_cents: def.base_price_cents,
        promo_price_cents: def.promo_price_cents ?? null,
        position: def.position,
        is_published: true,
        is_available: true,
        category_id: categoryId,
      })
      .eq("id", existing.id)
      .select("id")
      .single();
    if (error) fail(`update product ${def.name}`, error);
    productId = data!.id;
  } else {
    const { data, error } = await supabase
      .from("products")
      .insert({
        restaurant_id: RESTAURANT_ID,
        category_id: categoryId,
        name: def.name,
        description: def.description,
        base_price_cents: def.base_price_cents,
        promo_price_cents: def.promo_price_cents ?? null,
        position: def.position,
        is_published: true,
        is_available: true,
      })
      .select("id")
      .single();
    if (error) fail(`insert product ${def.name}`, error);
    productId = data!.id;
  }

  // Upload image if provided
  if (uploadedImagePath) {
    // Remove existing images for this product first
    await supabase.from("product_images").delete().eq("product_id", productId);

    const { error } = await supabase.from("product_images").insert({
      product_id: productId,
      restaurant_id: RESTAURANT_ID,
      storage_path: uploadedImagePath,
      alt_text: def.name,
      position: 0,
    });
    if (error) fail(`insert image for ${def.name}`, error);
  }

  return productId;
}

// ── Main ───────────────────────────────────────────────────────

async function main() {
  console.log(`\n=== Seed demo — ${RESTAURANT_NAME} ===`);
  console.log(`Supabase: ${SUPABASE_URL}`);

  // Upload cover image (678x452 landscape)
  console.log("\n0. Subida de imágenes");
  const coverLocalPath = path.join(__dirname, "../assets/images/7d06ac08-a2b8-47ce-8a16-bd14c50472d7.png");
  const coverStoragePath = await uploadImage(
    "restaurant-assets",
    `${RESTAURANT_ID}/cover.png`,
    coverLocalPath,
  );

  // Use the mesa-hero image as a shared product image for two products
  const heroLocalPath = path.join(__dirname, "../assets/images/mesa-hero.png");
  const heroStoragePath = await uploadImage(
    "product-images",
    `${RESTAURANT_ID}/demo-smash.png`,
    heroLocalPath,
  );

  if (coverStoragePath) ok(`portada subida → ${coverStoragePath}`, null);
  else console.log("  ⚠ Sin portada — el gradiente Mesa aparecerá como fallback");
  if (heroStoragePath) ok(`imagen demo subida → ${heroStoragePath}`, null);
  else console.log("  ⚠ Sin imagen de producto — aparecerá el placeholder CupIcon");

  await seedConfig(coverStoragePath);
  await seedHours();
  await seedDelivery();
  await seedPayments();

  // ── Categorías y productos ────────────────────────────────
  console.log("\n5. Categorías");

  const catHamburg = await ensureCategory("Hamburguesas", 0);
  ok(`Hamburguesas → ${catHamburg}`, null);
  const catBebidas = await ensureCategory("Bebidas", 1);
  ok(`Bebidas → ${catBebidas}`, null);
  const catPostres = await ensureCategory("Postres", 2);
  ok(`Postres → ${catPostres}`, null);

  console.log("\n6. Productos");

  // Hamburguesas
  await upsertProduct(catHamburg, {
    name: "Smash Clásica",
    description: "Double smash de 100 g, queso americano, cebolla caramelizada y salsa secreta en pan brioche.",
    base_price_cents: 700,
    position: 0,
  }, heroStoragePath || undefined);
  ok("Smash Clásica", null);

  await upsertProduct(catHamburg, {
    name: "Smash BBQ",
    description: "Double smash con salsa BBQ ahumada, bacon crocante, cheddar y pepinillos.",
    base_price_cents: 850,
    position: 1,
  });
  ok("Smash BBQ (sin imagen — necesita foto real)", null);

  await upsertProduct(catHamburg, {
    name: "Doble Smash",
    description: "Cuatro capas de smash, triple queso fundido, salsa crispy y lechuga crespa.",
    base_price_cents: 1100,
    promo_price_cents: 950,
    position: 2,
  });
  ok("Doble Smash (sin imagen — necesita foto real)", null);

  // Bebidas
  await upsertProduct(catBebidas, {
    name: "Limonada Natural",
    description: "Limones frescos, hielo y azúcar de caña. Tamaño 500 ml.",
    base_price_cents: 300,
    position: 0,
  });
  ok("Limonada Natural (sin imagen)", null);

  await upsertProduct(catBebidas, {
    name: "Té Frío de Durazno",
    description: "Infusión natural de durazno, servida fría con hielo picado. Tamaño 500 ml.",
    base_price_cents: 350,
    position: 1,
  });
  ok("Té Frío de Durazno (sin imagen)", null);

  await upsertProduct(catBebidas, {
    name: "Agua Mineral",
    description: "Agua mineral sin gas, botella 500 ml.",
    base_price_cents: 150,
    position: 2,
  });
  ok("Agua Mineral (sin imagen)", null);

  // Postres
  await upsertProduct(catPostres, {
    name: "Brownie con Helado",
    description: "Brownie de chocolate caliente con bola de helado de vainilla y salsa de caramelo.",
    base_price_cents: 500,
    position: 0,
  });
  ok("Brownie con Helado (sin imagen)", null);

  await upsertProduct(catPostres, {
    name: "Cheesecake del Día",
    description: "Cheesecake horneado con coulis de frutos rojos. Consulta disponibilidad.",
    base_price_cents: 450,
    position: 1,
  });
  ok("Cheesecake del Día (sin imagen)", null);

  console.log(`
=== Seed completado ===

Restaurante: ${RESTAURANT_NAME}
URL local:   http://localhost:3000/r/restaurante-alfa

Imágenes con foto real:    Smash Clásica (mesa-hero.png — demo)
Imágenes pendientes (6):   Smash BBQ, Doble Smash, Limonada, Té, Agua, Brownie, Cheesecake
                           → subir desde /panel/menu/products/[id]/edit o mediante upload real

Color de marca: #E63B3B (rojo — para probar el theming; cambia desde /panel/configuracion)
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
