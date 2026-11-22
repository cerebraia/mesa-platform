/**
 * Danash Shop — Camisas (lotes 03–04) y Suéteres/Sudaderas (lote 05)
 *
 * Ejecutar:
 *   node --env-file=.env.local scripts/danash-camisas-sueteres-import.mjs
 *   node --env-file=.env.local scripts/danash-camisas-sueteres-import.mjs --dry-run
 *
 * Negocio  : Danash Shop (slug: danash-shop)
 * Lote 03  : refs 35–42 (8 camisas); tallas S/M para 35,36,37,39,41; sin tallas para 38,40,42
 * Lote 04  : refs 35,36,37,39,41 (vistas frente adicionales) + refs 43–48 (6 camisas nuevas, S/M)
 * Lote 05  : refs 49–54 (6 suéteres/sudaderas, talla única)
 * Precio   : US$1.00 de referencia (100 cents); moneda USD
 * Estado   : publicado (is_published=true)
 * Descripción: "Precio de referencia. Consulta el precio final por WhatsApp."
 *
 * Idempotente: re-ejecutar no duplica productos, variantes, categorías ni imágenes.
 * Detecta coincidencias refs 35,36,37,39,41 entre lote03 y lote04; agrega imagen frente
 * a la ficha existente si el producto ya existe.
 */

import { createClient }          from '@supabase/supabase-js';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join, dirname }          from 'path';
import { fileURLToPath }          from 'url';

const DRY_RUN = process.argv.includes('--dry-run');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) { console.error('❌ Faltan env vars'); process.exit(1); }

log('\n╔══ Danash Shop — Camisas lotes 03–04 + Suéteres lote 05 ══╗\n');
log(`⚠  Base de datos : ${SUPABASE_URL}`);
if (DRY_RUN) { log('   Modo: DRY-RUN\n'); }
else         { log('   Modo: ESCRITURA REAL — 5 s para cancelar...\n'); await new Promise(r => setTimeout(r, 5000)); }

const svc = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

// ── Rutas ─────────────────────────────────────────────────────────────────────

const DIR_L03 = '/Users/fernandao2307/Documents/Catalogos/2.danashshop_ve/Imagenes/3';
const DIR_L04 = '/Users/fernandao2307/Documents/Catalogos/2.danashshop_ve/Imagenes/4';

// ── Constantes ────────────────────────────────────────────────────────────────

const RESTAURANT_SLUG = 'danash-shop';
const PRICE_CENTS     = 100;    // US$1.00 referencia
const IS_PUBLISHED    = true;
const REF_DESC        = 'Precio de referencia. Consulta el precio final por WhatsApp.';
const VARIANTS_SM     = [
  { name: 'S',  price_cents: PRICE_CENTS, is_available: true, position: 0 },
  { name: 'M',  price_cents: PRICE_CENTS, is_available: true, position: 1 },
];

// ── Definición de productos ───────────────────────────────────────────────────
//
// images: array de { file, dir, position } en orden galería (frente, espalda, modelo)
// variants: null = sin variantes (talla única o tallas pendientes); array = tallas confirmadas
// base_price_cents: null cuando hay variantes; PRICE_CENTS cuando no las hay

