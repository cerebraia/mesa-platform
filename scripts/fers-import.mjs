/**
 * Fers Makeup — importación idempotente a Wacatalog
 * Ejecutar: node --env-file=/path/.env.local /tmp/fers-makeup/import.mjs
 *
 * Idempotencia: comprueba existencia antes de insertar.
 * Nunca toca datos de otros negocios.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) { console.error('Missing env vars'); process.exit(1); }

const svc = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

// ── Business definition ──────────────────────────────────────────────────────

const BIZ = {
  name:          'Fers Makeup',
  slug:          'fers-makeup',
  currency:      'USD',
  timezone:      'America/Caracas',
  status:        'active',
  business_type: 'store',
};

const CONFIG = {
  orders_enabled:   false,         // Solo catálogo
  whatsapp:         '584126034866',
  primary_color:    '#5A2D18',     // café oscuro (texto/acento)
  background_color: '#FFF8F3',     // crema
  secondary_color:  '#F4D0BA',     // durazno suave
  font_family:      'Poppins',
  description:      'Maquillaje y cuidado personal. Consultas por WhatsApp.',
};

// ── Categories ───────────────────────────────────────────────────────────────

const CATEGORIES = [
  { name: 'Rostro',            position: 1 },
  { name: 'Ojos y cejas',      position: 2 },
  { name: 'Labios',            position: 3 },
  { name: 'Cuidado corporal',  position: 4 },
];

// ── Products ─────────────────────────────────────────────────────────────────
// base_price_cents: null for products with variants (price comes from variants)
// Variants all share the product price

const PRODUCTS = [
  {
    name:              'Base de Alta Cobertura',
    category:          'Rostro',
    description:       'Fórmula libre de aceite. Acabado de alta cobertura que unifica y perfecciona el tono de la piel.',
    base_price_cents:  null,
    is_published:      true,
    is_available:      true,
    image_fit:         'contain',
    position:          1,
    crop_file:         'base.jpg',
    original_file:     'base_original.jpg',
    variants:          ['01','02','03','04','05','06'].map(n => ({
      name: `Tono ${n}`, price_cents: 1000, is_available: true,
    })),
  },
  {
    name:              'Corrector Matte',
    category:          'Rostro',
    description:       'Corrector de alta cobertura con acabado mate. Disimula imperfecciones, ojeras y manchas.',
    base_price_cents:  null,
    is_published:      true,
    is_available:      true,
    image_fit:         'contain',
    position:          2,
    crop_file:         'corrector.jpg',
    original_file:     'corrector_original.jpg',
    variants:          ['01','02','03','04','05','06','07'].map(n => ({
      name: `Tono ${n}`, price_cents: 500, is_available: true,
    })),
  },
  {
    name:              'Polvo Compacto Mineralizado',
    category:          'Rostro',
    description:       'Polvo compacto con acabado de alta cobertura y fórmula mineralizada. Fija el maquillaje y controla el brillo.',
    base_price_cents:  null,
    is_published:      true,
    is_available:      true,
    image_fit:         'contain',
    position:          3,
    crop_file:         'polvo.jpg',
    original_file:     'polvo_original.jpg',
    variants:          ['02','03','04','05','06'].map(n => ({
      name: `Tono ${n}`, price_cents: 800, is_available: true,
    })),
  },
  {
    name:              'Blush Premium Luminoso',
    category:          'Rostro',
    description:       'Rubor premium con partículas de brillo para un acabado luminoso y natural.',
    base_price_cents:  null,
    is_published:      true,
    is_available:      true,
    image_fit:         'contain',
    position:          4,
    crop_file:         'blush.jpg',
    original_file:     'blush_original.jpg',
    variants:          ['01','02','03','04','05'].map(n => ({
      name: `Tono ${n}`, price_cents: 900, is_available: true,
    })),
  },
  {
    name:              'Delineador Líquido para Cejas',
    category:          'Ojos y cejas',
    description:       'Delineador líquido de punta ultra fina con efecto microblading. Define y da forma a las cejas con trazo preciso.',
    base_price_cents:  null,
    is_published:      true,
    is_available:      true,
    image_fit:         'contain',
    position:          1,
    crop_file:         'delineador.jpg',
    original_file:     'delineador_original.jpg',
    variants:          ['01','02','03'].map(n => ({
      name: `Tono ${n}`, price_cents: 800, is_available: true,
    })),
  },
  {
    name:              'Rímel Resistente al Agua',
    category:          'Ojos y cejas',
    description:       'Rímel resistente al agua que alarga y da volumen a las pestañas. Fórmula de larga duración.',
    base_price_cents:  600,
    is_published:      true,
    is_available:      true,
    image_fit:         'contain',
    position:          2,
    crop_file:         'rimel.jpg',
    original_file:     'rimel_original.jpg',
    variants:          [],
  },
  {
    name:              'Labial Velvet',
    category:          'Labios',
    description:       'Labial de larga duración con acabado aterciopelado. Pigmentación intensa y confort en cada aplicación.',
    base_price_cents:  null,
    is_published:      true,
    is_available:      true,
    image_fit:         'contain',
    position:          1,
    crop_file:         'labial.jpg',
    original_file:     'labial_original.jpg',
    variants:          ['01','02','03','04','05','06'].map(n => ({
      name: `Tono ${n}`, price_cents: 700, is_available: true,
    })),
  },
  {
    name:              'Kit Viajero',
    category:          'Cuidado corporal',
    description:       'Set de cuidado corporal para viajes. Incluye splash corporal 40ml, gel de ducha 90ml y crema corporal 50ml.',
    base_price_cents:  1100,
    is_published:      true,
    is_available:      true,
    image_fit:         'contain',
    position:          1,
    crop_file:         'kit.jpg',
    original_file:     'kit_original.jpg',
    variants:          [],
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function log(msg) { process.stdout.write(msg + '\n'); }
function ok(msg)  { log(`  ✅ ${msg}`); }
function warn(msg){ log(`  ⚠️  ${msg}`); }
function err(msg) { log(`  ❌ ${msg}`); }

async function uploadFile(bucket, path, filePath, contentType) {
  const data = readFileSync(filePath);
  const { error } = await svc.storage.from(bucket).upload(path, data, {
    contentType, upsert: true,
  });
  if (error) throw new Error(`Upload failed ${path}: ${error.message}`);
  return path;
}

// ── Main import ──────────────────────────────────────────────────────────────

async function run() {
  log('\n╔══ Fers Makeup — importación idempotente ══╗\n');

  // ── 1. Restaurant ──────────────────────────────────────────────────────────
  log('1. Restaurante...');
  let { data: existing } = await svc.from('restaurants')
    .select('id,name,slug').eq('slug', BIZ.slug).is('deleted_at', null).maybeSingle();

  let restaurantId;
  if (existing) {
    warn(`Slug ${BIZ.slug} ya existe: ${existing.id} (${existing.name}) — reutilizando`);
    restaurantId = existing.id;
  } else {
    const { data: r, error } = await svc.from('restaurants').insert(BIZ)
      .select('id').single();
    if (error) { err(`No se pudo crear: ${error.message}`); process.exit(1); }
    restaurantId = r.id;
    ok(`Creado: ${restaurantId}`);
  }

  // ── 2. Config ──────────────────────────────────────────────────────────────
  log('2. Configuración...');
  const { error: cfgErr } = await svc.from('restaurant_config').upsert(
    { restaurant_id: restaurantId, ...CONFIG },
    { onConflict: 'restaurant_id' }
  );
  if (cfgErr) err(`Config: ${cfgErr.message}`);
  else ok('Config guardada (colores, WhatsApp, solo catálogo)');

  // ── 3. Logo upload ─────────────────────────────────────────────────────────
  log('3. Logo (monograma fs)...');
  const logoLocalPath = '/tmp/fers-makeup/logo_fers.jpg';
  if (existsSync(logoLocalPath)) {
    try {
      const logoStoragePath = `${restaurantId}/logo.jpg`;
      await uploadFile('restaurant-assets', logoStoragePath, logoLocalPath, 'image/jpeg');
      await svc.from('restaurant_config').update({ logo_path: logoStoragePath })
        .eq('restaurant_id', restaurantId);
      ok(`Logo subido: ${logoStoragePath}`);
    } catch (e) { err(`Logo: ${e.message}`); }
  } else { warn('Logo local no encontrado, se omite'); }

  // ── 4. Categories ──────────────────────────────────────────────────────────
  log('4. Categorías...');
  const categoryMap = {}; // name → id
  for (const cat of CATEGORIES) {
    const { data: existing } = await svc.from('categories')
      .select('id').eq('restaurant_id', restaurantId).eq('name', cat.name).maybeSingle();
    if (existing) {
      warn(`Categoría "${cat.name}" ya existe (${existing.id})`);
      categoryMap[cat.name] = existing.id;
    } else {
      const { data: c, error } = await svc.from('categories')
        .insert({ restaurant_id: restaurantId, ...cat, is_active: true })
        .select('id').single();
      if (error) { err(`Cat "${cat.name}": ${error.message}`); continue; }
      ok(`Categoría "${cat.name}": ${c.id}`);
      categoryMap[cat.name] = c.id;
    }
  }

  // ── 5. Products + variants + images ───────────────────────────────────────
  log('5. Productos...');
  const manifest = [];
  let variantTotal = 0;

  for (const p of PRODUCTS) {
    const categoryId = categoryMap[p.category];
    if (!categoryId) { err(`Sin categoría para ${p.name}`); continue; }

    // Look up existing product to pass its id to the RPC (upsert mode)
    const { data: existingP } = await svc.from('products')
      .select('id').eq('restaurant_id', restaurantId).eq('name', p.name)
      .is('deleted_at', null).maybeSingle();

    // Build product payload for upsert_product_admin
    const productPayload = {
      id:               existingP?.id ?? null,
      category_id:      categoryId,
      name:             p.name,
      description:      p.description ?? '',
      base_price_cents: p.base_price_cents,
      is_published:     p.is_published,
      is_available:     p.is_available,
      image_fit:        p.image_fit,
      position:         p.position,
    };

    // upsert_product_admin: atomic limit check + advisory lock
    const { data: productId, error: rpcError } = await svc.rpc('upsert_product_admin', {
      p_restaurant_id: restaurantId,
      p_product:       productPayload,
      p_variants:      p.variants.map((v, i) => ({
        name:         v.name,
        price_cents:  v.price_cents,
        is_available: v.is_available,
        position:     i,
      })),
      p_option_groups: [],
    });

    if (rpcError) { err(`Producto "${p.name}": ${rpcError.message}`); continue; }

    if (existingP) {
      warn(`Producto "${p.name}" actualizado (${productId})`);
    } else {
      ok(`Producto "${p.name}": ${productId}`);
    }

    if (p.variants.length > 0) {
      variantTotal += p.variants.length;
      ok(`  ${p.variants.length} variantes procesadas`);
    }

    // ── Product image ──────────────────────────────────────────────────
    const { data: existingImgs } = await svc.from('product_images')
      .select('id').eq('product_id', productId).eq('restaurant_id', restaurantId);

    if (existingImgs && existingImgs.length > 0) {
      ok(`  Imagen ya existe, se omite upload`);
    } else {
      // Upload crop (thumbnail) + original
      const cropPath     = `/tmp/fers-makeup/crops/${p.crop_file}`;
      const origPath     = `/tmp/fers-makeup/originals/${p.original_file}`;
      const ts           = Date.now();
      const storagePath  = `${restaurantId}/${productId}/${ts}.jpg`;
      const thumbPath    = `${restaurantId}/${productId}/${ts}_thumb.jpg`;

      let uploadedOrig = null, uploadedThumb = null;

      if (existsSync(origPath)) {
        try {
          await uploadFile('product-images', storagePath, origPath, 'image/jpeg');
          uploadedOrig = storagePath;
          ok(`  Original subido: ${storagePath}`);
        } catch(e) { err(`  Original: ${e.message}`); }
      } else if (existsSync(cropPath)) {
        // Fallback: use crop as storage_path
        try {
          await uploadFile('product-images', storagePath, cropPath, 'image/jpeg');
          uploadedOrig = storagePath;
          ok(`  Imagen subida (sin original): ${storagePath}`);
        } catch(e) { err(`  Imagen: ${e.message}`); }
      }

      if (existsSync(cropPath) && uploadedOrig) {
        try {
          await uploadFile('product-images', thumbPath, cropPath, 'image/jpeg');
          uploadedThumb = thumbPath;
          ok(`  Thumbnail subido: ${thumbPath}`);
        } catch(e) { err(`  Thumbnail: ${e.message}`); }
      }

      if (uploadedOrig) {
        const { error } = await svc.from('product_images').insert({
          product_id:     productId,
          restaurant_id:  restaurantId,
          storage_path:   uploadedOrig,
          thumbnail_path: uploadedThumb,
          alt_text:       p.name,
          position:       0,
        });
        if (error) err(`  product_images: ${error.message}`);
        else ok(`  Registro product_images creado`);
      }
    }

    manifest.push({ name: p.name, productId, categoryId, variants: p.variants.length });
  }

  // ── 6. Summary ────────────────────────────────────────────────────────────
  log('\n╔══ RESUMEN ══╗');
  log(`Restaurante ID : ${restaurantId}`);
  log(`Slug           : ${BIZ.slug}`);
  log(`URL prevista   : https://fers-makeup.wacatalogo.com/`);
  log(`URL local      : http://localhost:3000/r/fers-makeup`);
  log(`Productos      : ${manifest.length}/8`);

  // Recount actual variants from DB
  const { count: varCount } = await svc.from('product_variants')
    .select('*', { count: 'exact', head: true })
    .in('product_id', manifest.map(m => m.productId))
    .eq('restaurant_id', restaurantId);
  log(`Variantes en BD: ${varCount ?? 'error'} (esperadas: 32)`);

  const { count: imgCount } = await svc.from('product_images')
    .select('*', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId);
  log(`Imágenes en BD : ${imgCount ?? 'error'}/8`);

  log('\nManifiesto:');
  manifest.forEach(m =>
    log(`  ${m.name.padEnd(35)} product=${m.productId.slice(0,8)} variants=${m.variants}`)
  );

  log('\n✅ Importación completada. Verifica en http://localhost:3000/r/fers-makeup\n');
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
