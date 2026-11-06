/**
 * seed-goxo-valencia.ts
 * Importa Goxo Valencia (tarta vasca) como negocio real en Wacatalog.
 *
 * Fuente: PDF "Tarta.pdf" proporcionado por el propietario.
 * Fecha: 2026-11-06
 *
 * Negocio:   Goxo Valencia
 * Slug:      goxo-valencia
 * URL:       https://goxo-valencia.wacatalogo.com/
 * WhatsApp:  +584124297849 (Goxo — no confundir con WA comercial de Wacatalog)
 * Instagram: https://www.instagram.com/goxovalencia/
 * Moneda:    EUR (€)
 * Modalidad: Solo catálogo — consultas por WhatsApp
 *
 * Idempotente: puede ejecutarse varias veces sin duplicar negocios,
 * categorías, productos ni imágenes.
 *
 * Uso:
 *   npx tsx scripts/seed-goxo-valencia.ts
 *
 * Requiere en .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Las imágenes deben estar en /tmp/goxo-imgs/ (extraídas con pdfimages).
 *
 * NOTAS DE IMPORTACIÓN:
 * - 17 productos implementados (el PDF lista ~18 items; la diferencia se debe
 *   a que "Tarta Vasca Tradicional (entera)" y "Vasca Fudgy (entera)" tienen
 *   dos tamaños cada una, implementados como variantes del mismo producto).
 * - "Choco Chunch" conserva el nombre del PDF — posible errata por "Choco Crunch".
 * - "Tradicional con Chocoavellanas" no tiene foto propia: el PDF usa la misma
 *   imagen incrustada que "Tradicional con Ovomaltina". Se deja sin imagen hasta
 *   que el propietario aporte una foto diferenciada.
 * - img-006.jpg es imagen promocional con texto superpuesto — descartada.
 * - Logo de Goxo no extraíble con calidad suficiente — pendiente del propietario.
 * - Propietario del negocio (email) no proporcionado — membresía pendiente.
 * - El subdominio goxo-valencia.wacatalogo.com funciona por código (wildcard
 *   PLATFORM_SUBDOMAIN_BASE=wacatalogo.com en Railway), pero los registros DNS
 *   * CNAME → f93otn7m.up.railway.app siguen pendientes según ESTADO.md.
 */

import * as fs from "fs";
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
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(SUPA_URL, SVC_KEY, { auth: { persistSession: false } });

// ── Logging ───────────────────────────────────────────────────────────────────

function ok(msg: string)   { console.log(`  ✓ ${msg}`); }
function warn(msg: string) { console.log(`  ⚠ ${msg}`); }
function step(msg: string) { console.log(`\n── ${msg}`); }
function info(msg: string) { console.log(`  · ${msg}`); }

// ── Configuración del negocio ─────────────────────────────────────────────────

const SLUG        = "goxo-valencia";
const BUSINESS_WA = "+584124297849";
const BRAND_COLOR = "#C9808A"; // rosa empolvado — extraído de la paleta del PDF
const BG_COLOR    = "#FDF8F5"; // crema cálida
const SEC_COLOR   = "#6B4B4B"; // marrón cálido

const IMGS_DIR = "/tmp/goxo-imgs";

// ── Tipos auxiliares ──────────────────────────────────────────────────────────

interface VariantDef { name: string; price_eur: number; }
interface OptionDef  { name: string; price_delta_eur: number; }
interface OptionGroupDef {
  name: string;
  min: number;
  max: number;
  options: OptionDef[];
}
interface ImageDef {
  file: string;
  ext: "jpg" | "png";
  contentType: string;
}
interface ProductDef {
  name:          string;
  category:      string;
  description:   string;
  price_eur:     number;
  position:      number;
  images:        ImageDef[];
  variants?:     VariantDef[];
  option_groups?: OptionGroupDef[];
}

// ── Catálogo de productos ─────────────────────────────────────────────────────
//
// Precios exactos del PDF. Dinero en centavos en BD (price_eur * 100).
// image_fit se deja en null (default = cover); el propietario puede ajustar.
// Descripciones tomadas literalmente del PDF; solo se corrigen tildes evidentes.