const CAMISAS = [
  // ── Lote 03 + 04 (coincidencias con vista frente adicional) ──────────────────
  {
    stableKey: 'ds-c35', ref: 35, name: 'Camisa Blanca Corazones Anatómicos',
    category: 'Camisas', variants: VARIANTS_SM, base_price_cents: null,
    images: [
      { file: '35-camisa-corazones-anatomicos-frente.jpg',           dir: DIR_L04, position: 0 },
      { file: '35-camisa-blanca-corazones-anatomicos-doblada.jpg',   dir: DIR_L03, position: 1 },
    ],
  },
  {
    stableKey: 'ds-c36', ref: 36, name: 'Camisa Rayas Lila Corazón',
    category: 'Camisas', variants: VARIANTS_SM, base_price_cents: null,
    images: [
      { file: '36-camisa-rayas-lila-corazon-frente.jpg',  dir: DIR_L04, position: 0 },
      { file: '36-camisa-rayas-lila-corazon-rojo.jpg',    dir: DIR_L03, position: 1 },
    ],
  },
  {
    stableKey: 'ds-c37', ref: 37, name: 'Camisa Blanca Arcoíris',
    category: 'Camisas', variants: VARIANTS_SM, base_price_cents: null,
    images: [
      { file: '37-camisa-arcoiris-frente.jpg',    dir: DIR_L04, position: 0 },
      { file: '37-camisa-blanca-arcoiris.jpg',    dir: DIR_L03, position: 1 },
    ],
  },
  // ── Lote 03 solo (sin vista frente confirmada, sin tallas) ───────────────────
  {
    stableKey: 'ds-c38', ref: 38, name: 'Camisa Blanca Lisa Cuello Abierto',
    category: 'Camisas', variants: null, base_price_cents: PRICE_CENTS,
    images: [
      { file: '38-camisa-blanca-lisa-cuello-abierto.jpg', dir: DIR_L03, position: 0 },
    ],
  },
  {
    stableKey: 'ds-c39', ref: 39, name: 'Camisa Rayas Rojas Corazón Azul',
    category: 'Camisas', variants: VARIANTS_SM, base_price_cents: null,
    images: [
      { file: '39-camisa-rayas-rojas-corazon-azul-frente.jpg',    dir: DIR_L04, position: 0 },
      { file: '39-camisa-rayas-rojas-corazon-azul-doblada.jpg',   dir: DIR_L03, position: 1 },
    ],
  },
  {
    stableKey: 'ds-c40', ref: 40, name: 'Camisa Bicolor Constelaciones',
    category: 'Camisas', variants: null, base_price_cents: PRICE_CENTS,
    images: [
      { file: '40-camisa-bicolor-constelaciones.jpg', dir: DIR_L03, position: 0 },
    ],
  },
  {
    stableKey: 'ds-c41', ref: 41, name: 'Camisa Blanca Corazones Colores',
    category: 'Camisas', variants: VARIANTS_SM, base_price_cents: null,
    images: [
      { file: '41-camisa-corazones-colores-frente.jpg',    dir: DIR_L04, position: 0 },
      { file: '41-camisa-blanca-corazones-colores.jpg',    dir: DIR_L03, position: 1 },
    ],
  },
  {
    stableKey: 'ds-c42', ref: 42, name: 'Camisa Blanca Estrellas Doradas',
    category: 'Camisas', variants: null, base_price_cents: PRICE_CENTS,
    images: [
      { file: '42-camisa-blanca-estrellas-doradas.jpg', dir: DIR_L03, position: 0 },
    ],
  },
  // ── Lote 04 nuevos (refs 43–48) ──────────────────────────────────────────────
  {
    stableKey: 'ds-c43', ref: 43, name: 'Camisa Azul AMORE',
    category: 'Camisas', variants: VARIANTS_SM, base_price_cents: null,
    images: [
      { file: '43-camisa-azul-amore-frente.jpg',   dir: DIR_L04, position: 0 },
      { file: '43-camisa-azul-amore-espalda.jpg',  dir: DIR_L04, position: 1 },
    ],
  },
  {
    stableKey: 'ds-c44', ref: 44, name: 'Camisa Blanca Corazón Dorado',
    category: 'Camisas', variants: VARIANTS_SM, base_price_cents: null,
    images: [
      { file: '44-camisa-corazon-dorado-frente.jpg',  dir: DIR_L04, position: 0 },
      { file: '44-camisa-corazon-dorado-espalda.jpg', dir: DIR_L04, position: 1 },
    ],
  },
  {
    stableKey: 'ds-c45', ref: 45, name: 'Camisa Blanca Cangrejos',
    category: 'Camisas', variants: VARIANTS_SM, base_price_cents: null,
    images: [
      { file: '45-camisa-blanca-cangrejos-frente.jpg', dir: DIR_L04, position: 0 },
    ],
  },
  {
    stableKey: 'ds-c46', ref: 46, name: 'Camisa Bicolor Menta y Lila',
    category: 'Camisas', variants: VARIANTS_SM, base_price_cents: null,
    images: [
      { file: '46-camisa-bicolor-menta-lila-frente.jpg', dir: DIR_L04, position: 0 },
    ],
  },
  {
    stableKey: 'ds-c47', ref: 47, name: 'Camisa Bicolor Ojos',
    category: 'Camisas', variants: VARIANTS_SM, base_price_cents: null,
    images: [
      { file: '47-camisa-bicolor-ojos-frente.jpg', dir: DIR_L04, position: 0 },
    ],
  },
  {
    stableKey: 'ds-c48', ref: 48, name: 'Camisa Rayas Rojas Doble Bolsillo',
    category: 'Camisas', variants: VARIANTS_SM, base_price_cents: null,
    images: [
      { file: '48-camisa-rayas-rojas-doble-bolsillo-frente.jpg', dir: DIR_L04, position: 0 },
    ],
  },
];

