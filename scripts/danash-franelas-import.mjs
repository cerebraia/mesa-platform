/**
 * Danash Shop — Franelas lote 1 (productos 16–34), importación idempotente
 *
 * Ejecutar desde la raíz del proyecto:
 *   node --env-file=.env.local scripts/danash-franelas-import.mjs
 *   node --env-file=.env.local scripts/danash-franelas-import.mjs --dry-run
 *
 * Negocio  : Danash Shop (slug: danash-shop)
 * Lote     : franelas-1 (IDs externos 16–34)
 * Categoría: Franelas (se crea si no existe)
 * Estado   : BORRADOR — moneda y tallas POR_CONFIRMAR
 * Precio   : referencia 25 (2500 cents) — no publicar hasta confirmar moneda
 *
 * Idempotente:
 *   - Productos nuevos → upsert_product_admin (respeta límite atómico del plan).
 *   - Productos existentes → UPDATE directo que preserva variantes, opciones e imágenes
 *     ya configuradas manualmente.
 *   - Imágenes → se omite si ya existe al menos una imagen para el producto.
 *   - Re-ejecutar no duplica productos, categorías ni imágenes.
 *
 * Clave estable: ds-f<id-externo> — identifica cada modelo en este negocio y lote.
 * El mapa stableKey → productId queda en docs/danash-franelas-import-manifest.json.
 */

import { createClient }          from '@supabase/supabase-js';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join, dirname }          from 'path';
import { fileURLToPath }          from 'url';

// ── Flags ─────────────────────────────────────────────────────────────────────

const DRY_RUN = process.argv.includes('--dry-run');

// ── Env ───────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// ── Environment check ─────────────────────────────────────────────────────────

log('\n╔══ Danash Shop — Franelas lote 1 (16–34) ══╗\n');
log(`⚠  Base de datos : ${SUPABASE_URL}`);
if (DRY_RUN) {
  log('   Modo         : DRY-RUN (sin escrituras)\n');
} else {
  log('   Modo         : ESCRITURA REAL');
  log('   Tienes 5 segundos para cancelar con Ctrl+C...\n');
  await new Promise(r => setTimeout(r, 5000));
}

const svc = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Configuración ─────────────────────────────────────────────────────────────

const RESTAURANT_SLUG = 'danash-shop';
const LOTE            = 'franelas-1';
const IMAGES_DIR      = '/Users/fernandao2307/Documents/Catalogos/2.danashshop_ve/Imagenes/danash-franelas-parte-1';

// Moneda y tallas POR_CONFIRMAR → todos en borrador
const IS_PUBLISHED    = false;
const BASE_PRICE_CENTS = 2500;   // referencia $25 — no confirmar precio antes de publicar

// ── Productos ─────────────────────────────────────────────────────────────────
//
// Nombres comerciales derivados de los archivos fuente.
// stableKey: ds-f<id-externo> — estable dentro de Danash Shop / lote franelas-1.
// base_price_cents: referencia $25; moneda POR_CONFIRMAR → is_published: false.
// image_fit: 'contain' — sin recortes, prendas completas (1080×1300 px).

