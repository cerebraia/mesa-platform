/**
 * Simo Store — Lote 2: collares, saquitos y franelas adicionales (idempotente)
 * Ejecutar desde la raíz del proyecto:
 *   node --env-file=.env.local scripts/simo-store-lote2-import.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const svc = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const RESTAURANT_SLUG = 'simo-store';
const IMAGES_DIR = '/Users/fernandao2307/Documents/Catalogos/1. Simone/2';

const log  = (msg) => process.stdout.write(msg + '\n');
const ok   = (msg) => log(`  ✅ ${msg}`);
const warn = (msg) => log(`  ⚠️  ${msg}`);
const err  = (msg) => log(`  ❌ ${msg}`);
const skip = (msg) => log(`  ⏭  ${msg}`);

async function uploadImage(restaurantId, productId, filename) {
  const filePath = join(IMAGES_DIR, filename);
  if (!existsSync(filePath)) { warn(`Archivo no encontrado: ${filename}`); return null; }
  const data = readFileSync(filePath);
  const ts = Date.now();
  const storagePath = `${restaurantId}/${productId}/${ts}_${filename.replace(/\s+/g, '_')}`;
  const { error } = await svc.storage.from('product-images').upload(storagePath, data, {
    contentType: 'image/jpeg', upsert: true,
  });
  if (error) { err(`Upload ${filename}: ${error.message}`); return null; }
  return storagePath;
}

// Idempotent image insert: skip if storage_path already contains this filename.
async function ensureImage(productId, restaurantId, filename, altText, position) {
  const { data: existing } = await svc.from('product_images')
    .select('id, storage_path')
    .eq('product_id', productId)
    .eq('restaurant_id', restaurantId);

  const sanitized = filename.replace(/\s+/g, '_');
  const alreadyUploaded = (existing ?? []).some(
    (i) => i.storage_path.includes(`_${sanitized}`) || i.storage_path.includes(`_${filename}`),
  );
  if (alreadyUploaded) { skip(`  Ya existe: ${filename}`); return; }

  const storagePath = await uploadImage(restaurantId, productId, filename);
  if (!storagePath) return;

  const positionActual = position ?? (existing?.length ?? 0);
  const { error } = await svc.from('product_images').insert({
    product_id: productId, restaurant_id: restaurantId,
    storage_path: storagePath, thumbnail_path: null,
    alt_text: altText, position: positionActual,
  });
  if (error) err(`  product_images "${filename}": ${error.message}`);
  else        ok(`  Imagen: ${filename}`);
}

async function upsertProduct(rid, categoryId, payload, variants = []) {
  const { data: existing } = await svc.from('products')
    .select('id').eq('restaurant_id', rid).eq('name', payload.name).is('deleted_at', null).maybeSingle();

  const { data: productId, error } = await svc.rpc('upsert_product_admin', {
    p_restaurant_id: rid,
    p_product: {
      id:               existing?.id ?? null,
      category_id:      categoryId,
      name:             payload.name,
      description:      payload.description,
      base_price_cents: payload.base_price_cents ?? null,
      promo_price_cents: null,
      is_available:     true,
      is_published:     payload.is_published ?? true,
      position:         payload.position ?? 0,
      image_fit:        payload.image_fit ?? 'contain',
    },
    p_variants:      variants,
    p_option_groups: [],
  });

  if (error) { err(`"${payload.name}": ${error.message}`); return null; }
  if (existing) warn(`"${payload.name}" ya existía — actualizado`);
  else          ok(`Creado: "${payload.name}"`);
  return productId;
}

// ── Product definitions ───────────────────────────────────────────────────────

const FRAN_DESC =
  'Franelas de algodón con estampado prediseñado en DTF de excelente calidad. ' +
  'Damas, caballeros y niños. Tallas desde la 4 hasta XXXL (consultar disponibilidad). ' +
  'Desde XL, suplemento de US$1. Para 4 o más unidades consultar precio especial por WhatsApp.';

const COLLAR_DESC =
  'Collar con piezas esféricas de acrílico o resina, conocidas como bolas chicle. Para damas.';

// New franelas navideñas
const NEW_FRANELAS = [
  {
    name: 'Franela Doctor Navideño',
    description: FRAN_DESC,
    base_price_cents: 1500,
    is_published: true,
    primary_image: '03_DOCTOR.jpg',
    extra_images: [],
  },
  {
    name: 'Franela Teacher Navideña',
    description: FRAN_DESC,
    base_price_cents: 1500,
    is_published: true,
    primary_image: '04_TEACHER.jpg',
    extra_images: [],
  },
  {
    // "Team Hallacas — Yo hago las fotos y los videos"
    name: 'Franela Team Hallacas (fotos y videos)',
    description: FRAN_DESC,
    base_price_cents: 1500,
    is_published: true,
    primary_image: '05_TEAM_HALLACA.jpg',
    extra_images: [],
  },
  {
    // "Team Hallacas — Yo lavo las hojas"
    name: 'Franela Team Hallacas (lavo las hojas)',
    description: FRAN_DESC,
    base_price_cents: 1500,
    is_published: true,
    primary_image: '06_TEAM_HALLACAS.jpg',
    extra_images: [],
  },
];

// New collares: each design is a distinct product
const NEW_COLLARES = [
  {
    name: 'Collar Arbolito Rosa',
    description: `${COLLAR_DESC} Combinación rosado, chocolate y crema con dije de árbol navideño.`,
    base_price_cents: 1500,
    is_published: true,
    primary_image: 'ARBOLITO ROSA.jpg',
  },
  {
    name: 'Collar Caramelo Navideño',
    description: `${COLLAR_DESC} Combinación rojo, verde y blanco con dijes de caramelo.`,
    base_price_cents: 1500,
    is_published: true,
    primary_image: 'CARAMELO.jpg',
  },
  {
    name: 'Collar Cascanueces',
    description: `${COLLAR_DESC} Combinación rojo, verde y blanco con dijes de cascanueces.`,
    base_price_cents: 1500,
    is_published: true,
    primary_image: 'CASCANUECES.jpg',
  },
  {
    name: 'Collar Grinch Navideño',
    description: `${COLLAR_DESC} Combinación rojo, verde y blanco con dije del Grinch.`,
    base_price_cents: 1500,
    is_published: true,
    primary_image: 'GRINCH.jpg',
  },
  {
    name: 'Collar Ho Ho Ho',
    description: `${COLLAR_DESC} Combinación rojo, verde y blanco con letras HoHoHo y árbol navideño.`,
    base_price_cents: 1500,
    is_published: true,
    primary_image: 'HO HO HO.jpg',
  },
  {
    name: 'Collar Mickey Navideño',
    description: `${COLLAR_DESC} Combinación negro, blanco, rojo y crema con dije de Mickey Mouse navideño.`,
    base_price_cents: 1500,
    is_published: true,
    primary_image: 'MICKEY.jpg',
  },
  {
    name: 'Collar Osito Reno',
    description: `${COLLAR_DESC} Combinación marrón, rojo, crema y verde azulado con dije de reno navideño.`,
    base_price_cents: 1500,
    is_published: true,
    primary_image: 'OSITO.jpg',
  },
  {
    name: 'Collar Perlas Rojas y Blancas',
    description: `${COLLAR_DESC} Combinación rojo y blanco. Presentación doble: collar de bolas grandes y gargantilla de cristales.`,
    base_price_cents: 1500,
    is_published: true,
    primary_image: 'PERLAS ROJAS Y BLANCAS.jpg',
  },
];

// Saquitos: draft — price not confirmed
// base_price_cents: null → unpublished until confirmed
const SAQUITO = {
  name: 'Saquitos de tela navideños',
  description:
    'Saquitos elaborados con tela de liencillo o tela impermeable, ideales para cualquier detalle. ' +
    'Colores y diseños variados con motivos navideños: rojo, verde y azul. Para damas.',
  base_price_cents: null,  // US$2 o US$2.50 — pendiente confirmar por modelo
  is_published: false,     // Borrador hasta confirmar precio por modelo
  primary_image: '01_SAQUITO2.jpg',
  extra_images: ['02_SAQUITOS.jpg'],
};

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  log('\n╔══ Simo Store — Lote 2 (collares, saquitos, franelas) ══╗\n');

  // 1. Verify restaurant
  const { data: restaurant } = await svc.from('restaurants')
    .select('id, name, slug').eq('slug', RESTAURANT_SLUG).is('deleted_at', null).maybeSingle();
  if (!restaurant) { err('No se encontró simo-store'); process.exit(1); }
  const rid = restaurant.id;
  ok(`${restaurant.name} — ${rid}`);

  // 2. Build category map
  const { data: cats } = await svc.from('categories')
    .select('id, name').eq('restaurant_id', rid);
  const catMap = {};
  for (const c of cats ?? []) catMap[c.name] = c.id;

  const navidadId      = catMap['Franelas navideñas'];
  const collaresId     = catMap['Collares'];
  const saquitosId     = catMap['Saquitos de tela'];

  if (!navidadId)  { err('Falta categoría "Franelas navideñas"');  process.exit(1); }
  if (!collaresId) { err('Falta categoría "Collares"');            process.exit(1); }
  if (!saquitosId) { err('Falta categoría "Saquitos de tela"');    process.exit(1); }

  const manifest = [];

  // 3. New franelas navideñas
  log('\n3. Nuevas franelas navideñas...');
  // Determine next position
  const { data: lastFran } = await svc.from('products')
    .select('position').eq('restaurant_id', rid).eq('category_id', navidadId)
    .is('deleted_at', null).order('position', { ascending: false }).limit(1).maybeSingle();
  let franPos = (lastFran?.position ?? -1) + 1;

  for (const p of NEW_FRANELAS) {
    const pid = await upsertProduct(rid, navidadId, { ...p, position: franPos++ });
    if (!pid) continue;
    for (const [i, img] of [p.primary_image, ...p.extra_images].entries()) {
      await ensureImage(pid, rid, img, p.name, i);
    }
    manifest.push({ name: p.name, pid, category: 'Franelas navideñas', price: 'US$15', published: 'Sí' });
  }

  // 4. New collares
  log('\n4. Nuevos collares...');
  const { data: lastCollar } = await svc.from('products')
    .select('position').eq('restaurant_id', rid).eq('category_id', collaresId)
    .is('deleted_at', null).order('position', { ascending: false }).limit(1).maybeSingle();
  let collarPos = (lastCollar?.position ?? -1) + 1;

  for (const p of NEW_COLLARES) {
    const pid = await upsertProduct(rid, collaresId, { ...p, position: collarPos++ });
    if (!pid) continue;
    await ensureImage(pid, rid, p.primary_image, p.name, 0);
    manifest.push({ name: p.name, pid, category: 'Collares', price: 'US$15', published: 'Sí' });
  }

  // 5. Saquitos (draft)
  log('\n5. Saquitos de tela (borrador)...');
  const { data: lastSaq } = await svc.from('products')
    .select('position').eq('restaurant_id', rid).eq('category_id', saquitosId)
    .is('deleted_at', null).order('position', { ascending: false }).limit(1).maybeSingle();
  const saqPos = (lastSaq?.position ?? -1) + 1;

  const saqPid = await upsertProduct(rid, saquitosId, { ...SAQUITO, position: saqPos });
  if (saqPid) {
    for (const [i, img] of [SAQUITO.primary_image, ...SAQUITO.extra_images].entries()) {
      await ensureImage(saqPid, rid, img, SAQUITO.name, i);
    }
    manifest.push({
      name: SAQUITO.name, pid: saqPid,
      category: 'Saquitos de tela', price: 'PENDIENTE', published: 'No (borrador)',
    });
  }

  // 6. Summary
  log('\n╔══ RESUMEN LOTE 2 ══╗');
  const { count: totalProds } = await svc.from('products')
    .select('*', { count: 'exact', head: true }).eq('restaurant_id', rid).is('deleted_at', null);
  const { count: totalImgs } = await svc.from('product_images')
    .select('*', { count: 'exact', head: true }).eq('restaurant_id', rid);

  log(`Total archivos recibidos : 14`);
  log(`Fichas procesadas lote 2 : ${manifest.length}`);
  log(`Productos activos en BD  : ${totalProds}/100`);
  log(`Imágenes en BD           : ${totalImgs}`);
  log('\nTabla de resultados:');
  log('  Archivo(s)'.padEnd(44) + 'Categoría'.padEnd(22) + 'Precio'.padEnd(12) + 'Publicado');
  log('  ' + '─'.repeat(90));
  for (const m of manifest) {
    log(`  ${m.name.padEnd(42)} ${m.category.padEnd(22)} ${m.price.padEnd(12)} ${m.published}`);
  }
  log(`\n✅ Lote 2 completado.`);
  log(`\n⚠️  PENDIENTE — Saquitos: confirmar cuál modelo/material es US$2 y cuál US$2.50 para publicar.`);
  log(`URL: https://simo-store.wacatalogo.com/\n`);
}

run().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