const SUETERES = [
  // ── Lote 05 (talla única, sin variantes) ─────────────────────────────────────
  {
    stableKey: 'ds-s49', ref: 49, name: 'Sudadera Roja Corazón',
    category: 'Suéteres', variants: null, base_price_cents: PRICE_CENTS,
    images: [{ file: '49-sudadera-roja-corazon.jpg', dir: DIR_L04, position: 0 }],
  },
  {
    stableKey: 'ds-s50', ref: 50, name: 'Suéter Turquesa Felino',
    category: 'Suéteres', variants: null, base_price_cents: PRICE_CENTS,
    images: [
      { file: '50-sueter-turquesa-felino.jpg',       dir: DIR_L04, position: 0 },
      { file: '50-sueter-turquesa-felino-modelo.jpg', dir: DIR_L04, position: 1 },
    ],
  },
  {
    stableKey: 'ds-s51', ref: 51, name: 'Suéter Bloques de Colores',
    category: 'Suéteres', variants: null, base_price_cents: PRICE_CENTS,
    images: [{ file: '51-sueter-bloques-colores.jpg', dir: DIR_L04, position: 0 }],
  },
  {
    stableKey: 'ds-s52', ref: 52, name: 'Suéter Corazones y Estrellas',
    category: 'Suéteres', variants: null, base_price_cents: PRICE_CENTS,
    images: [{ file: '52-sueter-corazones-estrellas.jpg', dir: DIR_L04, position: 0 }],
  },
  {
    stableKey: 'ds-s53', ref: 53, name: 'Sudadera Verde LOVE',
    category: 'Suéteres', variants: null, base_price_cents: PRICE_CENTS,
    images: [{ file: '53-sudadera-verde-love.jpg', dir: DIR_L04, position: 0 }],
  },
  {
    stableKey: 'ds-s54', ref: 54, name: 'Suéter Turquesa Cítrico',
    category: 'Suéteres', variants: null, base_price_cents: PRICE_CENTS,
    images: [{ file: '54-sueter-turquesa-citrico-modelo.jpg', dir: DIR_L04, position: 0 }],
  },
];

const ALL_PRODUCTS = [...CAMISAS, ...SUETERES];

// ── Helpers ───────────────────────────────────────────────────────────────────

function log(m)  { process.stdout.write(m + '\n'); }
function ok(m)   { log(`  ✅ ${m}`); }
function warn(m) { log(`  ⚠️  ${m}`); }
function err(m)  { log(`  ❌ ${m}`); }
function skip(m) { log(`  ⏭  ${m}`); }
function info(m) { log(`  ·  ${m}`); }

async function uploadFile(bucket, storagePath, localPath, contentType) {
  if (DRY_RUN) { info(`[dry-run] upload ${storagePath}`); return storagePath; }
  const data = readFileSync(localPath);
  const { error } = await svc.storage.from(bucket).upload(storagePath, data, { contentType, upsert: true });
  if (error) throw new Error(`Upload ${storagePath}: ${error.message}`);
  return storagePath;
}

