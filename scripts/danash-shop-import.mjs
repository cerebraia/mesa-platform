/**
 * Danash Shop — importación idempotente a Wacatalog
 *
 * Ejecutar desde la raíz del proyecto:
 *   node --env-file=.env.local scripts/danash-shop-import.mjs
 *
 * Flags:
 *   --dry-run   Muestra qué haría sin escribir nada en la base de datos
 *
 * Idempotente: puede ejecutarse varias veces sin duplicar negocios,
 * categorías, productos, imágenes ni suscripciones.
 *
 * Todos los productos se crean en borrador (is_published=false).
 * Moneda de venta PENDIENTE de confirmar con la propietaria.
 * No se envían correos ni invitaciones.
 *
 * NOTAS DE IMPORTACIÓN:
 * - 14 imágenes disponibles (01, 03–15) + 1 borrador especial (02) pendiente
 *   de foto frontal (02-cardigan-rojo-sonrisa.jpg en 03-revision/).
 * - Logo: pendiente — carpeta 01-marca/ no encontrada en el origen.
 * - Propietaria: Danash.hidalgo@gmail.com — vincular manualmente en /admin.
 * - Precio de referencia almacenado (suéteres: 35, cárdigans: 45);
 *   no se publica ningún producto hasta que la propietaria confirme moneda.
 * - Imágenes retocadas con IA; validación visual de la propietaria pendiente.
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
  console.error('❌ Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno.');
  process.exit(1);
}

// ── Environment check ─────────────────────────────────────────────────────────

log('\n╔══ Danash Shop — importación idempotente ══╗\n');
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

// ── Rutas de imágenes ─────────────────────────────────────────────────────────

const IMAGES_DIR   = '/Users/fernandao2307/Documents/Catalogos/2.danashshop_ve/Imagenes/1.';
const LOGO_DIR     = '/Users/fernandao2307/Documents/Catalogos/2.danashshop_ve/01-marca';
const REVISION_DIR = '/Users/fernandao2307/Documents/Catalogos/2.danashshop_ve/Imagenes/03-revision';

// ── Definición del negocio ─────────────────────────────────────────────────────

const BIZ = {
  name:          'Danash Shop',
  slug:          'danash-shop',
  currency:      'USD',       // PENDIENTE confirmar moneda de venta con propietaria
  timezone:      'America/Caracas',
  status:        'active',
  business_type: 'store',
};

// Identidad gráfica: dorado del logo + fondos marfil/blanco + texto oscuro
const CONFIG = {
  orders_enabled:   false,
  whatsapp:         '584241687650',
  instagram_url:    'https://www.instagram.com/danashshop_ve/',
  description:      'Suéteres y cárdigans para darle un toque especial a tu estilo.',
  primary_color:    '#B99042',   // dorado del logo (referencia)
  background_color: '#FAF9F5',   // blanco/marfil
  secondary_color:  '#25221C',   // texto oscuro
  font_family:      'Nunito',
};

// ── Categorías ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { name: 'Suéteres',  position: 1 },
  { name: 'Cárdigans', position: 2 },
  { name: 'Capas',     position: 3 },
];

// ── Productos ─────────────────────────────────────────────────────────────────
//
// TODOS en borrador (is_published: false). No se publica ningún producto
// hasta que la propietaria confirme moneda, precios y revise las fotos.
//
// stableKey: identificador estable del archivo fuente para este negocio.
// base_price_cents: precio de referencia en centavos (35 → 3500 USD ref.).
// image_fit: 'contain' — sin recortes, prendas completas.
//
// Especial — ds-02 (Cárdigan Rojo Sonrisa):
//   • Imagen en carpeta 03-revision/ (zona reconstruida con IA, pendiente foto frontal).
//   • is_available: false para prevenir publicación accidental aunque se active is_published.
//   • Requiere foto frontal validada antes de habilitar.

const PRODUCTS = [
  // ── Suéteres (9) ────────────────────────────────────────────────────────────
  {
    stableKey:         'ds-06',
    name:              'Suéter Rojo Árboles Navideños',
    category:          'Suéteres',
    description:       'Talla única.',
    base_price_cents:  3500,
    is_published:      false,
    is_available:      true,
    image_fit:         'contain',
    position:          1,
    image_file:        '06-sueter-rojo-arboles.jpg',
    image_dir:         IMAGES_DIR,
  },
  {
    stableKey:         'ds-07',
    name:              'Suéter Marfil Árbol',
    category:          'Suéteres',
    description:       'Talla única.',
    base_price_cents:  3500,
    is_published:      false,
    is_available:      true,
    image_fit:         'contain',
    position:          2,
    image_file:        '07-sueter-marfil-arbol.jpg',
    image_dir:         IMAGES_DIR,
  },
  {
    stableKey:         'ds-08',
    name:              'Suéter Verde Árbol',
    category:          'Suéteres',
    description:       'Talla única.',
    base_price_cents:  3500,
    is_published:      false,
    is_available:      true,
    image_fit:         'contain',
    position:          3,
    image_file:        '08-sueter-verde-arbol.jpg',
    image_dir:         IMAGES_DIR,
  },
  {
    stableKey:         'ds-09',
    name:              'Suéter Rojo Reno',
    category:          'Suéteres',
    description:       'Talla única.',
    base_price_cents:  3500,
    is_published:      false,
    is_available:      true,
    image_fit:         'contain',
    position:          4,
    image_file:        '09-sueter-rojo-reno.jpg',
    image_dir:         IMAGES_DIR,
  },
  {
    stableKey:         'ds-10',
    name:              'Suéter Verde Muñeco de Nieve',
    category:          'Suéteres',
    description:       'Talla única.',
    base_price_cents:  3500,
    is_published:      false,
    is_available:      true,
    image_fit:         'contain',
    position:          5,
    image_file:        '10-sueter-verde-muneco-nieve.jpg',
    image_dir:         IMAGES_DIR,
  },
  {
    stableKey:         'ds-11',
    name:              'Suéter Verde Árboles',
    category:          'Suéteres',
    description:       'Talla única.',
    base_price_cents:  3500,
    is_published:      false,
    is_available:      true,
    image_fit:         'contain',
    position:          6,
    image_file:        '11-sueter-verde-arboles.jpg',
    image_dir:         IMAGES_DIR,
  },
  {
    stableKey:         'ds-12',
    name:              'Suéter Verde Lazos',
    category:          'Suéteres',
    description:       'Talla única.',
    base_price_cents:  3500,
    is_published:      false,
    is_available:      true,
    image_fit:         'contain',
    position:          7,
    image_file:        '12-sueter-verde-lazos.jpg',
    image_dir:         IMAGES_DIR,
  },
  {
    stableKey:         'ds-13',
    name:              'Suéter Beige Gatos',
    category:          'Suéteres',
    description:       'Talla única.',
    base_price_cents:  3500,
    is_published:      false,
    is_available:      true,
    image_fit:         'contain',
    position:          8,
    image_file:        '13-sueter-beige-gatos.jpg',
    image_dir:         IMAGES_DIR,
  },
  {
    stableKey:         'ds-14',
    name:              'Suéter Rojo Lazos',
    category:          'Suéteres',
    description:       'Talla única.',
    base_price_cents:  3500,
    is_published:      false,
    is_available:      true,
    image_fit:         'contain',
    position:          9,
    image_file:        '14-sueter-rojo-lazos.jpg',
    image_dir:         IMAGES_DIR,
  },

  // ── Cárdigans (4) ───────────────────────────────────────────────────────────
  {
    stableKey:         'ds-01',
    name:              'Cárdigan Verde Sonrisa',
    category:          'Cárdigans',
    description:       '',
    base_price_cents:  4500,
    is_published:      false,
    is_available:      true,
    image_fit:         'contain',
    position:          1,
    image_file:        '01-cardigan-verde-sonrisa.jpg',
    image_dir:         IMAGES_DIR,
  },
  {
    stableKey:         'ds-02',
    name:              'Cárdigan Rojo Sonrisa',
    category:          'Cárdigans',
    // Zona reconstruida con IA — no publicar hasta validar foto frontal real
    description:       '',
    base_price_cents:  4500,
    is_published:      false,
    is_available:      false,  // doble bloqueo: requiere validar imagen y talla antes de publicar
    image_fit:         'contain',
    position:          2,
    image_file:        '02-cardigan-rojo-sonrisa.jpg',
    image_dir:         REVISION_DIR,  // carpeta 03-revision/ — puede no existir aún
  },
  {
    stableKey:         'ds-04',
    name:              'Cárdigan Verde Renos',
    category:          'Cárdigans',
    description:       '',
    base_price_cents:  4500,
    is_published:      false,
    is_available:      true,
    image_fit:         'contain',
    position:          3,
    image_file:        '04-cardigan-verde-renos.jpg',
    image_dir:         IMAGES_DIR,
  },
  {
    stableKey:         'ds-15',
    name:              'Cárdigan Marfil Rombos',
    category:          'Cárdigans',
    description:       '',
    base_price_cents:  4500,
    is_published:      false,
    is_available:      true,
    image_fit:         'contain',
    position:          4,
    image_file:        '15-cardigan-marfil-rombos.jpg',
    image_dir:         IMAGES_DIR,
  },

  // ── Capas (2) ────────────────────────────────────────────────────────────────
  {
    stableKey:         'ds-03',
    name:              'Capa Roja Navidad',
    category:          'Capas',
    description:       '',
    base_price_cents:  null,   // precio y talla pendientes de confirmar
    is_published:      false,
    is_available:      true,
    image_fit:         'contain',
    position:          1,
    image_file:        '03-capa-roja-navidad.jpg',
    image_dir:         IMAGES_DIR,
  },
  {
    stableKey:         'ds-05',
    name:              'Capa Azul Navidad',
    category:          'Capas',
    description:       '',
    base_price_cents:  null,   // precio y talla pendientes de confirmar
    is_published:      false,
    is_available:      true,
    image_fit:         'contain',
    position:          2,
    image_file:        '05-capa-azul-navidad.jpg',
    image_dir:         IMAGES_DIR,
  },
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

// Idempotent image insert: skip if the product already has images.
async function ensureProductImage(productId, restaurantId, p) {
  const { data: existing } = await svc.from('product_images')
    .select('id').eq('product_id', productId).eq('restaurant_id', restaurantId);

  if (existing && existing.length > 0) {
    skip(`  Imagen ya registrada para "${p.name}" — se omite`);
    return existing[0].id;  // truthy: image exists in DB
  }

  const localPath = join(p.image_dir, p.image_file);
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

  // ── 1. Restaurante ─────────────────────────────────────────────────────────
  log('1. Restaurante...');

  const { data: existing } = await svc.from('restaurants')
    .select('id, name, status, slug')
    .eq('slug', BIZ.slug)
    .is('deleted_at', null)
    .maybeSingle();

  let restaurantId;

  if (existing) {
    if (existing.status === 'active') {
      warn(`Slug "${BIZ.slug}" ya existe (ID: ${existing.id}) — reutilizando`);
      restaurantId = existing.id;
    } else if (existing.status === 'suspended') {
      err(`Slug "${BIZ.slug}" está suspendido (ID: ${existing.id}). Revisa en /admin antes de reimportar.`);
      process.exit(1);
    } else {
      warn(`Slug "${BIZ.slug}" existe en estado "${existing.status}" — retomando alta`);
      restaurantId = existing.id;
    }
  } else {
    if (DRY_RUN) {
      info(`[dry-run] INSERT restaurants slug=danash-shop`);
      restaurantId = '00000000-0000-0000-0000-000000000000';
    } else {
      const { data: r, error } = await svc.from('restaurants').insert(BIZ).select('id').single();
      if (error) { err(`No se pudo crear el negocio: ${error.message}`); process.exit(1); }
      restaurantId = r.id;
      ok(`Negocio creado: ${restaurantId}`);
    }
  }

  // ── 2. Configuración ───────────────────────────────────────────────────────
  log('2. Configuración (apariencia, WhatsApp, Instagram)...');
  if (!DRY_RUN) {
    const { error: cfgErr } = await svc.from('restaurant_config').upsert(
      { restaurant_id: restaurantId, ...CONFIG },
      { onConflict: 'restaurant_id' },
    );
    if (cfgErr) err(`Config: ${cfgErr.message}`);
    else ok('Configuración guardada (dorado #B99042, marfil #FAF9F5, Nunito)');
  } else {
    info('[dry-run] UPSERT restaurant_config');
  }

  // ── 3. Logo ────────────────────────────────────────────────────────────────
  log('3. Logo...');
  const logoCandidates = [
    join(LOGO_DIR, 'logo.png'),
    join(LOGO_DIR, 'logo.jpg'),
    join(LOGO_DIR, 'danash-logo.png'),
    join(LOGO_DIR, 'danash-logo.jpg'),
  ];
  const logoPath = logoCandidates.find(existsSync);

  if (logoPath) {
    const ext          = logoPath.endsWith('.png') ? 'png' : 'jpg';
    const contentType  = ext === 'png' ? 'image/png' : 'image/jpeg';
    const logoStorage  = `${restaurantId}/logo.${ext}`;
    try {
      await uploadFile('restaurant-assets', logoStorage, logoPath, contentType);
      if (!DRY_RUN) {
        await svc.from('restaurant_config')
          .update({ logo_path: logoStorage })
          .eq('restaurant_id', restaurantId);
      }
      ok(`Logo subido: ${logoStorage}`);
    } catch (e) {
      err(`Logo: ${e.message}`);
    }
  } else {
    warn('Logo no encontrado en 01-marca/ — PENDIENTE: proporcionar logo original DS');
  }

  // ── 4. Suscripción (plan Negocio US$29.99 · 200 productos) ────────────────
  log('4. Suscripción...');

  const { data: existingSub } = await svc.from('subscriptions')
    .select('id, status, plans(name, price_cents)')
    .eq('restaurant_id', restaurantId)
    .eq('status', 'active')
    .maybeSingle();

  if (existingSub) {
    warn(`Suscripción activa ya existe (ID: ${existingSub.id}) — se omite`);
  } else {
    // Look up plan by plan_code='negocio'
    const { data: plan } = await svc.from('plans')
      .select('id, name, price_cents, max_products')
      .eq('plan_code', 'negocio')
      .eq('is_active', true)
      .maybeSingle();

    if (!plan) {
      warn('Plan "negocio" no encontrado en BD — suscripción sin asignar. Asignar manualmente en /admin.');
    } else {
      if (!DRY_RUN) {
        const { data: sub, error: subErr } = await svc.from('subscriptions').insert({
          restaurant_id: restaurantId,
          plan_id:       plan.id,
          status:        'active',
          starts_at:     new Date().toISOString(),
          ends_at:       null,  // sin fecha de vencimiento automática
          notes:         `${plan.name} US$${plan.price_cents / 100}/mes · hasta ${plan.max_products} productos · alta importación`,
        }).select('id').single();
        if (subErr) err(`Suscripción: ${subErr.message}`);
        else ok(`Suscripción creada: ${sub.id} (${plan.name} · $${plan.price_cents / 100}/mes · ${plan.max_products} prods.)`);
      } else {
        info(`[dry-run] INSERT subscriptions plan=${plan.name}`);
      }
    }
  }

  // ── 5. Categorías ──────────────────────────────────────────────────────────
  log('5. Categorías...');
  const categoryMap = {};

  for (const cat of CATEGORIES) {
    const { data: existingCat } = await svc.from('categories')
      .select('id').eq('restaurant_id', restaurantId).eq('name', cat.name).maybeSingle();

    if (existingCat) {
      skip(`Categoría "${cat.name}" ya existe (${existingCat.id})`);
      categoryMap[cat.name] = existingCat.id;
    } else {
      if (!DRY_RUN) {
        const { data: c, error } = await svc.from('categories').insert({
          restaurant_id: restaurantId,
          name:          cat.name,
          position:      cat.position,
          is_active:     true,
        }).select('id').single();
        if (error) { err(`Categoría "${cat.name}": ${error.message}`); continue; }
        ok(`Categoría "${cat.name}": ${c.id}`);
        categoryMap[cat.name] = c.id;
      } else {
        info(`[dry-run] INSERT categories name="${cat.name}"`);
        categoryMap[cat.name] = `dry-run-cat-${cat.position}`;
      }
    }
  }

  // ── 6. Productos + imágenes ────────────────────────────────────────────────
  log('6. Productos (15 fichas, todas en borrador)...');
  const manifest = [];

  for (const p of PRODUCTS) {
    const categoryId = categoryMap[p.category];
    if (!categoryId) { err(`Sin categoría para "${p.name}"`); continue; }

    // Idempotency: look up by name
    const { data: existingP } = await svc.from('products')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .eq('name', p.name)
      .is('deleted_at', null)
      .maybeSingle();

    let productId;

    if (!DRY_RUN) {
      const { data: pid, error: rpcErr } = await svc.rpc('upsert_product_admin', {
        p_restaurant_id: restaurantId,
        p_product: {
          id:               existingP?.id ?? null,
          category_id:      categoryId,
          name:             p.name,
          description:      p.description || null,
          base_price_cents: p.base_price_cents,
          is_published:     false,
          is_available:     p.is_available,
          image_fit:        p.image_fit,
          position:         p.position,
        },
        p_variants:      [],
        p_option_groups: [],
      });

      if (rpcErr) { err(`Producto "${p.name}": ${rpcErr.message}`); continue; }
      productId = pid;

      if (existingP) warn(`"${p.name}" actualizado (${productId})`);
      else           ok(`"${p.name}": ${productId}`);

      // Imagen
      const imgPath = await ensureProductImage(productId, restaurantId, p);
      manifest.push({
        stableKey:    p.stableKey,
        name:         p.name,
        category:     p.category,
        productId,
        imageFile:    p.image_file,
        imageUploaded: imgPath !== null,
        isPublished:  false,
        isAvailable:  p.is_available,
        basePrice:    p.base_price_cents,
        notes:        p.stableKey === 'ds-02'
          ? 'BORRADOR ESPECIAL: foto frontal pendiente de validación. Doble bloqueo: is_published=false + is_available=false.'
          : p.base_price_cents === null
          ? 'Precio y talla pendientes de confirmar con propietaria.'
          : p.category === 'Capas'
          ? 'Precio y talla pendientes de confirmar con propietaria.'
          : '',
      });
    } else {
      const imgLocalPath = join(p.image_dir, p.image_file);
      info(`[dry-run] upsert_product_admin name="${p.name}" category="${p.category}"`);
      info(`  imagen: ${existsSync(imgLocalPath) ? '✓ encontrada' : '✗ NO encontrada'} — ${imgLocalPath}`);
      manifest.push({
        stableKey:    p.stableKey,
        name:         p.name,
        category:     p.category,
        imageFile:    p.image_file,
        imageUploaded: existsSync(imgLocalPath),
        isPublished:  false,
        isAvailable:  p.is_available,
        basePrice:    p.base_price_cents,
        notes: p.stableKey === 'ds-02'
          ? 'BORRADOR ESPECIAL: foto frontal pendiente. Doble bloqueo.'
          : p.base_price_cents === null
          ? 'Precio y talla pendientes.'
          : '',
      });
    }
  }

  // ── 7. Propietaria (solo verificación, sin escritura) ─────────────────────
  log('7. Verificación de cuenta propietaria...');
  const OWNER_EMAIL = 'Danash.hidalgo@gmail.com';

  if (!DRY_RUN) {
    // Supabase Auth admin.listUsers is paginated; usamos page 1 con perPage=1000
    // para buscar el email. No se envía ninguna invitación.
    let ownerFound = false;
    try {
      let page = 1;
      const perPage = 1000;
      outer:
      while (true) {
        const { data: { users }, error: listErr } = await svc.auth.admin.listUsers({ page, perPage });
        if (listErr) { warn(`No se pudo verificar la cuenta: ${listErr.message}`); break; }
        for (const u of users) {
          if (u.email?.toLowerCase() === OWNER_EMAIL.toLowerCase()) {
            ownerFound = true;
            info(`Cuenta encontrada: ${u.id} — ir a /admin/restaurants/${restaurantId} para vincular`);
            break outer;
          }
        }
        if (users.length < perPage) break;
        page++;
      }
      if (!ownerFound) {
        warn(`No se encontró cuenta para ${OWNER_EMAIL} — crear manualmente en /admin antes de entregar el acceso.`);
      }
    } catch (e) {
      warn(`Verificación de cuenta omitida: ${e.message}`);
    }
  } else {
    info(`[dry-run] verificación de ${OWNER_EMAIL} omitida`);
  }

  // ── 8. Resumen ─────────────────────────────────────────────────────────────
  log('\n╔══ RESUMEN DANASH SHOP ══╗');
  log(`Negocio ID     : ${restaurantId}`);
  log(`Slug           : ${BIZ.slug}`);
  log(`URL local      : http://localhost:3000/r/danash-shop`);
  log(`URL prevista   : https://danash-shop.wacatalogo.com/`);
  log(`Admin URL      : http://localhost:3000/admin/restaurants/${restaurantId}`);
  log(`Panel URL      : http://localhost:3000/panel`);

  if (!DRY_RUN) {
    const { count: prodCount } = await svc.from('products')
      .select('*', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId).is('deleted_at', null);
    const { count: imgCount } = await svc.from('product_images')
      .select('*', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId);
    log(`Productos en BD: ${prodCount}/15`);
    log(`Imágenes en BD : ${imgCount}/14 (imagen 02 en 03-revision/ — pendiente)`);
  }

  log('\nTabla de fichas:');
  log('  Clave'.padEnd(10) + 'Nombre'.padEnd(38) + 'Categoría'.padEnd(14) + 'Precio ref.'.padEnd(13) + 'Avail.  Notas');
  log('  ' + '─'.repeat(100));
  for (const m of manifest) {
    const precio  = m.basePrice != null ? `$${(m.basePrice / 100).toFixed(0)}` : '—';
    const avail   = m.isAvailable === false ? 'NO' : 'sí';
    const imgMark = m.imageUploaded === false ? ' [sin img]' : '';
    log(`  ${m.stableKey.padEnd(8)} ${m.name.padEnd(36)} ${m.category.padEnd(12)} ${precio.padEnd(13)} ${avail.padEnd(6)}  ${(m.notes ?? '') + imgMark}`);
  }

  log('\n⚠️  PENDIENTES CONFIRMADOS:');
  log('  1. MONEDA de venta (USD/VES/otro) — sin confirmar → NINGÚN producto publicado.');
  log('  2. TALLA de cárdigans — sin confirmar.');
  log('  3. PRECIO y TALLA de capas — sin confirmar.');
  log('  4. FOTO FRONTAL de Cárdigan Rojo Sonrisa (ds-02) — imagen IA reconstruida en 03-revision/.');
  log('  5. LOGO original — carpeta 01-marca/ no encontrada; pendiente aportarlo.');
  log('  6. CUENTA propietaria — vincular Danash.hidalgo@gmail.com en /admin.');
  log('  7. VALIDACIÓN visual de las 14 fotos retocadas con IA por la propietaria.');
  log('  8. DNS *.wacatalogo.com — pendiente según ESTADO.md para que el subdominio resuelva.');
  log('  9. Migración 046 (header_gradient) — aplicar en BD antes de usar gradiente personalizado.');
  log('\n✅ Importación completada. Verifica en http://localhost:3000/r/danash-shop\n');

  // ── 9. Manifest JSON ───────────────────────────────────────────────────────
  if (!DRY_RUN) {
    const __dir = dirname(fileURLToPath(import.meta.url));
    const manifestPath = join(__dir, '..', 'docs', 'danash-shop-import-manifest.json');
    const manifestData = {
      negocio:        'Danash Shop',
      slug:           BIZ.slug,
      restaurantId,
      importado:      new Date().toISOString().slice(0, 10),
      estado:         'active',
      moneda:         'USD (PENDIENTE confirmar con propietaria)',
      modoInicial:    'solo_catalogo',
      whatsapp:       CONFIG.whatsapp,
      instagram:      CONFIG.instagram_url,
      colores: {
        primary_color:    CONFIG.primary_color,
        background_color: CONFIG.background_color,
        secondary_color:  CONFIG.secondary_color,
      },
      tipografia:     CONFIG.font_family,
      logo:           'PENDIENTE — carpeta 01-marca/ no encontrada',
      propietaria:    `${OWNER_EMAIL} — vincular manualmente en /admin`,
      url_local:      `http://localhost:3000/r/danash-shop`,
      url_prevista:   `https://danash-shop.wacatalogo.com/`,
      categorias:     CATEGORIES.length,
      productos_total: PRODUCTS.length,
      productos_publicados: 0,
      productos_borrador:   PRODUCTS.length,
      pendientes: [
        'Moneda de venta (USD/VES/otro)',
        'Talla de cárdigans',
        'Precio y talla de capas',
        'Foto frontal Cárdigan Rojo Sonrisa (ds-02) — IA reconstruida',
        'Logo original (01-marca/)',
        'Vincular cuenta propietaria Danash.hidalgo@gmail.com',
        'Validación visual de las 14 fotos por la propietaria',
        'DNS *.wacatalogo.com',
        'Migración 046 (header_gradient)',
      ],
      fichas: manifest.map(m => ({
        stableKey:   m.stableKey,
        nombre:      m.name,
        categoria:   m.category,
        precioRef:   m.basePrice,
        disponible:  m.isAvailable,
        publicado:   false,
        imagenFile:  m.imageFile,
        imagenSubida: m.imageUploaded,
        notas:       m.notes || null,
        productId:   m.productId || null,
      })),
    };
    writeFileSync(manifestPath, JSON.stringify(manifestData, null, 2));
    ok(`Manifiesto guardado: docs/danash-shop-import-manifest.json`);
  }
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
