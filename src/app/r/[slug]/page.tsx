import { notFound } from "next/navigation";
import { createServerClient as createSsrClient } from "@supabase/ssr";
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
} from "@/lib/catalog-types";
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
type AnonProductImage = Pick<PublicProductImage, "id" | "product_id" | "restaurant_id" | "storage_path" | "alt_text" | "position">;
type AnonVariant = Pick<PublicProductVariant, "id" | "product_id" | "restaurant_id" | "name" | "price_cents" | "position">;
type AnonOption = Pick<PublicOption, "id" | "option_group_id" | "restaurant_id" | "name" | "price_delta_cents" | "position">;
type AnonOptionGroup = Pick<PublicOptionGroup, "id" | "product_id" | "restaurant_id" | "name" | "min_selections" | "max_selections" | "position"> & { options: AnonOption[] };
type AnonProduct = Pick<PublicProduct, "id" | "restaurant_id" | "category_id" | "name" | "description" | "base_price_cents" | "promo_price_cents" | "position"> & {
  product_images: AnonProductImage[];
  product_variants: AnonVariant[];
  option_groups: AnonOptionGroup[];
};
type AnonCategory = { id: string; restaurant_id: string; name: string; position: number; products: AnonProduct[] };

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
    { data: isOpenRaw },
    { data: deliveryZones },
    { data: paymentMethods },
  ] = await Promise.all([
    supabase
      .from("restaurant_config")
      .select(
        "restaurant_id, description, logo_path, cover_path, primary_color, " +
        "phone, whatsapp, instagram_url, facebook_url, twitter_url, " +
        "address, pickup_enabled, pickup_address, pickup_notes, " +
        "delivery_enabled, is_temporarily_closed, closed_message, orders_enabled",
      )
      .eq("restaurant_id", restaurant.id)
      .maybeSingle<PublicRestaurantConfig>(),
    supabase.rpc("is_restaurant_open", { p_restaurant_id: restaurant.id }),
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

  const isOpen = isOpenRaw === true;

  // Fetch published categories with products, images, variants and options.
  // Row filtering is entirely done by RLS — no app-level status filters needed.
  // Column selection matches the grants in migration 009 exactly.
  const { data: rawCategories, error } = await supabase
    .from("categories")
    .select(`
      id, restaurant_id, name, position,
      products (
        id, restaurant_id, category_id, name, description,
        base_price_cents, promo_price_cents, position,
        product_images ( id, product_id, restaurant_id, storage_path, alt_text, position ),
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

  return (
    <PublicMenuClient
      restaurant={restaurant}
      config={config ?? null}
      isOpen={isOpen}
      categories={activeCats}
      deliveryZones={deliveryZones ?? []}
      paymentMethods={paymentMethods ?? []}
      supabaseUrl={process.env.NEXT_PUBLIC_SUPABASE_URL!}
      ordersEnabled={ordersEnabled}
    />
  );
}

// force-dynamic: never share cache across restaurants or publication states.
export const dynamic = "force-dynamic";