const PRODUCTS = [
  { extId: 16, stableKey: 'ds-f16', name: 'Franela Love Is a Temple',       file: '16-franela-love-is-a-temple.jpg' },
  { extId: 17, stableKey: 'ds-f17', name: 'Franela Runway Botas Leopardo',  file: '17-franela-runway-botas-leopardo.jpg' },
  { extId: 18, stableKey: 'ds-f18', name: 'Franela I See You Ojos',         file: '18-franela-i-see-you-ojos.jpg' },
  { extId: 19, stableKey: 'ds-f19', name: 'Franela Gris Flores Blancas',    file: '19-franela-gris-flores-blancas.jpg' },
  { extId: 20, stableKey: 'ds-f20', name: 'Franela Amor Cuello V',          file: '20-franela-amor-cuello-v.jpg' },
  { extId: 21, stableKey: 'ds-f21', name: 'Franela Roja Corazón',           file: '21-franela-roja-corazon.jpg' },
  { extId: 22, stableKey: 'ds-f22', name: 'Franela La Dolce Vita',          file: '22-franela-la-dolce-vita.jpg' },
  { extId: 23, stableKey: 'ds-f23', name: 'Franela Tigre Rojo',             file: '23-franela-tigre-rojo.jpg' },
  { extId: 24, stableKey: 'ds-f24', name: 'Franela Hongos con Perlas',      file: '24-franela-hongos-perlas.jpg' },
  { extId: 25, stableKey: 'ds-f25', name: 'Franela Azul Tigre Rosa',        file: '25-franela-azul-tigre-rosa.jpg' },
  { extId: 26, stableKey: 'ds-f26', name: 'Franela I Dog You',              file: '26-franela-i-dog-you.jpg' },
  { extId: 27, stableKey: 'ds-f27', name: 'Franela Jaguar Multicolor',      file: '27-franela-jaguar-multicolor.jpg' },
  { extId: 28, stableKey: 'ds-f28', name: 'Franela Flores Amore Passione',  file: '28-franela-flores-amore-passione.jpg' },
  { extId: 29, stableKey: 'ds-f29', name: 'Franela Leopardo Sombrilla',     file: '29-franela-leopardo-sombrilla.jpg' },
  { extId: 30, stableKey: 'ds-f30', name: 'Franela Wishes Come True',       file: '30-franela-wishes-come-true.jpg' },
  { extId: 31, stableKey: 'ds-f31', name: 'Franela East Coast',             file: '31-franela-east-coast.jpg' },
  { extId: 32, stableKey: 'ds-f32', name: 'Franela Apliques Dorados',       file: '32-franela-apliques-dorados.jpg' },
  { extId: 33, stableKey: 'ds-f33', name: 'Franela Negra Ojo Dorado',       file: '33-franela-negra-ojo-dorado.jpg' },
  { extId: 34, stableKey: 'ds-f34', name: 'Franela Gris Gato Naranja',      file: '34-franela-gris-gato-naranja.jpg' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function log(msg)  { process.stdout.write(msg + '\n'); }
function ok(msg)   { log(`  ✅ ${msg}`); }
function warn(msg) { log(`  ⚠️  ${msg}`); }
function err(msg)  { log(`  ❌ ${msg}`); }
function skip(msg) { log(`  ⏭  ${msg}`); }
function info(msg) { log(`  ·  ${msg}`); }

async function uploadFile(bucket, storagePath, localPath, contentType) {
  if (DRY_RUN) { info(`[dry-run] upload ${storagePath}`); return storagePath; }
  const data = readFileSync(localPath);
  const { error } = await svc.storage.from(bucket).upload(storagePath, data, {
    contentType, upsert: true,
  });
  if (error) throw new Error(`Upload ${storagePath}: ${error.message}`);
  return storagePath;
}

// Idempotent image insert:
//   · Returns existing image ID if product already has at least one image.
//   · Uploads and registers a new image otherwise.
async function ensureProductImage(productId, restaurantId, p) {
  const { data: existing } = await svc.from('product_images')
    .select('id, storage_path')
    .eq('product_id', productId)
    .eq('restaurant_id', restaurantId);

  if (existing && existing.length > 0) {
    skip(`  Imagen ya registrada para "${p.name}" — se omite`);
    return existing[0].id;
  }

  const localPath = join(IMAGES_DIR, p.file);
  if (!existsSync(localPath)) {
    warn(`  Imagen no encontrada: ${localPath}`);
    return null;
  }

  const ts          = Date.now();
  const storagePath = `${restaurantId}/${productId}/${ts}_${p.stableKey}.jpg`;

  try {
    await uploadFile('product-images', storagePath, localPath, 'image/jpeg');
  } catch (e) {
    err(`  ${e.message}`);
    return null;
  }

  if (!DRY_RUN) {
    const { error } = await svc.from('product_images').insert({
      product_id:     productId,
      restaurant_id:  restaurantId,
      storage_path:   storagePath,
      thumbnail_path: null,
      alt_text:       p.name,
      position:       0,
    });
    if (error) { err(`  product_images: ${error.message}`); return null; }
  }
  ok(`  Imagen: ${storagePath}`);
  return storagePath;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {

  // ── 1. Verificar restaurante ───────────────────────────────────────────────
  log('1. Verificando negocio Danash Shop...');
  const { data: restaurant } = await svc.from('restaurants')
    .select('id, name, slug, status, currency')
    .eq('slug', RESTAURANT_SLUG)
    .is('deleted_at', null)
    .maybeSingle();

  if (!restaurant) {
    err(`No se encontró negocio con slug "${RESTAURANT_SLUG}". Ejecuta primero danash-shop-import.mjs.`);
    process.exit(1);
  }
  if (restaurant.status !== 'active') {
    err(`Negocio "${restaurant.name}" está en estado "${restaurant.status}" — no se puede importar.`);
    process.exit(1);
  }

  const restaurantId = restaurant.id;
  ok(`Negocio: ${restaurant.name} (ID: ${restaurantId}) · moneda: ${restaurant.currency}`);

  // ── 2. Verificar suscripción y límite de plan ─────────────────────────────
  log('2. Verificando plan y límite...');
  const { data: sub } = await svc.from('subscriptions')
    .select('id, status, plans(name, max_products)')
    .eq('restaurant_id', restaurantId)
    .eq('status', 'active')
    .maybeSingle();

  if (!sub) {
    warn('Sin suscripción activa — el plan libre puede tener límites reducidos.');
  } else {
    const maxP = sub.plans?.max_products;
    const { count: currCount } = await svc.from('products')
      .select('*', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId).is('deleted_at', null);

    // Count only genuinely new products (not already in DB) to avoid false limit violations
    const { data: existingNames } = await svc.from('products')
      .select('name').eq('restaurant_id', restaurantId).is('deleted_at', null)
      .in('name', PRODUCTS.map(p => p.name));
    const existingSet = new Set((existingNames ?? []).map(r => r.name));
    const newCount    = PRODUCTS.filter(p => !existingSet.has(p.name)).length;

    const afterImport = (currCount ?? 0) + newCount;
    if (maxP && afterImport > maxP) {
      err(`Límite del plan: ${maxP} productos · actuales: ${currCount} · nuevos en esta tanda: ${newCount} · total previsto: ${afterImport}. Supera el límite — ajusta el plan antes de continuar.`);
      process.exit(1);
    }
    ok(`Plan: ${sub.plans?.name} · ${currCount}/${maxP} · nuevos en esta tanda: +${newCount} → ${afterImport}/${maxP}`);
  }

  // ── 3. Categoría Franelas ──────────────────────────────────────────────────
  log('3. Categoría Franelas...');
  let franelasId;

  const { data: existingCat } = await svc.from('categories')
    .select('id, name, is_active')
    .eq('restaurant_id', restaurantId)
    .eq('name', 'Franelas')
    .maybeSingle();

  if (existingCat) {
    skip(`Categoría "Franelas" ya existe (${existingCat.id})`);
    franelasId = existingCat.id;
    if (!existingCat.is_active) {
      warn('La categoría "Franelas" está inactiva — reactiva desde el panel si es necesario.');
    }
  } else {
    // Position after existing categories (Suéteres:1, Cárdigans:2, Capas:3)
    const { data: maxRow } = await svc.from('categories')
      .select('position').eq('restaurant_id', restaurantId)
      .order('position', { ascending: false }).limit(1).maybeSingle();
    const position = (maxRow?.position ?? 3) + 1;

    if (!DRY_RUN) {
      const { data: cat, error } = await svc.from('categories').insert({
        restaurant_id: restaurantId,
        name:          'Franelas',
        position,
        is_active:     true,
      }).select('id').single();
      if (error) { err(`Categoría Franelas: ${error.message}`); process.exit(1); }
      ok(`Categoría "Franelas" creada (${cat.id}), position ${position}`);
      franelasId = cat.id;
    } else {
      info('[dry-run] INSERT categories name="Franelas"');
      franelasId = 'dry-run-franelas-cat';
    }
  }

  // ── 4. Productos + imágenes ────────────────────────────────────────────────
  log(`4. Productos (${PRODUCTS.length} franelas, todas en borrador)...`);
  const manifest = [];
  let newCount = 0, updatedCount = 0;

  for (const p of PRODUCTS) {
    // Idempotency: look up existing product by name in this restaurant
    const { data: existingP } = await svc.from('products')
      .select('id, name, is_published, base_price_cents')
      .eq('restaurant_id', restaurantId)
      .eq('name', p.name)
      .is('deleted_at', null)
      .maybeSingle();

    let productId;
    let wasNew = false;

    if (existingP) {
      // Product exists — update fields but PRESERVE variants, options, existing images
      if (!DRY_RUN) {
        const { error: upErr } = await svc.from('products').update({
          category_id:      franelasId,
          description:      null,
          base_price_cents: BASE_PRICE_CENTS,
          is_available:     true,
          image_fit:        'contain',
        }).eq('id', existingP.id).eq('restaurant_id', restaurantId);

        if (upErr) { err(`Update "${p.name}": ${upErr.message}`); continue; }
        warn(`"${p.name}" ya existe — actualizado (${existingP.id})`);
      } else {
        info(`[dry-run] UPDATE products name="${p.name}" (existente)`);
      }
      productId = existingP.id;
      updatedCount++;
    } else {
      // New product — use upsert_product_admin for plan limit enforcement
      wasNew = true;
      if (!DRY_RUN) {
        const { data: pid, error: rpcErr } = await svc.rpc('upsert_product_admin', {
          p_restaurant_id: restaurantId,
          p_product: {
            id:               null,
            category_id:      franelasId,
            name:             p.name,
            description:      null,
            base_price_cents: BASE_PRICE_CENTS,
            is_published:     IS_PUBLISHED,
            is_available:     true,
            image_fit:        'contain',
            position:         PRODUCTS.indexOf(p) + 1,
          },
          p_variants:      [],
          p_option_groups: [],
        });
        if (rpcErr) { err(`"${p.name}": ${rpcErr.message}`); continue; }
        productId = pid;
        ok(`"${p.name}": ${productId}`);
        newCount++;
      } else {
        const localPath = join(IMAGES_DIR, p.file);
        info(`[dry-run] upsert_product_admin name="${p.name}"`);
        info(`  imagen: ${existsSync(localPath) ? '✓ encontrada' : '✗ NO encontrada'} — ${localPath}`);
        productId = `dry-run-${p.stableKey}`;
        newCount++;
      }
    }

    // Image — idempotent: skip if product already has one
    const imgResult = await ensureProductImage(productId, restaurantId, p);

    manifest.push({
      extId:        p.extId,
      stableKey:    p.stableKey,
      name:         p.name,
      imageFile:    p.file,
      imageUploaded: imgResult !== null,
      productId,
      isNew:        wasNew,
      isPublished:  false,
      basePrice:    BASE_PRICE_CENTS,
      notes:        'Borrador — moneda y tallas pendientes de confirmar.',
    });
  }

  // ── 5. Verificar productos anteriores intactos ─────────────────────────────
  log('5. Verificando productos anteriores...');
  if (!DRY_RUN) {
    const { count: totalNow } = await svc.from('products')
      .select('*', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId).is('deleted_at', null);
    ok(`Total en BD: ${totalNow} productos (${newCount} creados en esta ejecución, ${updatedCount} actualizados)`);

    // Verify original categories still active
    const { data: cats } = await svc.from('categories')
      .select('name, is_active').eq('restaurant_id', restaurantId);
    const inactive = (cats ?? []).filter(c => !c.is_active);
    if (inactive.length > 0) {
      warn(`Categorías inactivas: ${inactive.map(c => c.name).join(', ')}`);
    } else {
      ok(`Todas las categorías activas (${cats?.length ?? 0})`);
    }
  }

  // ── 6. Resumen ─────────────────────────────────────────────────────────────
  log('\n╔══ RESUMEN FRANELAS LOTE 1 ══╗');
  log(`Negocio ID     : ${restaurantId}`);
  log(`Slug           : ${RESTAURANT_SLUG}`);
  log(`Lote           : ${LOTE} (IDs externos 16–34)`);
  log(`URL local      : http://localhost:3000/r/danash-shop`);
  log(`URL prevista   : https://danash-shop.wacatalogo.com/`);
  log(`Fichas creadas : ${newCount}`);
  log(`Fichas exist.  : ${updatedCount}`);
  log(`Publicadas     : 0 (todas en borrador — moneda y tallas POR_CONFIRMAR)`);

  log('\nTabla de fichas:');
  log('  Ext'.padEnd(8) + 'Clave'.padEnd(10) + 'Nombre'.padEnd(38) + 'Img  Estado');
  log('  ' + '─'.repeat(72));
  for (const m of manifest) {
    const img    = m.imageUploaded ? '✓' : '✗';
    const estado = m.isNew ? 'NUEVA' : 'actualiz.';
    log(`  ${String(m.extId).padEnd(6)} ${m.stableKey.padEnd(8)} ${m.name.padEnd(36)} ${img}    ${estado}`);
  }

  // Validation: 19 unique records, IDs 16–34
  const extIds = manifest.map(m => m.extId).sort((a, b) => a - b);
  const expected = Array.from({ length: 19 }, (_, i) => i + 16);
  const allPresent = JSON.stringify(extIds) === JSON.stringify(expected);
  const allUnique  = new Set(extIds).size === extIds.length;
  log(`\nValidación: ${manifest.length} registros · IDs 16–34: ${allPresent ? '✓' : '✗'} · únicos: ${allUnique ? '✓' : '✗'}`);

  log('\n⚠️  PENDIENTES:');
  log('  1. MONEDA de venta y TALLAS — confirmar con propietaria para publicar estas fichas.');
  log('  2. Los 15 productos anteriores (suéteres, cárdigans, capas) siguen sin moneda confirmada.');
  log('  3. Logo de Danash Shop — pendiente de aportarlo para subir.');
  log('  4. Cuenta propietaria Danash.hidalgo@gmail.com — vincular en /admin.');

  log('\n✅ Importación de franelas completada.');
  log(`   Verifica en http://localhost:3000/r/danash-shop\n`);

  // ── 7. Manifest JSON ───────────────────────────────────────────────────────
  if (!DRY_RUN) {
    const __dir  = dirname(fileURLToPath(import.meta.url));
    const mPath  = join(__dir, '..', 'docs', 'danash-franelas-import-manifest.json');
    const mData  = {
      negocio:        'Danash Shop',
      slug:           RESTAURANT_SLUG,
      restaurantId,
      lote:           LOTE,
      importado:      new Date().toISOString().slice(0, 10),
      imagenesDir:    IMAGES_DIR,
      precioCents:    BASE_PRICE_CENTS,
      moneda:         'POR_CONFIRMAR',
      tallas:         'POR_CONFIRMAR',
      productosTotales: manifest.length,
      nuevos:         newCount,
      actualizados:   updatedCount,
      publicados:     0,
      borradores:     manifest.length,
      validacion: {
        registrosUnicos:  allUnique,
        rango16a34:       allPresent,
        imagenesEncontradas: manifest.filter(m => m.imageUploaded).length,
        imagenesFaltantes:   manifest.filter(m => !m.imageUploaded).map(m => m.imageFile),
      },
      fichas: manifest.map(m => ({
        extId:       m.extId,
        stableKey:   m.stableKey,
        nombre:      m.name,
        imagenFile:  m.imageFile,
        imagenSubida: m.imageUploaded,
        publicado:   false,
        basePrice:   m.basePrice,
        productId:   m.productId,
        isNew:       m.isNew,
      })),
    };
    writeFileSync(mPath, JSON.stringify(mData, null, 2));
    ok(`Manifiesto guardado: docs/danash-franelas-import-manifest.json`);
  }
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
