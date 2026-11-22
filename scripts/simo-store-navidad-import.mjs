/**
 * Simo Store — importación catálogo navideño (idempotente)
 * Ejecutar desde la raíz del proyecto:
 *   node --env-file=.env.local scripts/simo-store-navidad-import.mjs
 *
 * Idempotencia:
 *   - Renombra Accesorios → Collares si existe.
 *   - Crea categorías que falten; actualiza posición si ya existen.
 *   - Usa upsert_product_admin (enforces 100-product limit).
 *   - Salta upload de imagen si el storage_path ya contiene ese nombre de archivo.
 *   - Nunca toca datos de otros negocios.
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
const IMAGES_DIR = '/Users/fernandao2307/Documents/Catalogos/1. Simone/catalogo_completo_navidad_1080x1300';

// ── Logging ───────────────────────────────────────────────────────────────────

const log  = (msg) => process.stdout.write(msg + '\n');
const ok   = (msg) => log(`  ✅ ${msg}`);
const warn = (msg) => log(`  ⚠️  ${msg}`);
const err  = (msg) => log(`  ❌ ${msg}`);
const skip = (msg) => log(`  ⏭  ${msg}`);

// ── Image upload ──────────────────────────────────────────────────────────────

async function uploadImage(restaurantId, productId, filename) {
  const filePath = join(IMAGES_DIR, filename);
  if (!existsSync(filePath)) {
    warn(`Archivo no encontrado: ${filename}`);
    return null;
  }
  const data = readFileSync(filePath);
  const ts = Date.now();
  const storagePath = `${restaurantId}/${productId}/${ts}_${filename}`;
  const { error } = await svc.storage.from('product-images').upload(storagePath, data, {
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (error) { err(`Upload ${filename}: ${error.message}`); return null; }
  return storagePath;
}

// ── Product data ──────────────────────────────────────────────────────────────

const BASE_DESC =
  'Franelas de algodón con estampado prediseñado en DTF de excelente calidad. ' +
  'Damas, caballeros y niños. Tallas desde la 4 hasta XXXL (consultar disponibilidad). ' +
  'Desde XL, suplemento de US$1. Para 4 o más unidades consultar precio especial por WhatsApp.';

const NINOS_DESC =
  'Franelas de algodón con estampado prediseñado en DTF de excelente calidad. ' +
  'Para niños. Tallas desde la 4 hasta XXXL (consultar disponibilidad). ' +
  'Desde XL, suplemento de US$1. Para 4 o más unidades consultar precio especial por WhatsApp.';

const NINAS_DESC =
  'Franelas de algodón con estampado prediseñado en DTF de excelente calidad. ' +
  'Para niñas. Tallas desde la 4 hasta XXXL (consultar disponibilidad). ' +
  'Desde XL, suplemento de US$1. Para 4 o más unidades consultar precio especial por WhatsApp.';

// Each entry: name, description, price (cents), publish flag, primary image file, extra gallery files.
const NAVIDAD_PRODUCTS = [
  {
    name: 'Franela Gato Navideño',
    description: BASE_DESC,
    base_price_cents: 1500,
    is_published: true,
    primary_image: '01_3_gato_what.jpg',
    extra_images: [],
  },
  {
    name: 'Franela Merry Grinchmas (cara en círculo)',
    description: BASE_DESC,
    base_price_cents: 1500,
    is_published: true,
    primary_image: '02_4_merry_grinchmas_circulo.jpg',
    extra_images: [],
  },
  {
    // Same design, two shirt colors: white (03) + black (17)
    name: 'Franela Merry Grinchmas (texto felpa)',
    description: BASE_DESC,
    base_price_cents: 1500,
    is_published: true,
    primary_image: '03_5_merry_grinchmas_felpa.jpg',
    extra_images: ['17_17_merry_grinchmas_negra.jpg'],
  },
  {
    name: 'Franela HoHoHo con bolsillo',
    description: BASE_DESC,
    base_price_cents: 1500,
    is_published: true,
    primary_image: '04_6_hohoho_bolsillo.jpg',
    extra_images: [],
  },
  {
    name: 'Franela Merry Christmas Retro',
    description: BASE_DESC,
    base_price_cents: 1500,
    is_published: true,
    primary_image: '05_7_merry_christmas_retro.jpg',
    extra_images: [],
  },
  {
    name: 'Franela HoHoHo Central',
    description: BASE_DESC,
    base_price_cents: 1500,
    is_published: true,
    primary_image: '06_8_hohoho_central.jpg',
    extra_images: [],
  },
  {
    name: 'Franela Grinchy (pedrería azul)',
    description: BASE_DESC,
    base_price_cents: 1500,
    is_published: true,
    primary_image: '07_9_grinchy_pedreria_azul.jpg',
    extra_images: [],
  },
  {
    // Two views of the same design: worn (08) + folded (37)
    name: 'Franela Feliz Navidad by DiPer',
    description: BASE_DESC,
    base_price_cents: 1500,
    is_published: true,
    primary_image: '08_10_feliz_navidad_diper.jpg',
    extra_images: ['37_46_feliz_navidad_diper_doblada.jpg'],
  },
  {
    // Two views of the same design
    name: 'Franela Family Christmas 2026',
    description: BASE_DESC,
    base_price_cents: 1500,
    is_published: true,
    primary_image: '09_11_family_christmas_2026.jpg',
    extra_images: ['11_11_2_family_christmas_2026.jpg'],
  },
  {
    // Two views of the same design
    name: 'Franela No estén HoHo jodiendo',
    description: BASE_DESC,
    base_price_cents: 1500,
    is_published: true,
    primary_image: '10_12_no_esten_hoho_jodiendo.jpg',
    extra_images: ['12_12_2_no_esten_hoho_jodiendo.jpg'],
  },
  {
    // Same design in two colors (black + wine), two photos each = 4 gallery images
    name: 'Franela Maestra Navideña',
    description: BASE_DESC,
    base_price_cents: 1500,
    is_published: true,
    primary_image: '13_20_maestra_negra.jpg',
    extra_images: [
      '14_21_maestra_vinotinto.jpg',
      '19_20_2_maestra_negra.jpg',
      '20_21_2_maestra_vinotinto.jpg',
    ],
  },
  {
    name: 'Franela Mi día estoy ocupado',
    description: BASE_DESC,
    base_price_cents: 1500,
    is_published: true,
    primary_image: '15_15_mi_dia_estoy_ocupado.jpg',
    extra_images: [],
  },
  {
    name: 'Franela Pesebre con estrellas',
    description: BASE_DESC,
    base_price_cents: 1500,
    is_published: true,
    primary_image: '16_16_pesebre_estrellas.jpg',
    extra_images: [],
  },
  {
    name: 'Franela Grinch Esfera',
    description: BASE_DESC,
    base_price_cents: 1500,
    is_published: true,
    primary_image: '18_18_grinch_esfera_negra.jpg',
    extra_images: [],
  },
  {
    name: 'Franela Muñecos de Nieve',
    description: BASE_DESC,
    base_price_cents: 1500,
    is_published: true,
    primary_image: '21_22_munecos_nieve_vinotinto.jpg',
    extra_images: [],
  },
  {
    // Same design in three shirt colors: cream (adult), white (girl), black (girl)
    name: 'Franela Labubu Navidad',
    description: BASE_DESC,
    base_price_cents: 1500,
    is_published: true,
    primary_image: '22_25_labubu_navidad_crema.jpg',
    extra_images: [
      '32_40_labubu_nina_blanca.jpg',
      '33_41_labubu_nina_negra.jpg',
    ],
  },
  {
    name: 'Franela Modo Navideño cargando',
    description: BASE_DESC,
    base_price_cents: 1500,
    is_published: true,
    primary_image: '23_26_modo_navideno_cargando.jpg',
    extra_images: [],
  },
  {
    // Same design on green (24) and white (35, folded) shirts
    name: 'Franela Cara Grinch',
    description: BASE_DESC,
    base_price_cents: 1500,
    is_published: true,
    primary_image: '24_28_cara_grinch_verde.jpg',
    extra_images: ['35_43_cara_grinch_doblada_blanca.jpg'],
  },
  {
    name: 'Franela Grinch HoHoHo',
    description: BASE_DESC,
    base_price_cents: 1500,
    is_published: true,
    primary_image: '25_30_grinch_hohoho_vinotinto.jpg',
    extra_images: [],
  },
  {
    name: 'Franela Gamer Christmas (niño)',
    description: NINOS_DESC,
    base_price_cents: 1500,
    is_published: true,
    primary_image: '26_32_gamer_christmas_nino.jpg',
    extra_images: [],
  },
  {
    // Same design in two colors: white (27) + black (30)
    name: 'Franela Fortnite Christmas',
    description: NINOS_DESC,
    base_price_cents: 1500,
    is_published: true,
    primary_image: '27_34_fortnite_christmas_blanca.jpg',
    extra_images: ['30_38_fortnite_christmas_negra.jpg'],
  },
  {
    // Same design in two colors: white (28) + black (29)
    name: 'Franela Minecraft Christmas',
    description: NINOS_DESC,
    base_price_cents: 1500,
    is_published: true,
    primary_image: '28_36_minecraft_christmas_blanca.jpg',
    extra_images: ['29_37_minecraft_christmas_negra.jpg'],
  },
  {
    name: 'Franela Marvel Christmas',
    description: NINOS_DESC,
    base_price_cents: 1500,
    is_published: true,
    primary_image: '31_39_marvel_christmas_negra.jpg',
    extra_images: [],
  },
  {
    name: 'Franela Merry Christmas tejido (niña)',
    description: NINAS_DESC,
    base_price_cents: 1500,
    is_published: true,
    primary_image: '34_42_merry_christmas_tejido_nina.jpg',
    extra_images: [],
  },
  {
    name: 'Franela Merry Christmas Grinch',
    description: BASE_DESC,
    base_price_cents: 1500,
    is_published: true,
    primary_image: '36_45_merry_christmas_grinch_doblada.jpg',
    extra_images: [],
  },
  {
    name: 'Franela HoHoHo Santa (familiar)',
    description:
      'Franelas de algodón con estampado prediseñado en DTF de excelente calidad. ' +
      'Disponible para toda la familia: damas, caballeros y niños. ' +
      'Tallas desde la 4 hasta XXXL (consultar disponibilidad). ' +
      'Desde XL, suplemento de US$1. Para 4 o más unidades consultar precio especial por WhatsApp.',
    base_price_cents: 1500,
    is_published: true,
    primary_image: '38_47_familia_hohoho_santa.jpg',
    extra_images: [],
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  log('\n╔══ Simo Store — Importación catálogo navideño ══╗\n');

  // ── 1. Verify restaurant ───────────────────────────────────────────────────
  log('1. Negocio...');
  const { data: restaurant } = await svc.from('restaurants')
    .select('id, name, slug, status')
    .eq('slug', RESTAURANT_SLUG)
    .is('deleted_at', null)
    .maybeSingle();
  if (!restaurant) { err('No se encontró el negocio simo-store'); process.exit(1); }
  const rid = restaurant.id;
  ok(`${restaurant.name} — ${rid} (status: ${restaurant.status})`);

  // ── 2. Categories ──────────────────────────────────────────────────────────
  log('\n2. Categorías...');

  // Build catMap from current state
  const { data: existingCats } = await svc.from('categories')
    .select('id, name, position')
    .eq('restaurant_id', rid)
    .order('position');
  const catMap = {};
  for (const c of existingCats ?? []) catMap[c.name] = c.id;

  // Rename Accesorios → Collares (update catMap in-memory too)
  if (catMap['Accesorios']) {
    const { error } = await svc.from('categories')
      .update({ name: 'Collares', position: 2, updated_at: new Date().toISOString() })
      .eq('id', catMap['Accesorios'])
      .eq('restaurant_id', rid);
    if (error) {
      err(`Renombrar "Accesorios" → "Collares": ${error.message}`);
    } else {
      ok(`Renombrada "Accesorios" → "Collares"`);
      catMap['Collares'] = catMap['Accesorios'];
      delete catMap['Accesorios'];
    }
  }

  // Desired categories in final order
  const CATEGORIES = [
    { name: 'Franelas navideñas',      position: 0 },
    { name: 'Franelas personalizadas', position: 1 },
    { name: 'Collares',                position: 2 },
    { name: 'Saquitos de tela',        position: 3 },
  ];

  for (const cat of CATEGORIES) {
    if (catMap[cat.name]) {
      const { error } = await svc.from('categories')
        .update({ position: cat.position, updated_at: new Date().toISOString() })
        .eq('id', catMap[cat.name])
        .eq('restaurant_id', rid);
      if (error) err(`Actualizar posición "${cat.name}": ${error.message}`);
      else skip(`"${cat.name}" ya existe (posición → ${cat.position})`);
    } else {
      const { data: c, error } = await svc.from('categories')
        .insert({ restaurant_id: rid, name: cat.name, position: cat.position, is_active: true })
        .select('id')
        .single();
      if (error) { err(`Crear "${cat.name}": ${error.message}`); continue; }
      catMap[cat.name] = c.id;
      ok(`Categoría creada: "${cat.name}"`);
    }
  }

  // ── 3. Update existing products ────────────────────────────────────────────
  log('\n3. Productos existentes — actualizar precio y descripción...');

  // Brandy
  const { data: brandy } = await svc.from('products')
    .select('id')
    .eq('restaurant_id', rid)
    .eq('name', 'Franela personalizada de mascota — Brandy')
    .is('deleted_at', null)
    .maybeSingle();
  if (brandy) {
    const { error } = await svc.from('products').update({
      base_price_cents: 1500,
      description:
        'Franelas de algodón personalizadas con el diseño de tu preferencia. ' +
        'Damas, caballeros y niños. Tallas desde la 4 hasta XXXL (consultar disponibilidad). ' +
        'Desde US$15. Desde XL, suplemento de US$1. ' +
        'Para 4 o más unidades consultar precio especial por WhatsApp.',
      updated_at: new Date().toISOString(),
    }).eq('id', brandy.id).eq('restaurant_id', rid);
    if (error) err(`Brandy: ${error.message}`);
    else ok('Franela Brandy → US$15, descripción actualizada');
  } else {
    warn('Franela Brandy no encontrada — se omite');
  }

  // Collar artesanal
  const { data: collar } = await svc.from('products')
    .select('id')
    .eq('restaurant_id', rid)
    .eq('name', 'Collar artesanal de temporada')
    .is('deleted_at', null)
    .maybeSingle();
  if (collar) {
    const { error } = await svc.from('products').update({
      base_price_cents: 1500,
      description:
        'Collar con piezas esféricas de acrílico o resina, conocidas como bolas chicle. ' +
        'Combinaciones disponibles: rojo, verde y blanco; rosado y negro; blanco, negro y rojo. ' +
        'Para damas.',
      updated_at: new Date().toISOString(),
    }).eq('id', collar.id).eq('restaurant_id', rid);
    if (error) err(`Collar: ${error.message}`);
    else ok('Collar artesanal → US$15, descripción actualizada, categoría Collares (ya asignada por renombramiento)');
  } else {
    warn('Collar artesanal no encontrado — se omite');
  }

  // ── 4. Franelas navideñas ──────────────────────────────────────────────────
  log('\n4. Franelas navideñas (26 fichas)...');
  const navidadCatId = catMap['Franelas navideñas'];
  if (!navidadCatId) { err('No se encontró categoría "Franelas navideñas"'); process.exit(1); }

  const manifest = [];
  let position = 0;

  for (const p of NAVIDAD_PRODUCTS) {
    const { data: existingP } = await svc.from('products')
      .select('id')
      .eq('restaurant_id', rid)
      .eq('name', p.name)
      .is('deleted_at', null)
      .maybeSingle();

    const { data: productId, error: rpcError } = await svc.rpc('upsert_product_admin', {
      p_restaurant_id: rid,
      p_product: {
        id:               existingP?.id ?? null,
        category_id:      navidadCatId,
        name:             p.name,
        description:      p.description,
        base_price_cents: p.base_price_cents,
        promo_price_cents: null,
        is_available:     true,
        is_published:     p.is_published,
        position:         position++,
        image_fit:        'contain',
      },
      p_variants:      [],
      p_option_groups: [],
    });

    if (rpcError) { err(`"${p.name}": ${rpcError.message}`); continue; }
    if (existingP) warn(`"${p.name}" ya existía — actualizado`);
    else           ok(`Creado: "${p.name}"`);

    // Images
    const { data: existingImgs } = await svc.from('product_images')
      .select('id, storage_path')
      .eq('product_id', productId)
      .eq('restaurant_id', rid);

    let imgPosition = existingImgs?.length ?? 0;
    const allImages = [p.primary_image, ...p.extra_images];

    for (const imgFile of allImages) {
      const alreadyUploaded = (existingImgs ?? []).some(
        (i) => i.storage_path.includes(`_${imgFile}`),
      );
      if (alreadyUploaded) { skip(`  Ya existe: ${imgFile}`); continue; }

      const storagePath = await uploadImage(rid, productId, imgFile);
      if (!storagePath) continue;

      const { error: imgErr } = await svc.from('product_images').insert({
        product_id:     productId,
        restaurant_id:  rid,
        storage_path:   storagePath,
        thumbnail_path: null,
        alt_text:       p.name,
        position:       imgPosition++,
      });
      if (imgErr) err(`  product_images "${imgFile}": ${imgErr.message}`);
      else        ok(`  Imagen: ${imgFile}`);
    }

    manifest.push({ name: p.name, productId, images: allImages.length });
  }

  // ── 5. Franela personalizada nueva (familia Hernández como ejemplo) ─────────
  log('\n5. Franela personalizada nueva...');
  const personalizadaCatId = catMap['Franelas personalizadas'];
  if (personalizadaCatId) {
    const pName = 'Franela personalizada — Caricatura familiar';
    const { data: existingP } = await svc.from('products')
      .select('id')
      .eq('restaurant_id', rid)
      .eq('name', pName)
      .is('deleted_at', null)
      .maybeSingle();

    const { data: productId, error: rpcError } = await svc.rpc('upsert_product_admin', {
      p_restaurant_id: rid,
      p_product: {
        id:               existingP?.id ?? null,
        category_id:      personalizadaCatId,
        name:             pName,
        description:
          'Franelas de algodón personalizadas con el diseño de tu preferencia. ' +
          'Ejemplo de referencia: caricatura familiar. El diseño y los nombres son del cliente, ' +
          'no del modelo mostrado. Damas, caballeros y niños. ' +
          'Tallas desde la 4 hasta XXXL. Desde US$15. ' +
          'Consultar diseño y disponibilidad por WhatsApp.',
        base_price_cents: 1500,
        promo_price_cents: null,
        is_available:     true,
        is_published:     true,
        position:         1,
        image_fit:        'contain',
      },
      p_variants:      [],
      p_option_groups: [],
    });

    if (rpcError) {
      err(`Personalizada nueva: ${rpcError.message}`);
    } else {
      if (existingP) warn(`"${pName}" ya existía — actualizado`);
      else           ok(`Creado: "${pName}"`);

      const { data: existingImgs } = await svc.from('product_images')
        .select('id').eq('product_id', productId).eq('restaurant_id', rid);
      const imgFile = '39_48_caricatura_familia_hernandez.jpg';
      const alreadyUploaded = (existingImgs ?? []).length > 0;
      if (alreadyUploaded) {
        skip(`  Imagen ya existe`);
      } else {
        const storagePath = await uploadImage(rid, productId, imgFile);
        if (storagePath) {
          const { error: imgErr } = await svc.from('product_images').insert({
            product_id: productId, restaurant_id: rid,
            storage_path: storagePath, thumbnail_path: null,
            alt_text: pName, position: 0,
          });
          if (imgErr) err(`  product_images: ${imgErr.message}`);
          else        ok(`  Imagen: ${imgFile}`);
        }
      }
      manifest.push({ name: pName, productId, images: 1 });
    }
  }

  // ── 6. Summary ─────────────────────────────────────────────────────────────
  log('\n╔══ RESUMEN ══╗');

  const { count: totalProds } = await svc.from('products')
    .select('*', { count: 'exact', head: true })
    .eq('restaurant_id', rid)
    .is('deleted_at', null);
  const { count: totalImgs } = await svc.from('product_images')
    .select('*', { count: 'exact', head: true })
    .eq('restaurant_id', rid);
  const { data: cats } = await svc.from('categories')
    .select('name, position, is_active').eq('restaurant_id', rid).order('position');

  log(`Negocio     : Simo Store (${rid})`);
  log(`URL pública : https://simo-store.wacatalogo.com/`);
  log(`Productos activos en BD : ${totalProds}/100`);
  log(`Imágenes en BD          : ${totalImgs}`);
  log(`Fichas procesadas (esta corrida): ${manifest.length}`);
  log('\nCategorías finales:');
  for (const c of cats ?? []) log(`  [${c.position}] ${c.name} (activa: ${c.is_active})`);
  log('\nManifiesto:');
  manifest.forEach((m) =>
    log(`  ${m.name.padEnd(48)} productId=${m.productId?.slice(0, 8)} imgs=${m.images}`)
  );
  log('\n✅ Importación completada.\n');
  log('⚠️  PENDIENTE — Collares con motivos navideños: imágenes no recibidas aún.');
  log('⚠️  PENDIENTE — Saquitos de tela: imágenes y precios por confirmar (US$2 / US$2.50).\n');
}

run().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