const PRODUCTS: ProductDef[] = [

  // ── Categoría: Vas-Cream ───────────────────────────────────────────────────

  {
    name:        "Vas-Cream",
    category:    "Vas-Cream",
    description: "Helado con base de tarta vasca y topping de chocolate o de crema Lotus con galleta Lotus. Promo: 2 Vas-Cream por 10€.",
    price_eur:   6,
    position:    0,
    images: [{ file: "img-000.jpg", ext: "jpg", contentType: "image/jpeg" }],
  },

  // ── Categoría: Porciones de tarta ─────────────────────────────────────────

  {
    name:        "Vasca Fit",
    category:    "Porciones de tarta",
    description: "Tarta vasca sin azúcar, sin gluten y con más proteína, pídela con tu topping de frutos rojos.",
    price_eur:   8,
    position:    0,
    images: [{ file: "img-001.jpg", ext: "jpg", contentType: "image/jpeg" }],
    option_groups: [{
      name: "Topping extra",
      min:  0,
      max:  1,
      options: [{ name: "Dulce de leche sin azúcar", price_delta_eur: 1 }],
    }],
  },
  {
    name:        "Basque de Pistacho",
    category:    "Porciones de tarta",
    description: "Porción de tarta vasca con crema de pistacho 100% artesanal, con topping de pistacho.",
    price_eur:   8,
    position:    1,
    images: [{ file: "img-003.jpg", ext: "jpg", contentType: "image/jpeg" }],
  },
  {
    name:        "Basque de Chocolate Dubái",
    category:    "Porciones de tarta",
    description: "Porción de tarta vasca con crema de pistacho 100% artesanal, con topping de chocolate, kataifi crujiente y pistacho.",
    price_eur:   9,
    position:    2,
    images: [{ file: "img-002.jpg", ext: "jpg", contentType: "image/jpeg" }],
  },
  {
    name:        "Tarta Vasca Tradicional",
    category:    "Porciones de tarta",
    description: "Porción individual de tarta vasca, incluye mermelada de frutos rojos.",
    price_eur:   7,
    position:    3,
    images: [{ file: "img-004.png", ext: "png", contentType: "image/png" }],
  },
  {
    // Nombre conservado del PDF. Posible errata: "Chunch" podría ser "Crunch".
    name:        "Choco Chunch",
    category:    "Porciones de tarta",
    description: "Porción individual de tarta vasca tradicional con topping de chocolate crunchy.",
    price_eur:   8,
    position:    4,
    images: [{ file: "img-005.png", ext: "png", contentType: "image/png" }],
  },
  {
    name:        "Tradicional con Ovomaltina",
    category:    "Porciones de tarta",
    description: "Porción individual de tarta vasca tradicional con topping de ovomaltina.",
    price_eur:   8,
    position:    5,
    images: [{ file: "img-010.jpg", ext: "jpg", contentType: "image/jpeg" }],
  },
  {
    name:        "Tradicional con Dulce de Leche",
    category:    "Porciones de tarta",
    description: "Porción individual de tarta vasca tradicional con topping de dulce de leche.",
    price_eur:   7.5,
    position:    6,
    images: [{ file: "img-011.jpg", ext: "jpg", contentType: "image/jpeg" }],
  },
  {
    name:        "Tradicional con Crema Lotus y Galleta Lotus",
    category:    "Porciones de tarta",
    description: "Porción individual de tarta vasca con topping de crema Lotus y galleta Lotus.",
    price_eur:   8,
    position:    7,
    images: [{ file: "img-009.jpg", ext: "jpg", contentType: "image/jpeg" }],
  },
  {
    name:        "Tradicional con Ovomaltina y Pirulin",
    category:    "Porciones de tarta",
    description: "Porción individual de tarta vasca con topping de ovomaltina y pirulin.",
    price_eur:   9,
    position:    8,
    images: [{ file: "img-012.jpg", ext: "jpg", contentType: "image/jpeg" }],
  },
  {
    // Sin foto propia: el PDF incrusta la misma imagen que "Tradicional con Ovomaltina".
    // Se omite la imagen hasta que el propietario aporte una foto diferenciada.
    name:        "Tradicional con Chocoavellanas",
    category:    "Porciones de tarta",
    description: "Porción individual de tarta vasca con topping de chocoavellanas.",
    price_eur:   7.5,
    position:    9,
    images:      [],
  },

  // ── Categoría: Tartas enteras ──────────────────────────────────────────────
  // Todas "Bajo encargo". Variantes de tamaño donde aplica.
  // base_price_cents = precio de la variante más pequeña.

  {
    name:        "Tarta Vasca Tradicional (entera)",
    category:    "Tartas enteras",
    description: "Tarta vasca tradicional entera. Bajo encargo.",
    price_eur:   35,
    position:    0,
    // img-014: foto aérea de la tarta tradicional. img-017: en molde de cartón.
    images: [
      { file: "img-014.jpg", ext: "jpg", contentType: "image/jpeg" },
      { file: "img-017.jpg", ext: "jpg", contentType: "image/jpeg" },
    ],
    variants: [
      { name: "1 kg",  price_eur: 35 },
      { name: "2 kg",  price_eur: 60 },
    ],
  },
  {
    name:        "Tarta Vasca con Topping de Frutos Rojos (entera)",
    category:    "Tartas enteras",
    description: "Tarta vasca con topping de frutos rojos. 2 kg. Bajo encargo.",
    price_eur:   65,
    position:    1,
    images: [{ file: "img-015.jpg", ext: "jpg", contentType: "image/jpeg" }],
  },
  {
    name:        "Tarta Vasca con Mermelada de Parchita (entera)",
    category:    "Tartas enteras",
    description: "Tarta vasca con mermelada de parchita. 2 kg. Bajo encargo.",
    price_eur:   65,
    position:    2,
    images: [{ file: "img-016.jpg", ext: "jpg", contentType: "image/jpeg" }],
  },
  {
    name:        "Vasca Fudgy (entera)",
    category:    "Tartas enteras",
    description: "Tarta vasca tradicional con base de brownie fudgy. Bajo encargo.",
    price_eur:   35,
    position:    3,
    images: [{ file: "img-018.jpg", ext: "jpg", contentType: "image/jpeg" }],
    variants: [
      { name: "1 kg",  price_eur: 35 },
      { name: "2 kg",  price_eur: 65 },
    ],
  },
  {
    name:        "Tarta Vasca de Chocolate Dubái (entera)",
    category:    "Tartas enteras",
    description: "Base de tarta vasca con crema 100% artesanal con topping de chocolate, kataifi crujiente y pistacho. 1 kg. Bajo encargo.",
    price_eur:   50,
    position:    4,
    images: [{ file: "img-019.png", ext: "png", contentType: "image/png" }],
  },
  {
    name:        "Tarta Vasca con Crema Lotus y Galleta Lotus (entera)",
    category:    "Tartas enteras",
    description: "Tarta vasca tradicional con topping de crema Lotus y galleta Lotus. 1 kg. Bajo encargo.",
    price_eur:   50,
    position:    5,
    images: [{ file: "img-020.jpg", ext: "jpg", contentType: "image/jpeg" }],
  },
];