// Idempotent: skip if a product_images row for this product already has this filename in its storage_path
async function ensureImage(productId, restaurantId, imgDef) {
  const localPath = join(imgDef.dir, imgDef.file);
  if (!existsSync(localPath)) { warn(`  Imagen no encontrada: ${imgDef.file}`); return null; }

  const { data: existing } = await svc.from('product_images')
    .select('id, storage_path').eq('product_id', productId).eq('restaurant_id', restaurantId);

  const sanitized = imgDef.file.replace(/\s+/g, '_');
  const alreadyUploaded = (existing ?? []).some(i =>
    i.storage_path.includes(`_${sanitized}`) || i.storage_path.includes(`/${sanitized}`),
  );
  if (alreadyUploaded) { skip(`  Ya existe: ${imgDef.file}`); return null; }

  const ts          = Date.now();
  const storagePath = `${restaurantId}/${productId}/${ts}_${sanitized}`;

  if (!DRY_RUN) {
    try { await uploadFile('product-images', storagePath, localPath, 'image/jpeg'); }
    catch (e) { err(`  ${e.message}`); return null; }
    const positionActual = imgDef.position ?? (existing?.length ?? 0);
    const { error } = await svc.from('product_images').insert({
      product_id: productId, restaurant_id: restaurantId,
      storage_path: storagePath, thumbnail_path: null,
      alt_text: imgDef.file.replace(/\.jpg$/, '').replace(/-/g, ' '),
      position: positionActual,
    });
    if (error) { err(`  product_images: ${error.message}`); return null; }
  }
  ok(`  Imagen: ${imgDef.file} → pos ${imgDef.position ?? '?'}`);
  return storagePath;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {

  // 1. Verify restaurant
  log('1. Restaurante...');
  const { data: restaurant } = await svc.from('restaurants')
    .select('id,name,slug,status,currency').eq('slug', RESTAURANT_SLUG).is('deleted_at',null).maybeSingle();
  if (!restaurant || restaurant.status !== 'active') {
    err('Negocio no encontrado o inactivo'); process.exit(1);
  }
  const rid = restaurant.id;
  ok(`${restaurant.name} (${rid}) · moneda: ${restaurant.currency}`);

  // 2. Plan limit check
  log('2. Límite del plan...');
  const { data: sub } = await svc.from('subscriptions')
    .select('id,plans(name,max_products)').eq('restaurant_id',rid).eq('status','active').maybeSingle();
  const { count: currCount } = await svc.from('products')
    .select('*',{count:'exact',head:true}).eq('restaurant_id',rid).is('deleted_at',null);
  const maxP = sub?.plans?.max_products;

  // Count genuinely new products
  const { data: existingNames } = await svc.from('products')
    .select('name').eq('restaurant_id',rid).is('deleted_at',null)
    .in('name', ALL_PRODUCTS.map(p => p.name));
  const existingSet = new Set((existingNames ?? []).map(r => r.name));
  const newCount = ALL_PRODUCTS.filter(p => !existingSet.has(p.name)).length;
  if (maxP && (currCount + newCount) > maxP) {
    err(`Límite del plan: ${maxP} · actuales: ${currCount} · nuevos: ${newCount}`); process.exit(1);
  }
  ok(`Plan: ${sub?.plans?.name ?? 'libre'} · ${currCount}/${maxP ?? '∞'} · nuevos: +${newCount}`);

  // 3. Categories
  log('3. Categorías...');
  const { data: cats } = await svc.from('categories')
    .select('id,name,position,is_active').eq('restaurant_id',rid).order('position');
  const catMap = {};
  for (const c of cats ?? []) catMap[c.name] = c.id;

  if (!catMap['Camisas']) {
    const maxPos = Math.max(...(cats ?? []).map(c => c.position), 0);
    if (!DRY_RUN) {
      const { data: newCat, error } = await svc.from('categories').insert({
        restaurant_id: rid, name: 'Camisas', position: maxPos + 1, is_active: true,
      }).select('id').single();
      if (error) { err(`Camisas: ${error.message}`); process.exit(1); }
      catMap['Camisas'] = newCat.id;
      ok(`Categoría "Camisas" creada (pos ${maxPos + 1})`);
    } else {
      info('[dry-run] INSERT category "Camisas"');
      catMap['Camisas'] = 'dry-run-camisas';
    }
  } else {
    skip(`Categoría "Camisas" ya existe (${catMap['Camisas']})`);
  }

  if (!catMap['Suéteres']) { err('Categoría "Suéteres" no encontrada'); process.exit(1); }
  ok(`Categoría "Suéteres" encontrada (${catMap['Suéteres']})`);

  // 4. Products + images
  log(`4. Productos (${ALL_PRODUCTS.length} total)...`);
  const manifest = [];

  for (const [idx, p] of ALL_PRODUCTS.entries()) {
    const catId = catMap[p.category];
    if (!catId) { err(`Sin categoría para "${p.name}"`); continue; }

    // Idempotency: look up by name
    const { data: existingP } = await svc.from('products')
      .select('id,name').eq('restaurant_id',rid).eq('name',p.name).is('deleted_at',null).maybeSingle();

    let productId;
    let wasNew = false;

    if (existingP) {
      // Existing product: update fields but preserve any manually-added variants/options
      if (!DRY_RUN) {
        const { error } = await svc.from('products').update({
          category_id:      catId,
          description:      REF_DESC,
          base_price_cents: p.base_price_cents,
          is_published:     IS_PUBLISHED,
          is_available:     true,
          image_fit:        'contain',
        }).eq('id', existingP.id).eq('restaurant_id', rid);
        if (error) { err(`Update "${p.name}": ${error.message}`); continue; }
        warn(`"${p.name}" ya existe — actualizado (${existingP.id})`);
      } else {
        info(`[dry-run] UPDATE "${p.name}"`);
      }
      productId = existingP.id;
    } else {
      // New product: use upsert_product_admin for plan-limit enforcement
      wasNew = true;
      if (!DRY_RUN) {
        const { data: pid, error } = await svc.rpc('upsert_product_admin', {
          p_restaurant_id: rid,
          p_product: {
            id:               null,
            category_id:      catId,
            name:             p.name,
            description:      REF_DESC,
            base_price_cents: p.base_price_cents,
            is_published:     IS_PUBLISHED,
            is_available:     true,
            image_fit:        'contain',
            position:         idx + 1,
          },
          p_variants:      p.variants ?? [],
          p_option_groups: [],
        });
        if (error) { err(`"${p.name}": ${error.message}`); continue; }
        productId = pid;
        ok(`"${p.name}": ${productId}`);
      } else {
        const localCheck = p.images.map(i => ({ file: i.file, exists: existsSync(join(i.dir, i.file)) }));
        info(`[dry-run] CREATE "${p.name}" | imgs: ${localCheck.map(i => i.file + (i.exists?'✓':'✗')).join(', ')}`);
        productId = `dry-run-${p.stableKey}`;
      }
    }

    // If existing product needs variants updated (only for newly-added S/M confirmation)
    if (existingP && p.variants && !DRY_RUN) {
      const { count: varCount } = await svc.from('product_variants')
        .select('*',{count:'exact',head:true}).eq('product_id',existingP.id).eq('restaurant_id',rid);
      if (varCount === 0) {
        // No variants yet: add them via upsert to preserve plan atomics
        const { error } = await svc.rpc('upsert_product_admin', {
          p_restaurant_id: rid,
          p_product: {
            id:               existingP.id,
            category_id:      catId,
            name:             p.name,
            description:      REF_DESC,
            base_price_cents: p.base_price_cents,
            is_published:     IS_PUBLISHED,
            is_available:     true,
            image_fit:        'contain',
          },
          p_variants:      p.variants,
          p_option_groups: [],
        });
        if (error) err(`  Variantes "${p.name}": ${error.message}`);
        else       ok(`  Variantes S/M añadidas a "${p.name}"`);
      } else {
        skip(`  Variantes de "${p.name}" ya existen (${varCount})`);
      }
    }

    // Images — add each one idempotently
    let imgsUploaded = 0;
    for (const imgDef of p.images) {
      const result = await ensureImage(productId, rid, imgDef);
      if (result) imgsUploaded++;
    }

    manifest.push({
      stableKey: p.stableKey, ref: p.ref, name: p.name, category: p.category,
      productId, wasNew,
      variants: p.variants ? p.variants.map(v => v.name).join('/') : 'ninguna',
      basePrice: p.base_price_cents, priceRef: true,
      images: p.images.map(i => i.file),
      imgsUploaded,
    });
  }

  // 5. Verify others untouched
  log('5. Franelas anteriores intactas...');
  if (!DRY_RUN) {
    const { data: franelas } = await svc.from('categories')
      .select('id').eq('restaurant_id',rid).eq('name','Franelas').maybeSingle();
    if (franelas) {
      const { count: pub } = await svc.from('products')
        .select('*',{count:'exact',head:true}).eq('restaurant_id',rid)
        .eq('category_id',franelas.id).eq('is_published',true).is('deleted_at',null);
      ok(`Franelas publicadas: ${pub} (esperado 19)`);
    }
  }

  // 6. Summary
  log('\n╔══ RESUMEN ══╗');
  const created  = manifest.filter(m => m.wasNew).length;
  const updated  = manifest.filter(m => !m.wasNew).length;
  const totalImg = manifest.reduce((s, m) => s + m.imgsUploaded, 0);

  log(`URL catálogo : https://danash-shop.wacatalogo.com/`);
  log(`Creados      : ${created}`);
  log(`Actualizados : ${updated}`);
  log(`Imágenes sub.: ${totalImg}`);

  log('\nTabla de fichas:');
  log('  Clave'.padEnd(10) + 'Ref'.padEnd(5) + 'Nombre'.padEnd(38) + 'Tallas'.padEnd(10) + 'Imgs');
  log('  ' + '─'.repeat(72));
  for (const m of manifest) {
    log(`  ${m.stableKey.padEnd(8)} ${String(m.ref).padEnd(4)} ${m.name.padEnd(36)} ${m.variants.padEnd(10)} ${m.imgsUploaded}/${m.images.length}`);
  }

  // Validation
  const refs = manifest.map(m => m.ref);
  const unique = new Set(refs).size === refs.length;
  log(`\nValidación: ${manifest.length} fichas únicas: ${unique ? '✓' : '✗'}`);

  if (!DRY_RUN) {
    // Write manifest
    const __dir = dirname(fileURLToPath(import.meta.url));
    const mPath = join(__dir, '..', 'docs', 'danash-camisas-sueteres-manifest.json');
    writeFileSync(mPath, JSON.stringify({
      negocio: 'Danash Shop', slug: RESTAURANT_SLUG, restaurantId: manifest[0]?.productId ? undefined : '(dry-run)',
      importado: new Date().toISOString().slice(0,10),
      lotes: 'L03 (35-42), L04 (43-48 + 35/36/37/39/41 frente), L05 (49-54)',
      precio: 'US$1.00 de referencia (100 cents)', moneda: 'USD',
      descripcion: REF_DESC,
      creados: created, actualizados: updated, imagenesSubidas: totalImg,
      fichas: manifest.map(m => ({
        stableKey: m.stableKey, ref: m.ref, nombre: m.name, categoria: m.category,
        productId: m.productId, tallas: m.variants, precioRef: true, publicado: IS_PUBLISHED,
        imagenes: m.images, imgsSubidas: m.imgsUploaded,
      })),
    }, null, 2));
    ok('Manifiesto guardado: docs/danash-camisas-sueteres-manifest.json');
  }

  log('\n✅ Importación completada.\n');
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
