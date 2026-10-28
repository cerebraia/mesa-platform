/**
 * seed-luale-shop.ts
 * Importa Luale Shop (tienda de ropa infantil) como negocio real en Mesa.
 *
 * Fuente: https://www.lualeshop.com/
 * Catálogo verificado: 26/10/2026
 *   Bebés   29 productos
 *   Niñas    7 productos
 *   Niños    8 productos
 *   Juguetes 5 productos
 *   Total   49 productos
 *
 * Modalidad: Solo catálogo (orders_enabled = false)
 * Moneda: EUR (€) — publicada en el sitio; no se convierte
 * Idempotente: puede ejecutarse varias veces sin duplicados.
 *
 * Uso:
 *   npx tsx scripts/seed-luale-shop.ts
 *
 * Requiere en .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import * as fs   from "fs";
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

const SLUG        = "luale-shop";
const OWNER_EMAIL = "lfefl1998@gmail.com";

// Color principal aproximado (pastel pink de marca infantil).
// El propietario puede ajustarlo desde /panel/configuracion.
const BRAND_COLOR = "#F472B6";

// WhatsApp publicado por Luale en el sitio
const BUSINESS_WA = "+584220162748";

// Logo en el sitio de Luale
const LOGO_URL = "https://www.lualeshop.com/logo.jpg";

// ── Catálogo de productos ─────────────────────────────────────────────────────
//
// stable_key = URL del producto en la fuente (sirve para idempotencia)
// price_eur  = precio publicado (EUR); se almacena como centavos
// image_src  = URL de la imagen principal en el sitio original
//   · Imágenes locales: https://www.lualeshop.com/images/products/luale-NNN-slug.webp
//   · Imágenes Supabase: https://rbldtmdxhzvpksdrjiju.supabase.co/... (instancia de Luale)
// available  = true → "consultar disponibilidad"; false → publicado en el sitio como agotado

const PRODUCTS_DEF = [
  // ─────────── BEBÉS (29) ───────────
  {
    stable_key: "https://www.lualeshop.com/producto/chaqueta-denim-con-parches",
    name:        "Chaqueta Denim con Parches",
    category:    "Bebés",
    description: "Chaqueta de mezclilla con parches bordados de corazones y estrellas. Perfecta para el frío sin sacrificar el estilo. Talla de referencia: 2 años. Consultar disponibilidad por WhatsApp.",
    price_eur:   25.00,
    position:    0,
    image_src:   "https://www.lualeshop.com/images/products/luale-001-chaqueta-denim-con-parches.webp",
    image_ext:   "webp",
    available:   true,
  },
  {
    stable_key: "https://www.lualeshop.com/producto/set-3-piezas-leon",
    name:        "Set 3 Piezas León",
    category:    "Bebés",
    description: "Conjunto de tres piezas con body, pantalón y gorrito con estampado de leoncito. Diseñado especialmente para bebés pequeños. Talla: 6-9 meses.",
    price_eur:   15.00,
    position:    1,
    image_src:   "https://www.lualeshop.com/images/products/luale-002-set-3-piezas-leon.webp",
    image_ext:   "webp",
    available:   true,
  },
  {
    stable_key: "https://www.lualeshop.com/producto/joggers-cargo-estampados",
    name:        "Joggers Cargo Estampados",
    category:    "Bebés",
    description: "Joggers estilo cargo con estampados divertidos para bebés. Cintura elástica ajustable para mayor comodidad. Talla: 2-3 años.",
    price_eur:   12.00,
    position:    2,
    image_src:   "https://www.lualeshop.com/images/products/luale-004-joggers-cargo-estampados.webp",
    image_ext:   "webp",
    available:   true,
  },
  {
    stable_key: "https://www.lualeshop.com/producto/set-leggings-basicos",
    name:        "Set Leggings Básicos",
    category:    "Bebés",
    description: "Leggings básicos para bebés en colores neutros. Súper elásticos y cómodos para todo el día. Talla: 3-6 meses. Precio desde €8 la unidad.",
    price_eur:   8.00,
    position:    3,
    image_src:   "https://www.lualeshop.com/images/products/luale-005-set-leggings-basicos.webp",
    image_ext:   "webp",
    available:   true,
  },
  {
    stable_key: "https://www.lualeshop.com/producto/medias-con-olan-tonos-neutros",
    name:        "Medias con Olán Tonos Neutros",
    category:    "Bebés",
    description: "Medias con olán en tonos neutros para bebés. Set de 5 pares. Adorables y muy suaves para los pies pequeñitos. Talla: 1-2 años.",
    price_eur:   8.00,
    position:    4,
    image_src:   "https://www.lualeshop.com/images/products/luale-006-medias-con-olan-tonos-neutros.webp",
    image_ext:   "webp",
    available:   true,
  },
  {
    stable_key: "https://www.lualeshop.com/producto/medias-con-lazo-colores-pastel",
    name:        "Medias con Lazo Colores Pastel",
    category:    "Bebés",
    description: "Medias con lazo en colores pastel para bebés. Perfectas para complementar cualquier outfit. Talla: 1-3 años. Desde €5 por par o €8 el set de 5 pares.",
    price_eur:   5.00,
    position:    5,
    image_src:   "https://www.lualeshop.com/images/products/luale-007-medias-con-lazo-colores-pastel.webp",
    image_ext:   "webp",
    available:   true,
  },
  {
    stable_key: "https://www.lualeshop.com/producto/medias-basicas",
    name:        "Medias Básicas",
    category:    "Bebés",
    description: "Medias básicas para bebés en colores lisos. Cómodas, duraderas y muy versátiles. Talla: 2-3 años. Desde €5 por par o €8 el set de 5 pares.",
    price_eur:   5.00,
    position:    6,
    image_src:   "https://www.lualeshop.com/images/products/luale-008-medias-basicas.webp",
    image_ext:   "webp",
    available:   true,
  },
  {
    stable_key: "https://www.lualeshop.com/producto/medias-smile-tonos-neutros",
    name:        "Medias Smile Tonos Neutros",
    category:    "Bebés",
    description: "Medias con estampado de smile en tonos neutros para bebés. Alegres y cómodas para los más pequeños. Talla: 2-3 años. Desde €5 por par o €8 el set de 5 pares.",
    price_eur:   5.00,
    position:    7,
    image_src:   "https://www.lualeshop.com/images/products/luale-009-medias-smile-tonos-neutros.webp",
    image_ext:   "webp",
    available:   true,
  },
  {
    stable_key: "https://www.lualeshop.com/producto/pijamas-enterizas-estampadas",
    name:        "Pijamas Enterizas Estampadas",
    category:    "Bebés",
    description: "Pijama enteriza con estampados dulces y cierre de botones a presión para cambios fáciles. Suave y acogedora para las noches de bebé. Talla: 9-12 meses.",
    price_eur:   20.00,
    position:    8,
    image_src:   "https://rbldtmdxhzvpksdrjiju.supabase.co/storage/v1/object/public/product-images/products/bb2f1835-c783-402f-afc5-e7ea546028c4/efed9aaa-ddec-4cd8-95f5-d4018f2dbb51.webp",
    image_ext:   "webp",
    available:   true,
  },
  {
    stable_key: "https://www.lualeshop.com/producto/pijamas-enterizas-transportes",
    name:        "Pijamas Enterizas Transportes",
    category:    "Bebés",
    description: "Pijama enteriza con estampado de transportes para bebés. Botones a presión para cambios fáciles en la noche. Talla: 9-12 meses.",
    price_eur:   20.00,
    position:    9,
    image_src:   "https://www.lualeshop.com/images/products/luale-012-pijamas-enterizas-transportes.webp",
    image_ext:   "webp",
    available:   true,
  },
  {
    stable_key: "https://www.lualeshop.com/producto/pijamas-2-piezas-dinosaurios",
    name:        "Pijamas 2 Piezas Dinosaurios",
    category:    "Bebés",
    description: "Pijama de dos piezas con estampado de dinosaurios. Divertida y cómoda para las noches de aventura. Talla: 4 años.",
    price_eur:   25.00,
    position:    10,
    image_src:   "https://www.lualeshop.com/images/products/luale-013-pijamas-2-piezas-dinosaurios.webp",
    image_ext:   "webp",
    available:   true,
  },
  {
    stable_key: "https://www.lualeshop.com/producto/sets-leggings-blanco-y-negro",
    name:        "Sets Leggings Blanco y Negro",
    category:    "Bebés",
    description: "Set de leggings en blanco y negro para bebés. Básicos esenciales que combinan con todo. Talla: 9-13 meses.",
    price_eur:   25.00,
    position:    11,
    image_src:   "https://www.lualeshop.com/images/products/luale-014-sets-leggings-blanco-y-negro.webp",
    image_ext:   "webp",
    available:   true,
  },
  {
    stable_key: "https://www.lualeshop.com/producto/vestido-gris-con-blusa",
    name:        "Vestido Gris con Blusa",
    category:    "Bebés",
    description: "Conjunto de vestido gris con blusa. Un look elegante y cómodo para ocasiones especiales. Talla: 9-12 meses. Agotado — consultar disponibilidad por WhatsApp.",
    price_eur:   20.00,
    position:    12,
    image_src:   "https://www.lualeshop.com/images/products/luale-015-vestido-gris-con-blusa.webp",
    image_ext:   "webp",
    available:   false,
  },
  {
    stable_key: "https://www.lualeshop.com/producto/rompers-florales-modelo-1",
    name:        "Rompers Florales Modelo 1",
    category:    "Bebés",
    description: "Romper floral con estampado de flores vibrantes para bebés. Fresco, fácil de poner y muy tierno. Talla: 6-9 meses. Agotado — consultar disponibilidad por WhatsApp.",
    price_eur:   20.00,
    position:    13,
    image_src:   "https://www.lualeshop.com/images/products/luale-016-rompers-florales-modelo-1.webp",
    image_ext:   "webp",
    available:   false,
  },
  {
    stable_key: "https://www.lualeshop.com/producto/set-rayas-con-cerezas",
    name:        "Set Rayas con Cerezas",
    category:    "Bebés",
    description: "Set de rayas con estampado de cerezas para bebés. Fresco y muy dulce, ideal para los días de verano. Talla: 6-9 meses. Agotado — consultar disponibilidad por WhatsApp.",
    price_eur:   15.00,
    position:    14,
    image_src:   "https://www.lualeshop.com/images/products/luale-017-set-rayas-con-cerezas.webp",
    image_ext:   "webp",
    available:   false,
  },
  {
    stable_key: "https://www.lualeshop.com/producto/rompers-florales-modelo-2",
    name:        "Rompers Florales Modelo 2",
    category:    "Bebés",
    description: "Romper floral en diseño diferente con estampado alegre de flores y tela suave al tacto. Talla: 6-9 meses.",
    price_eur:   30.00,
    position:    15,
    image_src:   "https://www.lualeshop.com/images/products/luale-018-rompers-florales-modelo-2.webp",
    image_ext:   "webp",
    available:   true,
  },
  {
    stable_key: "https://www.lualeshop.com/producto/overol-denim-con-camiseta-bebe",
    name:        "Overol Denim con Camiseta Bebé",
    category:    "Bebés",
    description: "Overol de denim para bebés con camiseta a juego. Tierno y muy cómodo para los más chiquitos. Talla: 6-9 meses. Agotado — consultar disponibilidad por WhatsApp.",
    price_eur:   25.00,
    position:    16,
    image_src:   "https://www.lualeshop.com/images/products/luale-019-overol-denim-con-camiseta-bebe.webp",
    image_ext:   "webp",
    available:   false,
  },
  {
    stable_key: "https://www.lualeshop.com/producto/overol-denim-con-camiseta-infantil",
    name:        "Overol Denim con Camiseta Infantil",
    category:    "Bebés",
    description: "Overol de denim para bebés mayores con camiseta incluida. Estilo casual perfecto para explorar el mundo. Talla: 2-3 años. Agotado — consultar disponibilidad por WhatsApp.",
    price_eur:   25.00,
    position:    17,
    image_src:   "https://www.lualeshop.com/images/products/luale-020-overol-denim-con-camiseta-infantil.webp",
    image_ext:   "webp",
    available:   false,
  },
  {
    stable_key: "https://www.lualeshop.com/producto/sets-tejidos-de-verano",
    name:        "Sets Tejidos de Verano",
    category:    "Bebés",
    description: "Sets tejidos para bebés perfectos para el verano. Frescos y lindos para los días cálidos. Talla: 9-12 meses.",
    price_eur:   20.00,
    position:    18,
    image_src:   "https://www.lualeshop.com/images/products/luale-021-sets-tejidos-de-verano.webp",
    image_ext:   "webp",
    available:   true,
  },
  {
    stable_key: "https://www.lualeshop.com/producto/conjunto-waffle-marron",
    name:        "Conjunto Waffle Marrón",
    category:    "Bebés",
    description: "Conjunto de tela waffle en color marrón para bebés. Suave, cálido y muy elegante para el día a día. Talla: 9-12 meses.",
    price_eur:   25.00,
    position:    19,
    image_src:   "https://www.lualeshop.com/images/products/luale-022-conjunto-waffle-marron.webp",
    image_ext:   "webp",
    available:   true,
  },
  {
    stable_key: "https://www.lualeshop.com/producto/conjunto-waffle-verde",
    name:        "Conjunto Waffle Verde",
    category:    "Bebés",
    description: "Conjunto de tela waffle en color verde para bebés. Fresco, suave y muy tierno para los pequeños. Talla: 6-9 meses.",
    price_eur:   25.00,
    position:    20,
    image_src:   "https://www.lualeshop.com/images/products/luale-023-conjunto-waffle-verde.webp",
    image_ext:   "webp",
    available:   true,
  },
  {
    stable_key: "https://www.lualeshop.com/producto/conjunto-animalitos",
    name:        "Conjunto Animalitos",
    category:    "Bebés",
    description: "Conjunto con estampado de animalitos para bebés. Divertido y adorable para los pequeños exploradores. Talla: 6-9 meses.",
    price_eur:   25.00,
    position:    21,
    image_src:   "https://www.lualeshop.com/images/products/luale-024-conjunto-animalitos.webp",
    image_ext:   "webp",
    available:   true,
  },
  {
    stable_key: "https://www.lualeshop.com/producto/conjuntos-basicos-osito",
    name:        "Conjuntos Básicos Osito",
    category:    "Bebés",
    description: "Conjuntos básicos con estampado de osito para bebés. Suaves, cálidos y perfectos para estar en casa. Talla: 9-12 meses.",
    price_eur:   20.00,
    position:    22,
    image_src:   "https://www.lualeshop.com/images/products/luale-025-conjuntos-basicos-osito.webp",
    image_ext:   "webp",
    available:   true,
  },
  {
    stable_key: "https://www.lualeshop.com/producto/conjunto-mamas-boy",
    name:        "Conjunto Mama",
    category:    "Bebés",
    description: "Conjunto para bebés con estampado especial diseñado con amor. Talla: 12-18 meses.",
    price_eur:   20.00,
    position:    23,
    image_src:   "https://www.lualeshop.com/images/products/luale-026-conjunto-mama.webp",
    image_ext:   "webp",
    available:   true,
  },
  {
    stable_key: "https://www.lualeshop.com/producto/vestido-polo-rosa",
    name:        "Vestido Polo Rosa",
    category:    "Bebés",
    description: "Vestido estilo polo en color rosa con botones delanteros y corte cómodo. Elegante y práctico. Talla: 9-12 meses. Agotado — consultar disponibilidad por WhatsApp.",
    price_eur:   15.00,
    position:    24,
    image_src:   "https://www.lualeshop.com/images/products/luale-027-vestido-polo-rosa.webp",
    image_ext:   "webp",
    available:   false,
  },
  {
    stable_key: "https://www.lualeshop.com/producto/vestido-de-lunares-blanco-y-negro",
    name:        "Vestido de Lunares Blanco y Negro",
    category:    "Bebés",
    description: "Vestido de lunares en blanco y negro para bebés. Clásico y muy elegante para momentos especiales. Talla: 9-12 meses. Agotado — consultar disponibilidad por WhatsApp.",
    price_eur:   15.00,
    position:    25,
    image_src:   "https://www.lualeshop.com/images/products/luale-028-vestido-de-lunares-blanco-y-negro.webp",
    image_ext:   "webp",
    available:   false,
  },
  {
    stable_key: "https://www.lualeshop.com/producto/conjunto-deportivo-oliva",
    name:        "Conjunto Deportivo Oliva",
    category:    "Bebés",
    description: "Conjunto deportivo en color oliva con sudadera y pantalón jogger a juego. Perfecto para bebés activos. Talla: 6-9 meses.",
    price_eur:   25.00,
    position:    26,
    image_src:   "https://www.lualeshop.com/images/products/luale-029-conjunto-deportivo-oliva.webp",
    image_ext:   "webp",
    available:   true,
  },
  {
    stable_key: "https://www.lualeshop.com/producto/medias-altas-con-lazo",
    name:        "Medias Altas con Lazo",
    category:    "Bebés",
    description: "Medias altas con lazo decorativo para bebés. Muy lindas y cálidas para los pies de los más pequeños. Precio por par. Talla: 1-2 años.",
    price_eur:   5.00,
    position:    27,
    image_src:   "https://www.lualeshop.com/images/products/luale-030-medias-altas-con-lazo.webp",
    image_ext:   "webp",
    available:   true,
  },
  {
    stable_key: "https://www.lualeshop.com/producto/sets-waffle-oso-dinosaurio",
    name:        "Sets Waffle Oso Dinosaurio",
    category:    "Bebés",
    description: "Set de tela waffle con bordado de oso o dinosaurio para bebés. Suave, abrigado y muy tierno. Talla: 9-12 meses.",
    price_eur:   15.00,
    position:    28,
    image_src:   "https://www.lualeshop.com/images/products/luale-046-sets-waffle-oso-dinosaurio.webp",
    image_ext:   "webp",
    available:   true,
  },

  // ─────────── NIÑAS (7) ───────────
  {
    stable_key: "https://www.lualeshop.com/producto/set-floral-naranja",
    name:        "Set Floral Naranja",
    category:    "Niñas",
    description: "Set floral en tonos naranja para niñas. Alegre, fresco y perfecto para el verano. Talla: 5 años.",
    price_eur:   25.00,
    position:    0,
    image_src:   "https://rbldtmdxhzvpksdrjiju.supabase.co/storage/v1/object/public/product-images/products/64b0e009-5f19-4b63-9b75-0f82a922d097/b3e0bdbf-0fde-4765-a60f-6cedbbdde24f.webp",
    image_ext:   "webp",
    available:   true,
  },
  {
    stable_key: "https://www.lualeshop.com/producto/set-floral-rosa",
    name:        "Set Floral Rosa",
    category:    "Niñas",
    description: "Delicado set floral con blusa y short estampados en flores sobre fondo rosa. Perfecto para los días de calor. Talla: 4 años.",
    price_eur:   25.00,
    position:    1,
    image_src:   "https://rbldtmdxhzvpksdrjiju.supabase.co/storage/v1/object/public/product-images/products/fb0c845a-d09d-4892-86fb-15e0fbc280af/d6da7f5b-3297-44d3-8319-57319384afc5.webp",
    image_ext:   "webp",
    available:   true,
  },
  {
    stable_key: "https://www.lualeshop.com/producto/vestido-camiseta-parches-crema",
    name:        "Vestido Camiseta Parches Crema",
    category:    "Niñas",
    description: "Vestido tipo camiseta en crema con parches bordados. Dulce y sofisticado para niñas con estilo propio. Talla: 8 años.",
    price_eur:   40.00,
    position:    2,
    image_src:   "https://rbldtmdxhzvpksdrjiju.supabase.co/storage/v1/object/public/product-images/products/5a6a87f0-05be-4669-b06d-d2a5d0e60b9d/a3237b23-f673-4446-a999-1e4321e4109d.webp",
    image_ext:   "webp",
    available:   true,
  },
  {
    stable_key: "https://www.lualeshop.com/producto/set-beach-vibes-rosa",
    name:        "Set Beach Vibes Rosa",
    category:    "Niñas",
    description: "Alegre y veraniego, perfecto para ir a la playa o al parque. Conjunto en color rosa para niñas. Talla: 5 años.",
    price_eur:   40.00,
    position:    3,
    image_src:   "https://rbldtmdxhzvpksdrjiju.supabase.co/storage/v1/object/public/product-images/products/4c860888-a313-4063-9c28-33434c0dd109/319caf19-195d-400f-ab5f-7a04b597f48f.webp",
    image_ext:   "webp",
    available:   true,
  },
  {
    stable_key: "https://www.lualeshop.com/producto/vestido-camiseta-parches-fucsia",
    name:        "Vestido Camiseta Parches Fucsia",
    category:    "Niñas",
    description: "Vestido tipo camiseta en fucsia con parches bordados. Moderno, divertido y fácil de combinar. Talla: 8 años.",
    price_eur:   40.00,
    position:    4,
    image_src:   "https://rbldtmdxhzvpksdrjiju.supabase.co/storage/v1/object/public/product-images/products/a15d4d73-7af3-49e8-acab-a84a6592e15f/6eec703f-16e3-4f99-b5fe-ed08a14b3a12.webp",
    image_ext:   "webp",
    available:   true,
  },
  {
    stable_key: "https://www.lualeshop.com/producto/set-amore-coral",
    name:        "Set AMORE Coral",
    category:    "Niñas",
    description: "Set especial de la colección AMORE para niñas, en color coral. Diseñado con amor y mucho estilo. Talla: 5 años.",
    price_eur:   40.00,
    position:    5,
    image_src:   "https://rbldtmdxhzvpksdrjiju.supabase.co/storage/v1/object/public/product-images/products/d42a7fef-37f9-4acd-8657-ed04ff2deabf/73766730-c21c-440e-ace8-324d80052116.webp",
    image_ext:   "webp",
    available:   true,
  },
  {
    stable_key: "https://www.lualeshop.com/producto/set-amore-gris",
    name:        "Set AMORE Gris",
    category:    "Niñas",
    description: "Set especial de la colección AMORE para niñas, en color gris. Diseñado con amor y mucho estilo. Talla: 6 años.",
    price_eur:   40.00,
    position:    6,
    image_src:   "https://rbldtmdxhzvpksdrjiju.supabase.co/storage/v1/object/public/product-images/products/31dd49bf-d062-48cb-bc13-d4b2affe2886/b1aab387-44b1-4fa8-a05f-a0e7a3486bb6.webp",
    image_ext:   "webp",
    available:   true,
  },

  // ─────────── NIÑOS (8) ───────────
  {
    stable_key: "https://www.lualeshop.com/producto/set-sunset-studios",
    name:        "Set Sunset Studios",
    category:    "Niños",
    description: "Set con diseño Sunset Studios para niños. Estilo juvenil y cómodo para el día a día. Talla: 8 años. Agotado — consultar disponibilidad por WhatsApp.",
    price_eur:   40.00,
    position:    0,
    image_src:   "https://www.lualeshop.com/images/products/luale-033-set-sunset-studios.webp",
    image_ext:   "webp",
    available:   false,
  },
  {
    stable_key: "https://www.lualeshop.com/producto/set-capri-italy",
    name:        "Set Capri Italy",
    category:    "Niños",
    description: "Set con diseño Capri Italy para niños. Estilo italiano relajado, ideal para paseos y tiempo libre. Talla: 5 años.",
    price_eur:   35.00,
    position:    1,
    image_src:   "https://www.lualeshop.com/images/products/luale-034-set-capri-italy.webp",
    image_ext:   "webp",
    available:   true,
  },
  {
    stable_key: "https://www.lualeshop.com/producto/conjunto-tie-dye",
    name:        "Conjunto Tie-Dye",
    category:    "Niños",
    description: "Conjunto tie-dye para niños. Vibrante y único, perfecto para niños que quieren destacar con estilo. Talla: 6 años.",
    price_eur:   40.00,
    position:    2,
    image_src:   "https://www.lualeshop.com/images/products/luale-035-conjunto-tie-dye.webp",
    image_ext:   "webp",
    available:   true,
  },
  {
    stable_key: "https://www.lualeshop.com/producto/set-polo-oakland-celeste",
    name:        "Set Polo Oakland Celeste",
    category:    "Niños",
    description: "Set estilo preppy con polo en celeste y bermuda a juego. Versátil y muy bien combinado para niños. Talla: 5 años.",
    price_eur:   35.00,
    position:    3,
    image_src:   "https://www.lualeshop.com/images/products/luale-036-set-polo-oakland-celeste.webp",
    image_ext:   "webp",
    available:   true,
  },
  {
    stable_key: "https://www.lualeshop.com/producto/set-polo-oakland-azul",
    name:        "Set Polo Oakland Azul",
    category:    "Niños",
    description: "Set estilo preppy con polo en azul y bermuda a juego. Un look clásico y versátil para niños. Talla: 5 años.",
    price_eur:   35.00,
    position:    4,
    image_src:   "https://www.lualeshop.com/images/products/luale-037-set-polo-oakland-azul.webp",
    image_ext:   "webp",
    available:   true,
  },
  {
    stable_key: "https://www.lualeshop.com/producto/hoodie-blanco-jogger-gris",
    name:        "Hoodie Blanco + Jogger Gris",
    category:    "Niños",
    description: "Hoodie blanco con jogger gris para niños. Cómodo, abrigado y muy a la moda para días frescos. Talla: 6 años.",
    price_eur:   40.00,
    position:    5,
    image_src:   "https://www.lualeshop.com/images/products/luale-038-hoodie-blanco-jogger-gris.webp",
    image_ext:   "webp",
    available:   true,
  },
  {
    stable_key: "https://www.lualeshop.com/producto/hoodie-crema-jogger-vino",
    name:        "Hoodie Crema + Jogger Vino",
    category:    "Niños",
    description: "Hoodie crema con jogger vino para niños. Combinación elegante y cálida para el otoño. Talla: 4 años.",
    price_eur:   40.00,
    position:    6,
    image_src:   "https://www.lualeshop.com/images/products/luale-039-hoodie-crema-jogger-vino.webp",
    image_ext:   "webp",
    available:   true,
  },
  {
    stable_key: "https://www.lualeshop.com/producto/set-camiseta-pantalon-verde",
    name:        "Set Camiseta + Pantalón Verde",
    category:    "Niños",
    description: "Set de camiseta con pantalón en verde para niños. Fresco y muy cómodo para el verano. Talla: 4 años.",
    price_eur:   40.00,
    position:    7,
    image_src:   "https://rbldtmdxhzvpksdrjiju.supabase.co/storage/v1/object/public/product-images/products/5c2d8794-9c8e-4d6b-82a7-61f65dee3441/2d16c34c-e423-4810-8bbd-7bfff2a4d7c7.webp",
    image_ext:   "webp",
    available:   true,
  },

  // ─────────── JUGUETES (5) ───────────
  {
    stable_key: "https://www.lualeshop.com/producto/juego-de-clasificacion",
    name:        "Juego de Clasificación",
    category:    "Juguetes",
    description: "Juego educativo de clasificación por colores y formas. Incluye animales y cuencos de colores. Desarrolla la motricidad fina y el reconocimiento de colores.",
    price_eur:   20.00,
    position:    0,
    image_src:   "https://rbldtmdxhzvpksdrjiju.supabase.co/storage/v1/object/public/product-images/products/03c243e6-e0bb-4713-8e87-adb7aef4ed7c/014d409f-3137-49da-8501-1b200d3b338f.webp",
    image_ext:   "webp",
    available:   true,
  },
  {
    stable_key: "https://www.lualeshop.com/producto/piezas-magneticas",
    name:        "Piezas Magnéticas",
    category:    "Juguetes",
    description: "Set de piezas magnéticas geométricas multicolor. Permiten construir estructuras en 2D y 3D desarrollando creatividad y pensamiento espacial.",
    price_eur:   20.00,
    position:    1,
    image_src:   "https://rbldtmdxhzvpksdrjiju.supabase.co/storage/v1/object/public/product-images/products/4020db37-1f6b-439f-908f-8dbb17322a2a/5e6ab605-00ca-4f0b-83b6-eab57b7a4b3d.webp",
    image_ext:   "webp",
    available:   true,
  },
  {
    stable_key: "https://www.lualeshop.com/producto/tableros-de-encaje-educativo",
    name:        "Tableros de Encaje Educativo",
    category:    "Juguetes",
    description: "Set de tableros de encaje con letras, números y figuras geométricas. Fomentan el reconocimiento visual y el desarrollo cognitivo.",
    price_eur:   10.00,
    position:    2,
    image_src:   "https://rbldtmdxhzvpksdrjiju.supabase.co/storage/v1/object/public/product-images/products/68be3586-2087-4ce9-a236-4d6b6639a54e/7ebb4f24-a707-4dde-874d-2f068055d6fa.webp",
    image_ext:   "webp",
    available:   true,
  },
  {
    stable_key: "https://www.lualeshop.com/producto/busy-book",
    name:        "Busy Book",
    category:    "Juguetes",
    description: "Libro interactivo con actividades sensoriales y páginas desmontables. Estimula la creatividad, la concentración y las habilidades motoras.",
    price_eur:   15.00,
    position:    3,
    image_src:   "https://rbldtmdxhzvpksdrjiju.supabase.co/storage/v1/object/public/product-images/products/4d26a031-c4f4-430c-b8ea-6261f77605a6/4a19748e-b742-49c1-a29c-a827f2ed05d1.webp",
    image_ext:   "webp",
    available:   true,
  },
  {
    stable_key: "https://www.lualeshop.com/producto/puzzle-my-world",
    name:        "Puzzle My World",
    category:    "Juguetes",
    description: "Set de puzzles temáticos (animales, transporte, frutas) con piezas grandes y coloridas. Desarrolla la lógica espacial y la coordinación.",
    price_eur:   10.00,
    position:    4,
    image_src:   "https://rbldtmdxhzvpksdrjiju.supabase.co/storage/v1/object/public/product-images/products/bfdd8b5b-df4c-4d29-897a-688e575ea345/5265f578-d184-48e8-8724-31ac7de5b8f4.webp",
    image_ext:   "webp",
    available:   true,
  },
] as const;

const CATEGORY_ORDER: Record<string, number> = {
  "Bebés":    0,
  "Niñas":    1,
  "Niños":    2,
  "Juguetes": 3,
};

// ── 1. Usuario propietario ────────────────────────────────────────────────────

async function ensureOwnerUser(): Promise<string> {
  const { data: listData } = await sb.auth.admin.listUsers({ perPage: 100 });
  const existing = listData?.users?.find(u => u.email === OWNER_EMAIL);
  if (existing) {
    ok(`Usuario existente: ${OWNER_EMAIL} (${existing.id})`);
    return existing.id;
  }

  const tempPassword = `LualeShop${Date.now()}!`;
  const { data, error } = await sb.auth.admin.createUser({
    email:         OWNER_EMAIL,
    password:      tempPassword,
    email_confirm: true,
  });
  if (error || !data.user) {
    console.error("Error creando usuario:", error?.message); process.exit(1);
  }
  ok(`Usuario creado: ${OWNER_EMAIL} (${data.user.id})`);
  warn(`Contraseña temporal: ${tempPassword} — cambiar desde /login`);
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
    name:     "Luale Shop",
    slug:     SLUG,
    currency: "EUR",
    timezone: "America/Caracas",
    status:   "active",
  }).select("id").single();
  if (error) { console.error("Error creando negocio:", error.message); process.exit(1); }
  ok(`Negocio creado: luale-shop (${data.id})`);
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
  ok(`Membresía owner asignada: ${OWNER_EMAIL} → luale-shop`);
}

// ── 4. Configuración del negocio ───────────────────────────────────────────────

async function seedConfig(restaurantId: string) {
  const { error } = await sb.from("restaurant_config").upsert({
    restaurant_id:         restaurantId,
    description:           "Más que ropa, es amor en cada detalle. Ropa infantil seleccionada para bebés, niñas y niños. Delivery en Caracas y envíos nacionales.",
    primary_color:         BRAND_COLOR,
    phone:                 "+584220162748",
    whatsapp:              BUSINESS_WA,
    instagram_url:         "https://www.instagram.com/lualekids.shop/",
    pickup_enabled:        false,
    delivery_enabled:      false,
    is_temporarily_closed: false,
    closed_message:        null,
    orders_enabled:        false,
  }, { onConflict: "restaurant_id" });
  if (error) { console.error("Error en config:", error.message); process.exit(1); }
  ok(`Config guardada — Solo catálogo, WhatsApp ${BUSINESS_WA}, color ${BRAND_COLOR}`);
}

// ── 5. Horarios ────────────────────────────────────────────────────────────────

async function seedHours(restaurantId: string) {
  await sb.from("business_hours").delete().eq("restaurant_id", restaurantId);
  // Lunes–Sábado 09:00–18:00 (estimado; verificar con la tienda)
  const rows = [1,2,3,4,5,6].map(d => ({
    restaurant_id: restaurantId,
    day_of_week:   d,
    opens_at:      "09:00:00",
    closes_at:     "18:00:00",
    is_active:     true,
  }));
  const { error } = await sb.from("business_hours").insert(rows);
  if (error) { console.error("Error en horarios:", error.message); process.exit(1); }
  ok("Horarios: lunes–sábado 09:00–18:00 (estimado; verificar con la tienda)");
}

// ── 6. Categorías ──────────────────────────────────────────────────────────────

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

// ── 7. Productos ──────────────────────────────────────────────────────────────

async function upsertProduct(
  restaurantId: string,
  catId: string,
  def: typeof PRODUCTS_DEF[number],
): Promise<string> {
  const { data: existing } = await sb.from("products")
    .select("id").eq("restaurant_id", restaurantId).eq("name", def.name).maybeSingle();

  const price_cents = Math.round(def.price_eur * 100);

  if (existing) {
    await sb.from("products").update({
      category_id:      catId,
      description:      def.description,
      base_price_cents: price_cents,
      is_published:     true,
      is_available:     def.available,
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
    is_available:     def.available,
    position:         def.position,
  }).select("id").single();
  if (error) { console.error(`Error en producto ${def.name}:`, error.message); process.exit(1); }
  ok(`Producto creado: ${def.name} (€${def.price_eur})`);
  return data.id as string;
}

// ── 8. Descargar imagen ────────────────────────────────────────────────────────

async function downloadImage(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) { warn(`HTTP ${res.status} al descargar ${url}`); return null; }
    const buf = await res.arrayBuffer();
    return Buffer.from(buf);
  } catch (e) {
    warn(`Error descargando ${url}: ${(e as Error).message}`);
    return null;
  }
}

// ── 9. Subir imagen de producto a Storage ─────────────────────────────────────

async function uploadProductImage(
  restaurantId: string,
  productId: string,
  def: typeof PRODUCTS_DEF[number],
): Promise<string | null> {
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
  const contentType = "image/webp";

  const { error: uploadErr } = await sb.storage
    .from("product-images")
    .upload(storagePath, buf, { contentType, upsert: false });

  if (uploadErr) {
    warn(`Error subiendo imagen ${def.name}: ${uploadErr.message}`);
    return null;
  }

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

// ── 10. Subir logo ─────────────────────────────────────────────────────────────

async function uploadLogo(restaurantId: string) {
  const { data: cfg } = await sb.from("restaurant_config")
    .select("logo_path").eq("restaurant_id", restaurantId).maybeSingle();
  if (cfg?.logo_path) {
    info(`Logo ya existe: ${cfg.logo_path}`);
    return;
  }

  info(`Descargando logo: ${LOGO_URL}`);
  const buf = await downloadImage(LOGO_URL);
  if (!buf) { warn("Logo no disponible — omitido"); return; }

  const storagePath = `${restaurantId}/logo.jpg`;
  const { error: uploadErr } = await sb.storage
    .from("restaurant-assets")
    .upload(storagePath, buf, { contentType: "image/jpeg", upsert: true });

  if (uploadErr) { warn(`Error subiendo logo: ${uploadErr.message}`); return; }

  const { error: updErr } = await sb.from("restaurant_config")
    .update({ logo_path: storagePath })
    .eq("restaurant_id", restaurantId);
  if (updErr) { warn(`Error actualizando logo_path: ${updErr.message}`); return; }

  ok(`Logo subido: ${storagePath}`);
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║   Seed: Luale Shop → Mesa                ║");
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

  step("6. Categorías");
  const catMap: Record<string, string> = {};
  for (const [catName, pos] of Object.entries(CATEGORY_ORDER)) {
    catMap[catName] = await ensureCategory(restaurantId, catName, pos);
  }

  step("7. Productos");
  const productIds: Record<string, string> = {};
  for (const def of PRODUCTS_DEF) {
    const catId = catMap[def.category];
    if (!catId) { warn(`Categoría no encontrada: ${def.category}`); continue; }
    productIds[def.name] = await upsertProduct(restaurantId, catId, def);
  }

  step("8. Imágenes de productos");
  let imagesOk   = 0;
  let imagesFail = 0;
  for (const def of PRODUCTS_DEF) {
    const productId = productIds[def.name];
    if (!productId) continue;
    const result = await uploadProductImage(restaurantId, productId, def);
    if (result) imagesOk++; else imagesFail++;
  }

  step("9. Logo del negocio");
  await uploadLogo(restaurantId);

  // ── Conteo por categoría ──────────────────────────────────────────────────
  const byCategory: Record<string, { total: number; available: number; agotado: number }> = {};
  for (const def of PRODUCTS_DEF) {
    if (!byCategory[def.category]) byCategory[def.category] = { total: 0, available: 0, agotado: 0 };
    byCategory[def.category].total++;
    if (def.available) byCategory[def.category].available++;
    else byCategory[def.category].agotado++;
  }

  const totalProducts  = PRODUCTS_DEF.length;
  const totalAvailable = PRODUCTS_DEF.filter(p => p.available).length;
  const totalAgotado   = PRODUCTS_DEF.filter(p => !p.available).length;

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║   Luale Shop — Importación completada                        ║
╚══════════════════════════════════════════════════════════════╝

Negocio:        Luale Shop
Slug:           luale-shop
Restaurant ID:  ${restaurantId}
Owner:          ${OWNER_EMAIL} (${userId})
Modalidad:      Solo catálogo (orders_enabled = false)
Moneda:         EUR (€)
Color:          ${BRAND_COLOR} (aproximado — ajustar desde /panel/configuracion)
WhatsApp:       ${BUSINESS_WA}
Instagram:      https://www.instagram.com/lualekids.shop/

Catálogo importado:
  ┌─────────────┬───────┬──────────────┬─────────┐
  │ Categoría   │ Total │ Disponibles  │ Agotado │
  ├─────────────┼───────┼──────────────┼─────────┤
  │ Bebés       │  ${String(byCategory["Bebés"]?.total ?? 0).padStart(2)}   │    ${String(byCategory["Bebés"]?.available ?? 0).padStart(2)}        │   ${String(byCategory["Bebés"]?.agotado ?? 0).padStart(2)}    │
  │ Niñas       │   ${String(byCategory["Niñas"]?.total ?? 0).padStart(2)}  │     ${String(byCategory["Niñas"]?.available ?? 0).padStart(2)}        │    ${String(byCategory["Niñas"]?.agotado ?? 0).padStart(2)}   │
  │ Niños       │   ${String(byCategory["Niños"]?.total ?? 0).padStart(2)}  │     ${String(byCategory["Niños"]?.available ?? 0).padStart(2)}        │    ${String(byCategory["Niños"]?.agotado ?? 0).padStart(2)}   │
  │ Juguetes    │   ${String(byCategory["Juguetes"]?.total ?? 0).padStart(2)}  │     ${String(byCategory["Juguetes"]?.available ?? 0).padStart(2)}        │    ${String(byCategory["Juguetes"]?.agotado ?? 0).padStart(2)}   │
  ├─────────────┼───────┼──────────────┼─────────┤
  │ TOTAL       │  ${String(totalProducts).padStart(2)}   │    ${String(totalAvailable).padStart(2)}        │   ${String(totalAgotado).padStart(2)}    │
  └─────────────┴───────┴──────────────┴─────────┘

Imágenes:       ${imagesOk} OK, ${imagesFail} fallidas

Plan de prueba: Mesa Inicio (50 productos máx.) — ${totalProducts}/50 utilizados.
  Si la migración 023 no está aplicada en la BD, no hay límite activo.

Notas:
  · Tallas publicadas como referencia informativa (el comprador consulta disponibilidad por WA)
  · 9 productos agotados al momento de la extracción (is_available=false, is_published=true)
  · Color del negocio es aproximado; verificar con la marca y ajustar desde el panel
  · Horarios son estimados; verificar con Luale
  · El sitio no publica TikTok, Facebook ni email de contacto
  · Imágenes procedentes de 2 fuentes: sitio Luale y su Supabase (rbldtmdxhzvpksdrjiju)

URLs locales:
  Catálogo público: http://localhost:3001/r/luale-shop
  Panel (owner):    http://localhost:3001/panel
                    (ingresar como ${OWNER_EMAIL})
`);
}

main().catch(e => { console.error(e); process.exit(1); });
