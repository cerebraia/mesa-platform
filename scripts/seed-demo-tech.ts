/**
 * Seed: negocio de demostración de tecnología "Demo Tech Store"
 * - Crea el negocio si no existe (slug: demo-tech)
 * - Asigna owner: noaccess@test.mesa (re-bautizado para este rol)
 * - Configura en modalidad "Solo catálogo" (orders_enabled = false)
 * - Crea 2 categorías y 4 productos con descripción y precio
 * - Configura WhatsApp y color de marca
 *
 * Idempotente: puede ejecutarse varias veces sin duplicar.
 * Solo modifica el negocio demo-tech.
 *
 * Uso: NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx scripts/seed-demo-tech.ts
 */

import * as fs from "fs";
import { createClient } from "@supabase/supabase-js";

const envContent = fs.existsSync(".env.local") ? fs.readFileSync(".env.local", "utf-8") : "";
for (const line of envContent.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const SUPA_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SVC_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OWNER_UUID = process.env.TEST_NOACCESS_UUID!; // será owner de demo-tech

if (!SUPA_URL || !SVC_KEY || !OWNER_UUID) {
  console.error("Faltan variables de entorno."); process.exit(1);
}

const sb = createClient(SUPA_URL, SVC_KEY, { auth: { persistSession: false } });

function ok(msg: string) { console.log(`  ✓ ${msg}`); }
function step(msg: string) { console.log(`\n${msg}`); }

// ── 1. Restaurant ────────────────────────────────────────────────

async function ensureRestaurant() {
  const { data: existing } = await sb
    .from("restaurants").select("id,name,slug").eq("slug", "demo-tech").maybeSingle();
  if (existing) { ok(`Negocio existente: ${existing.name} (${existing.id})`); return existing.id as string; }

  const { data, error } = await sb.from("restaurants").insert({
    name: "Demo Tech Store",
    slug: "demo-tech",
    currency: "USD",
    timezone: "America/Caracas",
    status: "active",
  }).select("id").single();
  if (error) { console.error("Error creando negocio:", error.message); process.exit(1); }
  ok(`Negocio creado: demo-tech (${data.id})`);
  return data.id as string;
}

// ── 2. Owner membership ──────────────────────────────────────────

async function ensureOwner(restaurantId: string) {
  const { data: existing } = await sb
    .from("restaurant_members")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .eq("user_id", OWNER_UUID)
    .maybeSingle();

  if (existing) { ok(`Owner ya asignado: noaccess@test.mesa`); return; }

  const { error } = await sb.from("restaurant_members").insert({
    restaurant_id: restaurantId,
    user_id: OWNER_UUID,
    role: "owner",
    status: "active",
  });
  if (error) { console.error("Error asignando owner:", error.message); process.exit(1); }
  ok("Owner asignado: noaccess@test.mesa → demo-tech");
}

// ── 3. Configuración ─────────────────────────────────────────────

async function seedConfig(restaurantId: string) {
  const { error } = await sb.from("restaurant_config").upsert({
    restaurant_id: restaurantId,
    description: "Accesorios, gadgets y tecnología para tu día a día.",
    primary_color: "#0F4C81",     // azul tecnología
    phone: "+58 412 555 0042",
    whatsapp: "+584125550042",    // número de prueba
    address: "Av. Principal, Torre Tech, Piso 3, Caracas",
    pickup_enabled: true,
    pickup_address: "Torre Tech, Piso 3",
    pickup_notes: "Preguntar por Mónica en recepción.",
    delivery_enabled: false,
    is_temporarily_closed: false,
    closed_message: null,
    orders_enabled: false,         // MODO: Solo catálogo
  }, { onConflict: "restaurant_id" });
  if (error) { console.error("Error en config:", error.message); process.exit(1); }
  ok("Config guardada — orders_enabled: false (Solo catálogo)");
}

// ── 4. Horarios ──────────────────────────────────────────────────

async function seedHours(restaurantId: string) {
  await sb.from("business_hours").delete().eq("restaurant_id", restaurantId);
  const rows = [1,2,3,4,5].map(d => ({
    restaurant_id: restaurantId,
    day_of_week: d,
    opens_at: "09:00:00",
    closes_at: "18:00:00",
    is_active: true,
  }));
  const { error } = await sb.from("business_hours").insert(rows);
  if (error) { console.error("Error en horarios:", error.message); process.exit(1); }
  ok("Horarios: lunes a viernes 09:00–18:00");
}

// ── 5. Categorías ─────────────────────────────────────────────────

async function ensureCat(restaurantId: string, name: string, position: number) {
  const { data: existing } = await sb.from("categories")
    .select("id").eq("restaurant_id", restaurantId).eq("name", name).maybeSingle();
  if (existing) { ok(`Categoría existente: ${name}`); return existing.id as string; }
  const { data, error } = await sb.from("categories").insert({
    restaurant_id: restaurantId, name, position, is_active: true,
  }).select("id").single();
  if (error) { console.error(`Error en categoría ${name}:`, error.message); process.exit(1); }
  ok(`Categoría creada: ${name}`);
  return data.id as string;
}

// ── 6. Productos ─────────────────────────────────────────────────

interface ProductDef {
  name: string;
  description: string;
  base_price_cents: number;
  promo_price_cents?: number;
  position: number;
  variants?: Array<{ name: string; price_cents: number }>;
}

async function upsertProduct(
  restaurantId: string,
  catId: string,
  def: ProductDef,
): Promise<string> {
  const { data: existing } = await sb.from("products")
    .select("id").eq("restaurant_id", restaurantId).eq("name", def.name).maybeSingle();

  if (existing) {
    await sb.from("products").update({
      category_id: catId,
      description: def.description,
      base_price_cents: def.base_price_cents,
      promo_price_cents: def.promo_price_cents ?? null,
      is_published: true,
      is_available: true,
      position: def.position,
    }).eq("id", existing.id);
    ok(`Producto actualizado: ${def.name}`);
    return existing.id;
  }

  const { data, error } = await sb.from("products").insert({
    restaurant_id: restaurantId,
    category_id: catId,
    name: def.name,
    description: def.description,
    base_price_cents: def.base_price_cents,
    promo_price_cents: def.promo_price_cents ?? null,
    is_published: true,
    is_available: true,
    position: def.position,
  }).select("id").single();
  if (error) { console.error(`Error en producto ${def.name}:`, error.message); process.exit(1); }
  ok(`Producto creado: ${def.name}`);

  if (def.variants?.length) {
    await sb.from("product_variants").delete().eq("product_id", data.id);
    const variants = def.variants.map((v, i) => ({
      product_id: data.id,
      restaurant_id: restaurantId,
      name: v.name,
      price_cents: v.price_cents,
      position: i,
      is_available: true,
    }));
    const { error: ve } = await sb.from("product_variants").insert(variants);
    if (ve) console.warn(`  ⚠ Variantes ${def.name}:`, ve.message);
    else ok(`  Variantes: ${def.variants.map(v => v.name).join(", ")}`);
  }

  return data.id;
}

// ── Main ──────────────────────────────────────────────────────────

async function main() {
  console.log("\n=== Seed Demo Tech Store ===");
  console.log(`Supabase: ${SUPA_URL}\n`);

  step("1. Negocio");
  const restaurantId = await ensureRestaurant();

  step("2. Owner");
  await ensureOwner(restaurantId);

  step("3. Configuración (Solo catálogo)");
  await seedConfig(restaurantId);

  step("4. Horarios");
  await seedHours(restaurantId);

  step("5. Categorías");
  const catAuric = await ensureCat(restaurantId, "Accesorios y cables", 0);
  const catGadget = await ensureCat(restaurantId, "Gadgets", 1);

  step("6. Productos");
  await upsertProduct(restaurantId, catAuric, {
    name: "Cable USB-C a USB-C 1 m",
    description: "Cable de carga rápida y transferencia de datos. Compatible con laptops, tablets y smartphones. Trenzado de nylon resistente.",
    base_price_cents: 850,
    position: 0,
    variants: [
      { name: "1 metro", price_cents: 850 },
      { name: "2 metros", price_cents: 1200 },
    ],
  });

  await upsertProduct(restaurantId, catAuric, {
    name: "Hub USB-C 7 en 1",
    description: "Expande tu laptop con HDMI 4K, 3× USB-A, USB-C PD, lector SD y microSD. Plug & play sin drivers.",
    base_price_cents: 3500,
    promo_price_cents: 2900,
    position: 1,
  });

  await upsertProduct(restaurantId, catAuric, {
    name: "Soporte plegable para laptop",
    description: "Aluminio con 6 alturas ajustables. Plegable para llevar en bolso. Compatible con laptops de 11 a 17 pulgadas.",
    base_price_cents: 2200,
    position: 2,
  });

  await upsertProduct(restaurantId, catGadget, {
    name: "Auriculares inalámbricos NC",
    description: "Cancelación activa de ruido, hasta 30 h de batería, plegables. Conexión Bluetooth 5.3 con hasta 2 dispositivos simultáneos.",
    base_price_cents: 8900,
    promo_price_cents: 7500,
    position: 0,
    variants: [
      { name: "Negro", price_cents: 7500 },
      { name: "Blanco", price_cents: 7500 },
      { name: "Azul medianoche", price_cents: 8000 },
    ],
  });

  console.log(`
=== Seed completado ===

Negocio:   Demo Tech Store
Slug:      demo-tech
Owner:     noaccess@test.mesa
Modalidad: Solo catálogo (orders_enabled = false)
Color:     #0F4C81 (azul)
WhatsApp:  +584125550042 (número de prueba)

URL catálogo:  http://localhost:3001/r/demo-tech
URL panel:     http://localhost:3001/panel
               (ingresar como noaccess@test.mesa)
`);
}

main().catch(e => { console.error(e); process.exit(1); });
