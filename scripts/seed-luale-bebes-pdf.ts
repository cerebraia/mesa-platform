/**
 * seed-luale-bebes-pdf.ts
 *
 * Importa los 3 productos nuevos identificados en el catálogo PDF de Bebés
 * que no tienen equivalente confirmado en el catálogo existente:
 *   - Pantalones Jogger con Lazo (p12)
 *   - Enterizos Cremallera Lisos (p13)
 *   - Leggings Canalé 6-9m (p21)
 *
 * Idempotente: detecta por nombre + restaurant_id si ya existe el producto.
 * Sube imágenes solo si el producto se crea nuevo o no tiene imagen.
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

// ── env ──────────────────────────────────────────────────────────────────────
const envContent = fs.existsSync(".env.local")
  ? fs.readFileSync(".env.local", "utf-8")
  : "";
for (const line of envContent.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.+)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

// ── constantes ────────────────────────────────────────────────────────────────
const LUALE_ID = "b0365f95-dabf-42f5-b4b2-578a7954a6ca";
const BEBES_CAT_ID = "82a40d62-3f5d-4506-806a-4ef4bbc1b098";
const IMG_DIR = "/tmp/luale-import";

const PRODUCTS: {
  name: string;
  description: string;
  pdfPage: number;
  imgFile: string;
  thumbFile: string;
  originKey: string;  // stable reference for idempotency
}[] = [
  {
    name: "Pantalones Jogger con Lazo",
    description:
      "Pantalones jogger en colores sólidos con lazo blanco decorativo. " +
      "Disponibles en 5 colores: negro, azul marino, grafito, azul y gris. " +
      "Tallas: 3-6 y 6-9 meses. Consultar disponibilidad por WhatsApp.",
    pdfPage: 12,
    imgFile: "bebes-p12-joggers-lazo.png",
    thumbFile: "bebes-p12-joggers-lazo-thumb.png",
    originKey: "luale-pdf-bebes-p12-2026-10",
  },
  {
    name: "Enterizos Cremallera Lisos",
    description:
      "Enterizos de manga larga con cremallera frontal en colores lisos. " +
      "Disponibles en gris, verde y beige. " +
      "Talla: 6-9 meses. Consultar disponibilidad por WhatsApp.",
    pdfPage: 13,
    imgFile: "bebes-p13-enterizos-cremallera.png",
    thumbFile: "bebes-p13-enterizos-cremallera-thumb.png",
    originKey: "luale-pdf-bebes-p13-2026-10",
  },
  {
    name: "Leggings Canalé Colores",
    description:
      "Leggings de punto canalé en 5 colores: negro, blanco, gris topo, salmón y rosa. " +
      "Talla: 6-9 meses. Consultar disponibilidad por WhatsApp.",
    pdfPage: 21,
    imgFile: "bebes-p21-leggings-canale-6-9m.png",
    thumbFile: "bebes-p21-leggings-canale-6-9m-thumb.png",
    originKey: "luale-pdf-bebes-p21-2026-10",
  },
];

async function uploadImage(
  productId: string,
  localPath: string,
  mimeType = "image/png"
): Promise<string | null> {
  const buf = fs.readFileSync(localPath);
  const ext = path.extname(localPath).slice(1);
  const ts = Date.now();
  const storagePath = `${LUALE_ID}/${productId}/${ts}.${ext}`;

  const { error } = await sb.storage
    .from("product-images")
    .upload(storagePath, buf, { contentType: mimeType, upsert: false });

  if (error) {
    console.error("  Storage upload error:", error.message);
    return null;
  }
  return storagePath;
}

async function main() {
  console.log("=== Importación PDF Bebés — Luale Shop ===\n");

  const results: {
    originKey: string;
    pdfPage: number;
    name: string;
    productId: string | null;
    action: "created" | "skipped_existing" | "error";
    imagePath: string | null;
    thumbnailPath: string | null;
    reason?: string;
  }[] = [];

  for (const prod of PRODUCTS) {
    console.log(`\n▶ Página ${prod.pdfPage}: ${prod.name}`);

    // 1. Idempotency: check if product already exists by name
    const { data: existing } = await sb
      .from("products")
      .select("id, name, is_published, base_price_cents")
      .eq("restaurant_id", LUALE_ID)
      .eq("name", prod.name)
      .limit(1);

    if (existing && existing.length > 0) {
      console.log(`  → Ya existe (id=${existing[0].id.slice(0,8)}). Omitiendo.`);
      results.push({
        ...prod,
        productId: existing[0].id,
        action: "skipped_existing",
        imagePath: null,
        thumbnailPath: null,
        reason: "Producto ya registrado con este nombre",
      });
      continue;
    }

    // 2. Create product draft (null price, not published)
    const { data: newProd, error: errProd } = await sb
      .from("products")
      .insert({
        restaurant_id: LUALE_ID,
        category_id: BEBES_CAT_ID,
        name: prod.name,
        description: prod.description,
        base_price_cents: null,
        is_published: false,
        is_available: true,
        image_fit: "contain",
      })
      .select("id")
      .single();

    if (errProd || !newProd) {
      console.error("  Error creando producto:", errProd?.message);
      results.push({
        ...prod,
        productId: null,
        action: "error",
        imagePath: null,
        thumbnailPath: null,
        reason: errProd?.message,
      });
      continue;
    }

    const productId = newProd.id;
    console.log(`  ✓ Producto creado: ${productId.slice(0, 8)}`);

    // 3. Upload original image
    const imgLocalPath = path.join(IMG_DIR, prod.imgFile);
    const thumbLocalPath = path.join(IMG_DIR, prod.thumbFile);

    let imagePath: string | null = null;
    let thumbnailPath: string | null = null;

    if (fs.existsSync(imgLocalPath)) {
      console.log(`  ↑ Subiendo imagen original...`);
      imagePath = await uploadImage(productId, imgLocalPath);
      if (imagePath) console.log(`    → ${imagePath}`);
    } else {
      console.warn(`  ⚠ No encontrado: ${imgLocalPath}`);
    }

    if (fs.existsSync(thumbLocalPath)) {
      console.log(`  ↑ Subiendo miniatura...`);
      thumbnailPath = await uploadImage(productId, thumbLocalPath);
      if (thumbnailPath) console.log(`    → ${thumbnailPath}`);
    }

    // 4. Create product_images record
    if (imagePath) {
      const { error: errImg } = await sb.from("product_images").insert({
        product_id: productId,
        restaurant_id: LUALE_ID,
        storage_path: imagePath,
        thumbnail_path: thumbnailPath,
        alt_text: prod.name,
        position: 0,
      });
      if (errImg) console.error("  Error en product_images:", errImg.message);
      else console.log(`  ✓ Imagen registrada en product_images`);
    }

    results.push({
      ...prod,
      productId,
      action: "created",
      imagePath,
      thumbnailPath,
    });
  }

  // ── Resumen ───────────────────────────────────────────────────────────────
  console.log("\n=== RESUMEN ===");
  const created = results.filter(r => r.action === "created");
  const skipped = results.filter(r => r.action === "skipped_existing");
  const errors = results.filter(r => r.action === "error");
  console.log(`Creados: ${created.length}`);
  console.log(`Ya existían: ${skipped.length}`);
  console.log(`Errores: ${errors.length}`);
  if (errors.length) {
    for (const e of errors) console.log(`  ✗ ${e.name}: ${e.reason}`);
  }

  return results;
}

main().then(async (results) => {
  // Verify products exist in Supabase
  console.log("\n=== VERIFICACIÓN ===");
  const { data: verify } = await sb
    .from("products")
    .select("id, name, is_published, base_price_cents")
    .eq("restaurant_id", LUALE_ID)
    .in("name", PRODUCTS.map(p => p.name));

  for (const v of (verify || [])) {
    console.log(`  ✓ ${v.name} | pub=${v.is_published} | price=${v.base_price_cents ?? "NULL (borrador)"}`);
  }

  // Verify no changes to other restaurants
  const { count: otherCount } = await sb
    .from("products")
    .select("id", { count: "exact", head: true })
    .neq("restaurant_id", LUALE_ID);
  console.log(`\n  Productos en otros negocios: ${otherCount} (sin cambios esperados)`);
}).catch(console.error);