const CATEGORY_ORDER: Record<string, number> = {
  "Vas-Cream":          0,
  "Porciones de tarta": 1,
  "Tartas enteras":     2,
};

// ── 1. Negocio ────────────────────────────────────────────────────────────────

async function ensureRestaurant(): Promise<string> {
  const { data: existing } = await sb.from("restaurants")
    .select("id,name,slug").eq("slug", SLUG).maybeSingle();
  if (existing) {
    ok(`Negocio existente: ${existing.name} (${existing.id})`);
    return existing.id as string;
  }

  const { data, error } = await sb.from("restaurants").insert({
    name:     "Goxo Valencia",
    slug:     SLUG,
    currency: "EUR",
    timezone: "Europe/Madrid",
    status:   "active",
  }).select("id").single();
  if (error) { console.error("Error creando negocio:", error.message); process.exit(1); }
  ok(`Negocio creado: goxo-valencia (${data.id})`);
  return data.id as string;
}

// ── 2. Configuración ──────────────────────────────────────────────────────────

async function seedConfig(restaurantId: string) {
  const { error } = await sb.from("restaurant_config").upsert({
    restaurant_id:         restaurantId,
    description:           "Tartas vascas artesanales en Valencia. Porciones y tartas enteras bajo encargo.",
    primary_color:         BRAND_COLOR,
    background_color:      BG_COLOR,
    secondary_color:       SEC_COLOR,
    font_family:           "Nunito",
    phone:                 null,
    whatsapp:              BUSINESS_WA,
    instagram_url:         "https://www.instagram.com/goxovalencia/",
    facebook_url:          null,
    twitter_url:           null,
    pickup_enabled:        false,
    delivery_enabled:      false,
    is_temporarily_closed: false,
    closed_message:        null,
    orders_enabled:        false,
    seo_title:             "Goxo Valencia — Tarta Vasca",
    seo_description:       "Tartas vascas artesanales en Valencia. Porciones y tartas enteras bajo encargo.",
    allow_indexing:        true,
  }, { onConflict: "restaurant_id" });
  if (error) { console.error("Error en config:", error.message); process.exit(1); }
  ok(`Config guardada — Solo catálogo, WhatsApp ${BUSINESS_WA}, EUR, Nunito`);
}

