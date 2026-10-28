/**
 * seed-lanz-technology.ts
 * Importa Lanz Technology como negocio real en Mesa.
 *
 * Fuente: https://lanztechnology.com/
 * Catálogo: 6 productos DJI (verificados 26/10/2026)
 * Modalidad: Solo catálogo (orders_enabled = false)
 * Idempotente: puede ejecutarse varias veces sin duplicados.
 *
 * Uso:
 *   npx tsx scripts/seed-lanz-technology.ts
 *
 * Requiere en .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import * as fs   from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";

// ── Env ──────────────────────────────────────────────────────────────────────

const envContent = fs.existsSync(".env.local")
  ? fs.readFileSync(".env.local", "utf-8")
  : "";
for (const line of envContent.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SVC_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPA_URL || !SVC_KEY) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY"); process.exit(1);
}

const sb = createClient(SUPA_URL, SVC_KEY, { auth: { persistSession: false } });

// ── Logging ───────────────────────────────────────────────────────────────────

function ok(msg: string)   { console.log(`  ✓ ${msg}`); }
function warn(msg: string) { console.log(`  ⚠ ${msg}`); }
function step(msg: string) { console.log(`\n── ${msg}`); }
function info(msg: string) { console.log(`  · ${msg}`); }

// ── Configuración del negocio ──────────────────────────────────────────────────

const SLUG        = "lanz-technology";
const OWNER_EMAIL = "lfefl1998@gmail.com";

// Colores: morado vibrante de la portada Lanz Technology
const BRAND_COLOR = "#7C3AED";

// WhatsApp del negocio (spec): +58 426-6540669  →  584266540669
const BUSINESS_WA = "+584266540669";

// Imagen de portada disponible localmente
const LOCAL_COVER_PATH = path.join(
  process.env.HOME ?? "",
  "Downloads/Lanz_Technology_Portada_Carrusel_1080x1350.png",
);

// Productos de lanztechnology.com (verificados 26/10/2026)
// Los precios son "REF" en USD; se muestran tal como los publica la tienda.
// stable_key = URL del producto en la fuente (sirve para idempotencia).
const PRODUCTS_DEF = [
  {
    stable_key: "https://lanztechnology.com/product/dji-osmo-pocket-4p",
    name:        "DJI Osmo Pocket 4P",
    category:    "Cámara",
    description: "Cámara compacta con sensor CMOS de 1 pulgada, doble lente con zoom óptico 3×, estabilización mecánica de 3 ejes, seguimiento inteligente de sujetos y pantalla táctil giratoria. Diseñada para vloggers y creadores que necesitan calidad cinematográfica en formato de bolsillo. Entrega gratuita en Caracas; envíos nacionales por Zoom y MRW coordinados por WhatsApp. Precio REF USD · Zelle · USDT · Bs.",
    price_usd:   1400.00,
    position:    0,
    image_src:   "https://omguumvsfaubghvxszmy.supabase.co/storage/v1/object/public/catalog-images/products/195056fd-17f3-44ac-848a-681c61855b48/1792517320698.jpg",
    image_ext:   "jpg",
  },
  {
    stable_key: "https://lanztechnology.com/product/dji-osmo-pocket-3",
    name:        "DJI Osmo Pocket 3",
    category:    "Cámara",
    description: "Cámara compacta con sensor CMOS de 1 pulgada, grabación 4K hasta 120 fps, estabilización de 3 ejes, pantalla táctil giratoria de 2 pulgadas y ActiveTrack 6.0 para seguimiento automático. Incluye DJI Mic Mini (1TX) como obsequio. Entrega gratuita en Caracas; envíos nacionales por Zoom y MRW coordinados por WhatsApp. Precio REF USD · Zelle · USDT · Bs.",
    price_usd:   800.00,
    position:    1,
    image_src:   "https://omguumvsfaubghvxszmy.supabase.co/storage/v1/object/public/catalog-images/products/6f0fff1d-c041-4843-8221-34aa8ad4e90f/1792515336434.jpg",
    image_ext:   "jpg",
  },
  {
    stable_key: "https://lanztechnology.com/product/dji-osmo-action-6",
    name:        "DJI Osmo Action 6",
    category:    "Cámaras de acción",
    description: "Cámara de acción con grabación 4K a 120 fps, estabilización RockSteady, resistencia al agua y pantalla frontal y trasera. Ideal para deportes extremos, viajes y contenido para redes sociales. Entrega gratuita en Caracas; envíos nacionales por Zoom y MRW coordinados por WhatsApp. Precio REF USD · Zelle · USDT · Bs.",
    price_usd:   800.00,
    position:    0,
    image_src:   "https://omguumvsfaubghvxszmy.supabase.co/storage/v1/object/public/catalog-images/products/208391d7-48c1-4e91-b7ea-439bed5750ea/1792517057841.jpg",
    image_ext:   "jpg",
  },
  {
    stable_key: "https://lanztechnology.com/product/dji-osmo-360",
    name:        "DJI Osmo 360",
    category:    "Cámaras 360°",
    description: "Cámara 360° que captura video 8K inmersivo con doble lente de alta calidad y estabilización HorizonSteady avanzada. Ideal para tours virtuales, cobertura de eventos y contenido envolvente. Entrega gratuita en Caracas; envíos nacionales por Zoom y MRW coordinados por WhatsApp. Precio REF USD · Zelle · USDT · Bs.",
    price_usd:   800.00,
    position:    0,
    image_src:   "https://omguumvsfaubghvxszmy.supabase.co/storage/v1/object/public/catalog-images/products/cb46b199-27a6-408c-8733-64dd4c6ba784/1792517207022.webp",
    image_ext:   "webp",
  },
  {
    stable_key: "https://lanztechnology.com/product/dji-mic-mini",
    name:        "DJI Mic Mini",
    category:    "Audio",
    description: "Micrófono inalámbrico compacto con reducción de ruido integrada, conexión rápida y diseño ultraligero. Compatible con smartphones y cámaras profesionales mediante receptor. Ideal para creadores de contenido, entrevistas y grabaciones en movimiento. Entrega gratuita en Caracas; envíos nacionales por Zoom y MRW coordinados por WhatsApp. Precio REF USD · Zelle · USDT · Bs.",
    price_usd:   140.00,
    position:    0,
    image_src:   "https://omguumvsfaubghvxszmy.supabase.co/storage/v1/object/public/catalog-images/products/dji-mic-mini/dji-mic-mini-principal.webp",
    image_ext:   "webp",
  },
  {
    stable_key: "https://lanztechnology.com/product/dji-power-1000-v2",
    name:        "DJI Power 1000 V2",
    category:    "Estación de Carga",
    description: "Estación de energía portátil de 1024 Wh con batería LiFePO4, salida continua de 2200 W (pico 4400 W) y función UPS con conmutación de 10 ms. Incluye 2 AC, 2 USB-C 140 W, 2 USB-A y 2 puertos SDC para carga de drones DJI. Carga completa en ~70 min desde red, hasta 800 W solar. Ideal para producción audiovisual, exteriores y backup doméstico. Precio REF USD · Zelle · USDT · Bs.",
    price_usd:   800.00,
    position:    0,
    image_src:   "https://omguumvsfaubghvxszmy.supabase.co/storage/v1/object/public/catalog-images/products/4688f68d-1e12-4cca-92e1-1f5641214d49/1786387347808.jpg",
    image_ext:   "jpg",
  },
] as const;

// Orden de categorías en el catálogo
const CATEGORY_ORDER: Record<string, number> = {
  "Cámara":           0,
  "Cámaras de acción": 1,
  "Cámaras 360°":     2,
  "Audio":            3,
  "Estación de Carga": 4,
};

// ── 1. Usuario propietario ────────────────────────────────────────────────────

async function ensureOwnerUser(): Promise<string> {
  // Buscar usuario existente
  const { data: listData } = await sb.auth.admin.listUsers({ perPage: 100 });
  const existing = listData?.users?.find(u => u.email === OWNER_EMAIL);
  if (existing) {
    ok(`Usuario existente: ${OWNER_EMAIL} (${existing.id})`);
    return existing.id;
  }

  // Crear usuario con contraseña temporal
  const tempPassword = `Lanz${Date.now()}!`;
  const { data, error } = await sb.auth.admin.createUser({
    email:         OWNER_EMAIL,
    password:      tempPassword,
    email_confirm: true,
  });
  if (error || !data.user) {
    console.error("Error creando usuario:", error?.message); process.exit(1);
  }
  ok(`Usuario creado: ${OWNER_EMAIL} (${data.user.id})`);
  warn(`Contraseña temporal: ${tempPassword} — cambia desde Supabase Dashboard o /login`);
  return data.user.id;
}

// ── 2. Restaurante ─────────────────────────────────────────────────────────────

async function ensureRestaurant(): Promise<string> {
  const { data: existing } = await sb.from("restaurants")
    .select("id,name,slug").eq("slug", SLUG).maybeSingle();
  if (existing) {
    ok(`Negocio existente: ${existing.name} (${existing.id})`);
    return existing.id as string;
  }

  const { data, error } = await sb.from("restaurants").insert({
    name:     "Lanz Technology",
    slug:     SLUG,
    currency: "USD",
    timezone: "America/Caracas",
    status:   "active",
  }).select("id").single();
  if (error) { console.error("Error creando negocio:", error.message); process.exit(1); }
  ok(`Negocio creado: lanz-technology (${data.id})`);
  return data.id as string;
}

// ── 3. Membresía owner ────────────────────────────────────────────────────────

async function ensureMembership(restaurantId: string, userId: string) {
  const { data: existing } = await sb.from("restaurant_members")
    .select("id").eq("restaurant_id", restaurantId).eq("user_id", userId).maybeSingle();
  if (existing) { ok(`Membresía owner ya existe: ${OWNER_EMAIL}`); return; }

  const { error } = await sb.from("restaurant_members").insert({
    restaurant_id: restaurantId,
    user_id:       userId,
    role:          "owner",
    status:        "active",
  });
  if (error) { console.error("Error asignando owner:", error.message); process.exit(1); }
  ok(`Membresía owner asignada: ${OWNER_EMAIL} → lanz-technology`);
}

// ── 4. Configuración del negocio ───────────────────────────────────────────────

async function seedConfig(restaurantId: string) {
  const { error } = await sb.from("restaurant_config").upsert({
    restaurant_id:       restaurantId,
    description:         "Productos DJI y tecnología premium en Venezuela. Cámaras, estabilizadores, audio y accesorios para creadores de contenido.",
    primary_color:       BRAND_COLOR,
    phone:               "+584266540669",
    whatsapp:            BUSINESS_WA,
    instagram_url:       "https://www.instagram.com/lanztechnology/",
    pickup_enabled:      false,
    delivery_enabled:    false,
    is_temporarily_closed: false,
    closed_message:      null,
    orders_enabled:      false,   // Solo catálogo
  }, { onConflict: "restaurant_id" });
  if (error) { console.error("Error en config:", error.message); process.exit(1); }
  ok("Config guardada — Solo catálogo, WhatsApp +584266540669, morado #7C3AED");
  warn("TikTok (@lanztechnology) y YouTube (@lanz_technology) no tienen campo en el esquema actual. Anotados aquí para futura extensión.");
}

// ── 5. Horarios ────────────────────────────────────────────────────────────────

async function seedHours(restaurantId: string) {
  // Borra e inserta (idempotente al ejecutar de nuevo)
  await sb.from("business_hours").delete().eq("restaurant_id", restaurantId);
  // Lunes–Sábado 09:00–18:00 (web no especifica horario exacto; se usa estándar comercial)
  const rows = [1,2,3,4,5,6].map(d => ({
    restaurant_id: restaurantId,
    day_of_week:   d,
    opens_at:      "09:00:00",
    closes_at:     "18:00:00",
    is_active:     true,
  }));
  const { error } = await sb.from("business_hours").insert(rows);
  if (error) { console.error("Error en horarios:", error.message); process.exit(1); }
  ok("Horarios: lunes–sábado 09:00–18:00 (horario estimado; verificar con la tienda)");
}

// ── 6. Métodos de pago (informacionales en modo catálogo) ─────────────────────

async function seedPaymentMethods(restaurantId: string) {
  // Elimina métodos existentes del negocio
  await sb.from("payment_methods").delete().eq("restaurant_id", restaurantId);
  const methods = [
    { name: "Efectivo USD",     type: "cash",  instructions: null, is_active: true, position: 0 },
    { name: "Zelle",            type: "transfer", instructions: null, is_active: true, position: 1 },
    { name: "USDT (criptomoneda)", type: "other", instructions: null, is_active: true, position: 2 },
    { name: "Pago en bolívares (Bs.)", type: "transfer", instructions: null, is_active: true, position: 3 },
  ];
  const rows = methods.map(m => ({ ...m, restaurant_id: restaurantId }));
  const { error } = await sb.from("payment_methods").insert(rows);
  if (error) { console.warn("  ⚠ Error en métodos de pago:", error.message); }
  else ok("Métodos de pago: Efectivo USD, Zelle, USDT, Bs.");
}

// ── 7. Categorías ──────────────────────────────────────────────────────────────

async function ensureCategory(
  restaurantId: string, name: string, position: number,
): Promise<string> {
  const { data: existing } = await sb.from("categories")
    .select("id").eq("restaurant_id", restaurantId).eq("name", name).maybeSingle();
  if (existing) { ok(`Categoría existente: ${name}`); return existing.id as string; }

  const { data, error } = await sb.from("categories").insert({
    restaurant_id: restaurantId,
    name,
    position,
    is_active: true,
  }).select("id").single();
  if (error) { console.error(`Error en categoría ${name}:`, error.message); process.exit(1); }
  ok(`Categoría creada: ${name}`);
  return data.id as string;
}

// ── 8. Productos ──────────────────────────────────────────────────────────────

async function upsertProduct(
  restaurantId: string,
  catId: string,
  def: typeof PRODUCTS_DEF[number],
): Promise<string> {
  // Idempotencia: busca por nombre exacto dentro del negocio
  const { data: existing } = await sb.from("products")
    .select("id").eq("restaurant_id", restaurantId).eq("name", def.name).maybeSingle();

  const price_cents = Math.round(def.price_usd * 100);

  if (existing) {
    await sb.from("products").update({
      category_id:     catId,
      description:     def.description,
      base_price_cents: price_cents,
      is_published:    true,
      is_available:    true,
      position:        def.position,
    }).eq("id", existing.id);
    ok(`Producto actualizado: ${def.name} ($${def.price_usd})`);
    return existing.id as string;
  }

  const { data, error } = await sb.from("products").insert({
    restaurant_id:    restaurantId,
    category_id:      catId,
    name:             def.name,
    description:      def.description,
    base_price_cents: price_cents,
    is_published:     true,
    is_available:     true,
    position:         def.position,
  }).select("id").single();
  if (error) { console.error(`Error en producto ${def.name}:`, error.message); process.exit(1); }
  ok(`Producto creado: ${def.name} ($${def.price_usd})`);
  return data.id as string;
}

// ── 9. Descargar imagen ────────────────────────────────────────────────────────

async function downloadImage(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) { warn(`HTTP ${res.status} al descargar ${url}`); return null; }
    const buf = await res.arrayBuffer();
    return Buffer.from(buf);
  } catch (e) {
    warn(`Error descargando ${url}: ${(e as Error).message}`);
    return null;
  }
}

// ── 10. Subir imagen de producto a Storage ─────────────────────────────────────

async function uploadProductImage(
  restaurantId: string,
  productId: string,
  def: typeof PRODUCTS_DEF[number],
): Promise<string | null> {
  // Comprueba si ya hay imagen para este producto
  const { data: existingImg } = await sb.from("product_images")
    .select("id,storage_path").eq("product_id", productId).limit(1).maybeSingle();
  if (existingImg) {
    info(`Imagen ya existe para ${def.name}: ${existingImg.storage_path}`);
    return existingImg.storage_path;
  }

  info(`Descargando imagen: ${def.image_src}`);
  const buf = await downloadImage(def.image_src);
  if (!buf) return null;

  const ts = Date.now();
  const storagePath = `${restaurantId}/${productId}/${ts}.${def.image_ext}`;
  const contentType = def.image_ext === "webp" ? "image/webp" : "image/jpeg";

  const { error: uploadErr } = await sb.storage
    .from("product-images")
    .upload(storagePath, buf, { contentType, upsert: false });

  if (uploadErr) {
    warn(`Error subiendo imagen ${def.name}: ${uploadErr.message}`);
    return null;
  }

  // Registra en product_images
  const { error: dbErr } = await sb.from("product_images").insert({
    product_id:    productId,
    restaurant_id: restaurantId,
    storage_path:  storagePath,
    alt_text:      def.name,
    position:      0,
  });
  if (dbErr) { warn(`Error registrando imagen ${def.name}: ${dbErr.message}`); return null; }

  ok(`Imagen subida: ${storagePath}`);
  return storagePath;
}

// ── 11. Subir portada ─────────────────────────────────────────────────────────

async function uploadCover(restaurantId: string) {
  // Comprueba si ya hay portada
  const { data: cfg } = await sb.from("restaurant_config")
    .select("cover_path").eq("restaurant_id", restaurantId).maybeSingle();
  if (cfg?.cover_path) {
    info(`Portada ya existe: ${cfg.cover_path}`);
    return;
  }

  if (!fs.existsSync(LOCAL_COVER_PATH)) {
    warn(`Portada no encontrada en ${LOCAL_COVER_PATH} — omitida`);
    return;
  }

  const buf = fs.readFileSync(LOCAL_COVER_PATH);
  const storagePath = `${restaurantId}/cover.png`;

  const { error: uploadErr } = await sb.storage
    .from("restaurant-assets")
    .upload(storagePath, buf, { contentType: "image/png", upsert: true });

  if (uploadErr) {
    warn(`Error subiendo portada: ${uploadErr.message}`);
    return;
  }

  const { error: updErr } = await sb.from("restaurant_config")
    .update({ cover_path: storagePath })
    .eq("restaurant_id", restaurantId);
  if (updErr) { warn(`Error actualizando cover_path: ${updErr.message}`); return; }

  ok(`Portada subida: ${storagePath}`);
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║   Seed: Lanz Technology → Mesa           ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log(`Supabase: ${SUPA_URL}\n`);

  step("1. Usuario propietario");
  const userId = await ensureOwnerUser();

  step("2. Negocio");
  const restaurantId = await ensureRestaurant();

  step("3. Membresía owner");
  await ensureMembership(restaurantId, userId);

  step("4. Configuración");
  await seedConfig(restaurantId);

  step("5. Horarios");
  await seedHours(restaurantId);

  step("6. Métodos de pago (informacionales)");
  await seedPaymentMethods(restaurantId);

  step("7. Categorías");
  const catMap: Record<string, string> = {};
  for (const [catName, pos] of Object.entries(CATEGORY_ORDER)) {
    catMap[catName] = await ensureCategory(restaurantId, catName, pos);
  }

  step("8. Productos");
  const productIds: Record<string, string> = {};
  for (const def of PRODUCTS_DEF) {
    const catId = catMap[def.category];
    if (!catId) { warn(`Categoría no encontrada: ${def.category}`); continue; }
    productIds[def.name] = await upsertProduct(restaurantId, catId, def);
  }

  step("9. Imágenes de productos");
  let imagesOk = 0;
  let imagesFail = 0;
  for (const def of PRODUCTS_DEF) {
    const productId = productIds[def.name];
    if (!productId) continue;
    const result = await uploadProductImage(restaurantId, productId, def);
    if (result) imagesOk++; else imagesFail++;
  }

  step("10. Portada del negocio");
  await uploadCover(restaurantId);

  // ── Resumen ───────────────────────────────────────────────────────────────
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║   Lanz Technology — Importación completada                   ║
╚══════════════════════════════════════════════════════════════╝

Negocio:        Lanz Technology
Slug:           lanz-technology
Restaurant ID:  ${restaurantId}
Owner:          ${OWNER_EMAIL} (${userId})
Modalidad:      Solo catálogo (orders_enabled = false)
Color:          ${BRAND_COLOR}
WhatsApp:       ${BUSINESS_WA}
Instagram:      https://www.instagram.com/lanztechnology/
TikTok/YouTube: Sin campo en esquema actual (ver advertencias)

Productos importados (${PRODUCTS_DEF.length}/6):
  ┌──────────────────────────────────────┬──────────┬──────────────────────────────────────────┐
  │ Producto                             │ Precio   │ Fuente                                   │
  ├──────────────────────────────────────┼──────────┼──────────────────────────────────────────┤
  │ DJI Osmo Pocket 4P                   │ $1400    │ /product/dji-osmo-pocket-4p              │
  │ DJI Osmo Pocket 3                    │ $800     │ /product/dji-osmo-pocket-3               │
  │ DJI Osmo Action 6                    │ $800     │ /product/dji-osmo-action-6               │
  │ DJI Osmo 360                         │ $800     │ /product/dji-osmo-360                    │
  │ DJI Mic Mini                         │ $140     │ /product/dji-mic-mini                    │
  │ DJI Power 1000 V2                    │ $800     │ /product/dji-power-1000-v2               │
  └──────────────────────────────────────┴──────────┴──────────────────────────────────────────┘

Imágenes:       ${imagesOk} OK, ${imagesFail} fallidas

Notas:
  · Precios publicados como "REF USD" en lanztechnology.com (Zelle, USDT, Bs. también aceptados)
  · No se dedujeron cantidades de inventario de "Disponible"
  · Contenido de caja: solo Pocket 3 lo menciona (incluye Mic Mini 1TX como obsequio)
  · Horarios son estimados (09:00–18:00 L–S); verificar con la tienda
  · TikTok y YouTube no tienen campo en restaurant_config — ampliar esquema en próxima migración

URLs locales:
  Catálogo público: http://localhost:3001/r/lanz-technology
  Panel (owner):    http://localhost:3001/panel
                    (ingresar como ${OWNER_EMAIL})
`);
}

main().catch(e => { console.error(e); process.exit(1); });
