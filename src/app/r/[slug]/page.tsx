import { notFound } from "next/navigation";
import { createServerClient as createSsrClient } from "@supabase/ssr";
import type { Metadata } from "next";
import type {
  PublicCategory,
  PublicProduct,
  PublicProductVariant,
  PublicOptionGroup,
  PublicOption,
  PublicProductImage,
  PublicRestaurantConfig,
  PublicDeliveryZone,
  PublicPaymentMethod,
  BusinessOpenStatus,
} from "@/lib/catalog-types";
import { getRestaurantCanonical, getPlatformBase } from "@/lib/canonical";
import { PublicMenuClient } from "./public-menu-client";

// Creates an anonymous Supabase client (no session cookie).
// RLS restricts reads to active restaurants and published content.
// Column-level grants (migration 009) further limit what anon can read:
// no timestamps, no is_active/is_published/is_available flags, no timezone.
function createAnonClient() {
  return createSsrClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );
}

// Row types as returned by the anon query (only public columns).
type AnonProductImage = Pick<PublicProductImage, "id" | "product_id" | "restaurant_id" | "storage_path" | "thumbnail_path" | "alt_text" | "position">;
type AnonVariant = Pick<PublicProductVariant, "id" | "product_id" | "restaurant_id" | "name" | "price_cents" | "position">;
type AnonOption = Pick<PublicOption, "id" | "option_group_id" | "restaurant_id" | "name" | "price_delta_cents" | "position">;
type AnonOptionGroup = Pick<PublicOptionGroup, "id" | "product_id" | "restaurant_id" | "name" | "min_selections" | "max_selections" | "position"> & { options: AnonOption[] };
type AnonProduct = Pick<PublicProduct, "id" | "restaurant_id" | "category_id" | "name" | "description" | "base_price_cents" | "promo_price_cents" | "position" | "image_fit"> & {
  product_images: AnonProductImage[];
  product_variants: AnonVariant[];
  option_groups: AnonOptionGroup[];
};
type AnonCategory = { id: string; restaurant_id: string; name: string; position: number; products: AnonProduct[] };

// ── SEO metadata ─────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase  = createAnonClient();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const assetBase   = `${supabaseUrl}/storage/v1/object/public/restaurant-assets`;

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id, name, slug, status")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  if (!restaurant) return { title: "Catálogo — Wacatalog", robots: { index: false } };

  type MetaConfig = {
    description: string | null; logo_path: string | null; cover_path: string | null;
    seo_title: string | null;   seo_description: string | null;
    seo_image_path: string | null; allow_indexing: boolean | null;
  };
  const { data: config } = await supabase
    .from("restaurant_config")
    .select(
      "description, logo_path, cover_path, " +
      "seo_title, seo_description, seo_image_path, allow_indexing",
    )
    .eq("restaurant_id", restaurant.id)
    .maybeSingle<MetaConfig>();

  // Active custom domain for canonical
  const { data: domainRow } = await supabase
    .from("restaurant_domains")
    .select("host")
    .eq("restaurant_id", restaurant.id)
    .eq("status", "active")
    .maybeSingle();
  const activeDomain = domainRow?.host ?? null;

  const canonical  = getRestaurantCanonical(slug, activeDomain);
  const allowIndex = config?.allow_indexing ?? true;
  const title      = config?.seo_title?.trim()       || restaurant.name;
  const description = config?.seo_description?.trim() || config?.description?.trim() || null;

  const ogImgPath = config?.seo_image_path ?? config?.cover_path ?? null;
  const ogImgUrl  = ogImgPath ? `${assetBase}/${ogImgPath}` : null;
  const logoPath  = config?.logo_path ?? null;
  const logoUrl   = logoPath ? `${assetBase}/${logoPath}` : null;

  const siteName = "Wacatalog";
  const platformBase = getPlatformBase();

  return {
    title,
    ...(description && { description }),
    robots: allowIndex ? { index: true, follow: true } : { index: false, follow: false },
    alternates: { canonical },
    openGraph: {
      title,
      ...(description && { description }),
      url: canonical,
      type:     "website",
      siteName,
      ...(ogImgUrl && { images: [{ url: ogImgUrl, width: 1200, height: 630, alt: restaurant.name }] }),
    },
    twitter: {
      card:  ogImgUrl ? "summary_large_image" : "summary",
      title,
      ...(description && { description }),
      ...(ogImgUrl && { images: [ogImgUrl] }),
    },
    ...(platformBase && {
      metadataBase: new URL(platformBase),
    }),
    other: logoUrl ? { "og:logo": logoUrl } : {},
  };
}

// ── URL validation (server-side) ─────────────────────────────────
// Only accepts http / https. Prepends https:// when the scheme is missing.
// Returns null for blank values, invalid URLs, or non-http(s) schemes
// (javascript:, data:, etc.).
function sanitizeUrl(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const s = raw.trim();
  const withProto = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withProto);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

// ── Page ──────────────────────────────────────────────────────────