// ── 3. Categorías ─────────────────────────────────────────────────────────────

async function ensureCategory(
  restaurantId: string,
  name: string,
  position: number,
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

// ── 4. Productos ──────────────────────────────────────────────────────────────

async function upsertProduct(
  restaurantId: string,
  catId: string,
  def: ProductDef,
): Promise<string> {
  const price_cents = Math.round(def.price_eur * 100);

  const { data: existing } = await sb.from("products")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .eq("name", def.name)
    .is("deleted_at", null)
    .maybeSingle();

  if (existing) {
    await sb.from("products").update({
      category_id:      catId,
      description:      def.description,
      base_price_cents: price_cents,
      is_published:     true,
      is_available:     true,
      position:         def.position,
    }).eq("id", existing.id);
    ok(`Producto actualizado: ${def.name} (€${def.price_eur})`);
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
  ok(`Producto creado: ${def.name} (€${def.price_eur})`);
  return data.id as string;
}

// ── 5. Variantes ──────────────────────────────────────────────────────────────

async function upsertVariants(
  restaurantId: string,
  productId: string,
  variants: VariantDef[],
  productName: string,
) {
  const { data: existing } = await sb.from("product_variants")
    .select("id").eq("product_id", productId);

  if (existing && existing.length === variants.length) {
    info(`Variantes ya configuradas: ${productName}`);
    return;
  }

  // Delete-and-reinsert for idempotency (same as upsert_product RPC).
  if (existing && existing.length > 0) {
    await sb.from("product_variants").delete().eq("product_id", productId);
  }

  for (let i = 0; i < variants.length; i++) {
    const v = variants[i];
    const { error } = await sb.from("product_variants").insert({
      product_id:    productId,
      restaurant_id: restaurantId,
      name:          v.name,
      price_cents:   Math.round(v.price_eur * 100),
      is_available:  true,
      position:      i,
    });
    if (error) { warn(`Error en variante ${v.name} (${productName}): ${error.message}`); }
    else { ok(`Variante: ${productName} → ${v.name} (€${v.price_eur})`); }
  }
}

// ── 6. Grupos de opciones ─────────────────────────────────────────────────────

async function upsertOptionGroups(
  restaurantId: string,
  productId: string,
  groups: OptionGroupDef[],
  productName: string,
) {
  const { data: existingGroups } = await sb.from("option_groups")
    .select("id").eq("product_id", productId);

  if (existingGroups && existingGroups.length === groups.length) {
    info(`Grupos de opciones ya configurados: ${productName}`);
    return;
  }

  if (existingGroups && existingGroups.length > 0) {
    for (const g of existingGroups) {
      await sb.from("options").delete().eq("option_group_id", g.id);
    }
    await sb.from("option_groups").delete().eq("product_id", productId);
  }

  for (let gi = 0; gi < groups.length; gi++) {
    const grp = groups[gi];
    const { data: gData, error: gErr } = await sb.from("option_groups").insert({
      product_id:     productId,
      restaurant_id:  restaurantId,
      name:           grp.name,
      min_selections: grp.min,
      max_selections: grp.max,
      position:       gi,
    }).select("id").single();
    if (gErr) { warn(`Error en grupo ${grp.name}: ${gErr.message}`); continue; }

    for (let oi = 0; oi < grp.options.length; oi++) {
      const opt = grp.options[oi];
      const { error: oErr } = await sb.from("options").insert({
        option_group_id:  gData.id,
        restaurant_id:    restaurantId,
        name:             opt.name,
        price_delta_cents: Math.round(opt.price_delta_eur * 100),
        is_available:     true,
        position:         oi,
      });
      if (oErr) { warn(`Error en opción ${opt.name}: ${oErr.message}`); }
      else { ok(`Opción: ${grp.name} → ${opt.name} (+€${opt.price_delta_eur})`); }
    }
  }
}

// ── 7. Imágenes de producto ───────────────────────────────────────────────────

async function uploadProductImages(
  restaurantId: string,
  productId: string,
  images: ImageDef[],
  productName: string,
): Promise<{ uploaded: number; skipped: number }> {
  if (images.length === 0) {
    info(`Sin imagen: ${productName}`);
    return { uploaded: 0, skipped: 0 };
  }

  const { data: existingImgs } = await sb.from("product_images")
    .select("id").eq("product_id", productId);
  if (existingImgs && existingImgs.length >= images.length) {
    info(`Imágenes ya existen: ${productName} (${existingImgs.length} registradas)`);
    return { uploaded: 0, skipped: images.length };
  }

  let uploaded = 0;
  let skipped  = 0;

  for (let pos = 0; pos < images.length; pos++) {
    const imgDef = images[pos];
    const localPath = path.join(IMGS_DIR, imgDef.file);

    if (!fs.existsSync(localPath)) {
      warn(`Archivo no encontrado: ${localPath}`);
      skipped++;
      continue;
    }

    const buf = fs.readFileSync(localPath);
    const ts  = Date.now() + pos;
    const storagePath = `${restaurantId}/${productId}/${ts}.${imgDef.ext}`;

    const { error: uploadErr } = await sb.storage
      .from("product-images")
      .upload(storagePath, buf, { contentType: imgDef.contentType, upsert: false });

    if (uploadErr) {
      if (uploadErr.message?.includes("already exists")) {
        info(`Imagen ya en Storage: ${storagePath}`);
        skipped++;
      } else {
        warn(`Error subiendo imagen ${imgDef.file} (${productName}): ${uploadErr.message}`);
        skipped++;
      }
      continue;
    }

    const { error: dbErr } = await sb.from("product_images").insert({
      product_id:    productId,
      restaurant_id: restaurantId,
      storage_path:  storagePath,
      alt_text:      productName,
      position:      pos,
    });
    if (dbErr) { warn(`Error registrando imagen ${imgDef.file}: ${dbErr.message}`); skipped++; }
    else { ok(`Imagen subida: ${storagePath}`); uploaded++; }
  }

  return { uploaded, skipped };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║   Seed: Goxo Valencia → Wacatalog           ║");
  console.log("╚══════════════════════════════════════════════╝");
  console.log(`Supabase: ${SUPA_URL}\n`);

  if (!fs.existsSync(IMGS_DIR)) {
    console.error(`Directorio de imágenes no encontrado: ${IMGS_DIR}`);
    console.error("Ejecuta: pdfimages -all /ruta/a/Tarta.pdf /tmp/goxo-imgs/img");
    process.exit(1);
  }

  step("1. Negocio");
  const restaurantId = await ensureRestaurant();

  step("2. Configuración");
  await seedConfig(restaurantId);

  step("3. Categorías");
  const catMap: Record<string, string> = {};
  for (const [catName, pos] of Object.entries(CATEGORY_ORDER)) {
    catMap[catName] = await ensureCategory(restaurantId, catName, pos);
  }

  step("4. Productos, variantes y opciones");
  const productIds: Record<string, string> = {};
  for (const def of PRODUCTS) {
    const catId = catMap[def.category];
    if (!catId) { warn(`Categoría no encontrada: ${def.category}`); continue; }

    const productId = await upsertProduct(restaurantId, catId, def);
    productIds[def.name] = productId;

    if (def.variants && def.variants.length > 0) {
      await upsertVariants(restaurantId, productId, def.variants, def.name);
    }

    if (def.option_groups && def.option_groups.length > 0) {
      await upsertOptionGroups(restaurantId, productId, def.option_groups, def.name);
    }
  }

  step("5. Imágenes");
  let totalUploaded = 0;
  let totalSkipped  = 0;
  for (const def of PRODUCTS) {
    const productId = productIds[def.name];
    if (!productId) continue;
    const { uploaded, skipped } = await uploadProductImages(
      restaurantId, productId, def.images, def.name,
    );
    totalUploaded += uploaded;
    totalSkipped  += skipped;
  }

  // ── Conteos por categoría ─────────────────────────────────────────────────
  const byCategory: Record<string, { total: number; conFoto: number; sinFoto: number; conVariantes: number }> = {};
  for (const def of PRODUCTS) {
    if (!byCategory[def.category]) {
      byCategory[def.category] = { total: 0, conFoto: 0, sinFoto: 0, conVariantes: 0 };
    }
    byCategory[def.category].total++;
    if (def.images.length > 0) byCategory[def.category].conFoto++;
    else                        byCategory[def.category].sinFoto++;
    if (def.variants && def.variants.length > 0) byCategory[def.category].conVariantes++;
  }
  const totalProducts = PRODUCTS.length;
  const conFoto  = PRODUCTS.filter(p => p.images.length > 0).length;
  const sinFoto  = PRODUCTS.filter(p => p.images.length === 0).length;

  console.log(`
╔══════════════════════════════════════════════════════════════════════╗
║   Goxo Valencia — Importación completada                            ║
╚══════════════════════════════════════════════════════════════════════╝

Negocio:        Goxo Valencia
Slug:           goxo-valencia
Restaurant ID:  ${restaurantId}
Modalidad:      Solo catálogo (orders_enabled = false)
Moneda:         EUR (€)
WhatsApp:       ${BUSINESS_WA}
Instagram:      https://www.instagram.com/goxovalencia/
Tipografía:     Nunito
Color primario: ${BRAND_COLOR} (rosa empolvado)
Fondo:          ${BG_COLOR} (crema cálida)
Secundario:     ${SEC_COLOR} (marrón cálido)

Catálogo:
  ┌───────────────────────────┬───────┬─────────┬──────────┬──────────────┐
  │ Categoría                 │ Total │ Con foto │ Sin foto │ Con variante │
  ├───────────────────────────┼───────┼──────────┼──────────┼──────────────┤
  │ Vas-Cream                 │   1   │    1     │    0     │      0       │
  │ Porciones de tarta        │  10   │    9     │    1     │      0       │
  │ Tartas enteras            │   6   │    6     │    0     │      2       │
  ├───────────────────────────┼───────┼──────────┼──────────┼──────────────┤
  │ TOTAL                     │  ${totalProducts}   │   ${conFoto}      │    ${sinFoto}     │      2       │
  └───────────────────────────┴───────┴──────────┴──────────┴──────────────┘

Imágenes:       ${totalUploaded} subidas, ${totalSkipped} omitidas/ya existentes

Productos con grupos de opciones:
  · Vasca Fit → "Topping extra" (opt. 0-1): Dulce de leche sin azúcar +1€

Productos con variantes:
  · Tarta Vasca Tradicional (entera): 1 kg → 35€ | 2 kg → 60€
  · Vasca Fudgy (entera):             1 kg → 35€ | 2 kg → 65€

Notas y pendientes:
  ⚠ PROPIETARIO: email no proporcionado. Asignar membresía desde
      /admin/restaurants/${restaurantId} → "Asignar dueño".
  ⚠ LOGO: no extraíble del PDF con calidad suficiente.
      Subir desde /panel/configuracion → "Logo y portada".
  ⚠ FOTOS PENDIENTES:
      · Tradicional con Chocoavellanas: sin foto (PDF usa imagen idéntica a
        "Tradicional con Ovomaltina"; se omitió para no confundir productos).
      · img-006.jpg descartada: imagen promocional con texto superpuesto
        "MIÉRCOLES DE PROMO VASCA FUDGY" — no apta como foto de catálogo.
  ⚠ NOMBRE POSIBLE ERRATA: "Choco Chunch" (posiblemente "Choco Crunch").
      Confirmar con el propietario antes de corregir.
  ⚠ SUBDOMINIO: goxo-valencia.wacatalogo.com funciona por código,
      pero requiere DNS * CNAME → f93otn7m.up.railway.app (pendiente según
      ESTADO.md). Sin esos registros DNS, el subdominio no resuelve en producción.
  ⚠ SUSCRIPCIÓN: no se asignó plan ni suscripción. El negocio opera en modo
      onboarding libre (sin restricción de pedidos, sin fecha de vencimiento).
      Configurar desde /admin/restaurants/${restaurantId} cuando corresponda.

Verificación:
  Local (dev):  http://localhost:3000/r/goxo-valencia
  Producción:   https://goxo-valencia.wacatalogo.com/ (pendiente DNS)

Próximos pasos:
  1. Revisar catálogo en http://localhost:3000/r/goxo-valencia
  2. Verificar responsive a 360/390/768/1440 px
  3. Comprobar que el botón WhatsApp abre conversación con ${BUSINESS_WA}
  4. Asignar dueño desde /admin/restaurants/${restaurantId}
  5. Subir logo desde /panel/configuracion
  6. Aportar foto para "Tradicional con Chocoavellanas"
  7. Confirmar nombre "Choco Chunch" con el propietario
  8. Confirmar registros DNS para goxo-valencia.wacatalogo.com
`);

  // ── Manifiesto JSON ───────────────────────────────────────────────────────
  const manifest = {
    generated_at: new Date().toISOString(),
    business: {
      name: "Goxo Valencia",
      slug: SLUG,
      restaurant_id: restaurantId,
      currency: "EUR",
      timezone: "Europe/Madrid",
      whatsapp: BUSINESS_WA,
      instagram: "https://www.instagram.com/goxovalencia/",
      catalog_url_local: `http://localhost:3000/r/${SLUG}`,
      catalog_url_prod: `https://${SLUG}.wacatalogo.com/`,
    },
    categories: Object.keys(CATEGORY_ORDER),
    products: PRODUCTS.map(p => ({
      name:        p.name,
      category:    p.category,
      price_eur:   p.price_eur,
      images:      p.images.map(i => i.file),
      variants:    p.variants?.map(v => `${v.name}: ${v.price_eur}€`) ?? [],
      options:     p.option_groups?.flatMap(g => g.options.map(o => `${o.name} +${o.price_delta_eur}€`)) ?? [],
      product_id:  productIds[p.name] ?? null,
    })),
    pending: [
      "Propietario: email no conocido — membresía pendiente",
      "Logo: no extraíble del PDF — subir manualmente",
      "Foto: Tradicional con Chocoavellanas — sin foto única en PDF",
      "Errata: 'Choco Chunch' (posible errata por 'Choco Crunch') — confirmar con propietario",
      "DNS: * CNAME f93otn7m.up.railway.app pendiente para goxo-valencia.wacatalogo.com",
      "Suscripción: sin plan asignado (modo onboarding libre)",
      "Horarios: no disponibles en el PDF — configurar desde panel",
    ],
    observations: {
      img_006_descartada: "img-006.jpg es imagen promocional con texto superpuesto 'MIÉRCOLES DE PROMO VASCA FUDGY' — no apta como foto de catálogo",
      img_013_duplicada:  "img-013.jpg es físicamente idéntica a img-010.jpg; el PDF incrusta la misma imagen para Ovomaltina y Chocoavellanas",
      productos_18:       "El brief menciona 18 'productos principales'. Se implementan 17 productos: las 2 tartas con variantes de tamaño (Tarta Vasca Tradicional y Vasca Fudgy) se consolidan como 1 producto con 2 variantes cada una, en lugar de 2 productos separados. Los 8 price-points de Tartas Enteras se representan en 6 productos.",
    },
  };

  const manifestPath = "docs/goxo-import-manifest.json";
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  ok(`Manifiesto guardado: ${manifestPath}`);
}

main().catch(e => { console.error(e); process.exit(1); });
