// Server utility: resolve public brand identity for a business by slug.
// Only reads publicly accessible columns. Returns null for invalid or inactive slugs.

import { createServerClient } from "@/lib/supabase/server";
import { getRestaurantCanonical } from "@/lib/canonical";
import { SLUG_RE, RESERVED_SUBDOMAINS } from "@/lib/host-resolver";

export type BizBrand = {
  restaurantId: string;
  slug:         string;
  name:         string;
  logoUrl:      string | null;
  primaryColor: string;
  /** Computed contrast colour (#fff or #1a1a1a) for text on the primaryColor bg. */
  textColor:    string;
  catalogUrl:   string;
};

function contrastTextColor(hex: string): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return "#ffffff";
  const r   = parseInt(hex.slice(1, 3), 16);
  const g   = parseInt(hex.slice(3, 5), 16);
  const b   = parseInt(hex.slice(5, 7), 16);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 140 ? "#1a1a1a" : "#ffffff";
}

export async function getBizBrand(slug: string): Promise<BizBrand | null> {
  if (!slug || !SLUG_RE.test(slug) || RESERVED_SUBDOMAINS.has(slug)) return null;

  try {
    const supabase = await createServerClient();

    const { data: restaurant } = await supabase
      .from("restaurants")
      .select("id, name, slug")
      .eq("slug", slug)
      .eq("status", "active")
      .maybeSingle();

    if (!restaurant) return null;

    const { data: config } = await supabase
      .from("restaurant_config")
      .select("primary_color, logo_path")
      .eq("restaurant_id", restaurant.id)
      .maybeSingle();

    const primaryColor = config?.primary_color ?? "#703BE6";
    const logoPath     = config?.logo_path ?? null;
    const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!;

    return {
      restaurantId: restaurant.id,
      slug:         restaurant.slug,
      name:         restaurant.name,
      logoUrl: logoPath
        ? `${supabaseUrl}/storage/v1/object/public/restaurant-assets/${logoPath}`
        : null,
      primaryColor,
      textColor:  contrastTextColor(primaryColor),
      catalogUrl: getRestaurantCanonical(slug),
    };
  } catch {
    return null;
  }
}
