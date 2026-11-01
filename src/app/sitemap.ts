// Sitemap for Wacatalog — includes only active, indexable restaurant catalogs.
//
// Rules applied:
//   · status = 'active' (RLS on anon restricts to active restaurants).
//   · allow_indexing = true (default); false → restaurant is omitted.
//   · Test/demo businesses should have allow_indexing = false (set by admin).
//   · Uses the canonical URL for each restaurant (custom domain > subdomain > /r/slug).
//   · /panel, /admin, /login, /seleccionar-negocio are excluded (private routes).
//   · /r/[slug]/pedido routes are excluded (order confirmation pages with tokens).
//
// NOTE: When NEXT_PUBLIC_SITE_URL is not set (local dev), sitemap returns an
// empty array to avoid generating fictitious URLs.

import type { MetadataRoute } from "next";
import { createAnonSupabaseClient } from "@/lib/supabase/anon";
import { getRestaurantCanonical, getPlatformBase } from "@/lib/canonical";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getPlatformBase();
  if (!base) return []; // Local dev — no canonical base available

  const supabase = createAnonSupabaseClient();

  // Fetch active restaurants (RLS ensures status='active')
  const { data: restaurants } = await supabase
    .from("restaurants")
    .select("id, slug, updated_at");

  if (!restaurants?.length) return [];

  const ids = restaurants.map((r) => r.id);

  // Fetch SEO config for indexing flag and active domains
  const [{ data: configs }, { data: domains }] = await Promise.all([
    supabase
      .from("restaurant_config")
      .select("restaurant_id, allow_indexing")
      .in("restaurant_id", ids),
    supabase
      .from("restaurant_domains")
      .select("restaurant_id, host")
      .in("restaurant_id", ids)
      .eq("status", "active"),
  ]);

  type ConfigRow = { restaurant_id: string; allow_indexing: boolean | null };
  type DomainRow = { restaurant_id: string; host: string };
  const configMap: Record<string, { allow_indexing: boolean }> = Object.fromEntries(
    (configs as ConfigRow[] ?? []).map((c) => [c.restaurant_id, { allow_indexing: c.allow_indexing ?? true }]),
  );
  const domainMap: Record<string, string> = Object.fromEntries(
    (domains as DomainRow[] ?? []).map((d) => [d.restaurant_id, d.host]),
  );

  const entries: MetadataRoute.Sitemap = [];

  type RestaurantRow = { id: string; slug: string; updated_at: string | null };
  for (const r of restaurants as RestaurantRow[]) {
    const cfg = configMap[r.id];
    // Omit businesses that have explicitly disabled indexing
    if (cfg && cfg.allow_indexing === false) continue;

    const canonical = getRestaurantCanonical(r.slug, domainMap[r.id]);
    entries.push({
      url:              canonical,
      lastModified:     r.updated_at ? new Date(r.updated_at) : new Date(),
      changeFrequency:  "weekly",
      priority:         0.8,
    });
  }

  return entries;
}