export default async function PublicMenuPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = createAnonClient();

  // Fetch restaurant — anon SELECT policy (migration 005): status = 'active'.
  // Column grant (migration 009): id, name, slug, status, currency.
  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id, name, slug, status, currency")
    .eq("slug", slug)
    .maybeSingle();

  if (!restaurant) notFound();

  // Fetch public config and open/closed status in parallel.
  // Column grants (migration 012) restrict anon to non-internal fields only.
  // is_restaurant_open is a SECURITY DEFINER function accessible to anon.
  const [
    { data: config },
    { data: openStatusRaw },
    { data: deliveryZones },
    { data: paymentMethods },
  ] = await Promise.all([
    supabase
      .from("restaurant_config")
      .select(
        "restaurant_id, description, logo_path, cover_path, primary_color, " +
        "background_color, secondary_color, font_family, " +
        "phone, whatsapp, instagram_url, facebook_url, twitter_url, " +
        "address, pickup_enabled, pickup_address, pickup_notes, " +
        "delivery_enabled, is_temporarily_closed, closed_message, orders_enabled",
      )
      .eq("restaurant_id", restaurant.id)
      .maybeSingle<PublicRestaurantConfig>(),
    // get_business_open_status (migration 036): timezone-aware status + close/open time.
    // Returns null when no business hours are configured → UI omits the indicator.
    supabase.rpc("get_business_open_status", { p_restaurant_id: restaurant.id }),
    supabase
      .from("delivery_zones")
      .select("id, restaurant_id, name, fee_cents, minimum_order_cents, position")
      .eq("restaurant_id", restaurant.id)
      .order("position")
      .returns<PublicDeliveryZone[]>(),
    supabase
      .from("payment_methods")
      .select("id, restaurant_id, name, type, position")
      .eq("restaurant_id", restaurant.id)
      .order("position")
      .returns<PublicPaymentMethod[]>(),
  ]);

  const openStatus = (openStatusRaw ?? null) as BusinessOpenStatus | null;
  const isOpen = openStatus?.status === "open";

  // Fetch published categories with products, images, variants and options.
  // Row filtering is entirely done by RLS — no app-level status filters needed.
  // Column selection matches the grants in migration 009 exactly.
  const { data: rawCategories, error } = await supabase
    .from("categories")
    .select(`
      id, restaurant_id, name, position,
      products (
        id, restaurant_id, category_id, name, description,
        base_price_cents, promo_price_cents, position, image_fit,
        product_images ( id, product_id, restaurant_id, storage_path, thumbnail_path, alt_text, position ),
        product_variants ( id, product_id, restaurant_id, name, price_cents, position ),
        option_groups (
          id, product_id, restaurant_id, name, min_selections, max_selections, position,
          options ( id, option_group_id, restaurant_id, name, price_delta_cents, position )
        )
      )
    `)
    .eq("restaurant_id", restaurant.id)
    .order("position", { ascending: true })
    .returns<AnonCategory[]>();

  if (error) {
    throw new Error(`Error al cargar el menú: ${error.message}`);
  }

  // Sort nested arrays by position.
  // RLS already filters: only active categories, published+available products,
  // available variants and options. No application-level status checks needed.
  const categories = (rawCategories ?? []).map((cat) => ({
    ...cat,
    products: (cat.products ?? [])
      .sort((a, b) => a.position - b.position)
      .map((p) => ({
        ...p,
        product_images: (p.product_images ?? []).sort((a, b) => a.position - b.position),
        product_variants: (p.product_variants ?? []).sort((a, b) => a.position - b.position),
        option_groups: (p.option_groups ?? [])
          .sort((a, b) => a.position - b.position)
          .map((g) => ({
            ...g,
            options: (g.options ?? []).sort((a, b) => a.position - b.position),
          })),
      })),
  }));

  // Only show categories that have at least one product returned by RLS.
  const activeCats = categories.filter((c) => c.products.length > 0);

  // orders_enabled: migration 024. Null row (new businesses) defaults to true (backward compat).
  const ordersEnabled = config?.orders_enabled ?? true;

  // Validate and normalise social / contact URLs server-side.
  // WhatsApp is stored as a phone number — construct the wa.me URL here.
  const waDigits = config?.whatsapp?.replace(/\D/g, "") ?? "";
  const socialLinks = {
    instagram: sanitizeUrl(config?.instagram_url),
    facebook:  sanitizeUrl(config?.facebook_url),
    twitter:   sanitizeUrl(config?.twitter_url),
    whatsapp:  waDigits.length >= 7
      ? `https://wa.me/${waDigits}?text=${encodeURIComponent(`Hola, me interesa conocer más sobre ${restaurant.name}`)}`
      : null,
  };

  // Minimal Organization schema — only verified, non-assumed data.
  // Products open in a modal (no per-product URL), so we do NOT add Product markup.
  const supabaseUrl2 = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const assetBase2   = `${supabaseUrl2}/storage/v1/object/public/restaurant-assets`;
  const canonicalUrl = getRestaurantCanonical(restaurant.slug);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type":    "Organization",
    name:       restaurant.name,
    url:        canonicalUrl,
    ...(config?.description && { description: config.description }),
    ...(config?.logo_path    && { logo: `${assetBase2}/${config.logo_path}` }),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PublicMenuClient
        restaurant={restaurant}
        config={config ?? null}
        isOpen={isOpen}
        openStatus={openStatus}
        categories={activeCats}
        deliveryZones={deliveryZones ?? []}
        paymentMethods={paymentMethods ?? []}
        supabaseUrl={supabaseUrl2}
        ordersEnabled={ordersEnabled}
        socialLinks={socialLinks}
      />
    </>
  );
}

// force-dynamic: never share cache across restaurants or publication states.
export const dynamic = "force-dynamic";
