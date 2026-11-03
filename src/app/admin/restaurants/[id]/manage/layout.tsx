import { redirect, notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { ManageShell } from "./manage-shell";
import { getRestaurantCanonical, getActiveDomainFromRows } from "@/lib/canonical";

export default async function ManageLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: adminRow, error: adminErr } = await supabase
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (adminErr) throw new Error(`Error de autorización: ${adminErr.message}`);
  if (!adminRow) redirect("/admin");

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id, name, slug, currency, status, deleted_at")
    .eq("id", id)
    .is("deleted_at", null)  // never manage deleted restaurants
    .maybeSingle();

  if (!restaurant) notFound();

  const [{ data: cfgRow }, { data: domainRows }] = await Promise.all([
    supabase
      .from("restaurant_config")
      .select("orders_enabled, logo_path")
      .eq("restaurant_id", id)
      .maybeSingle(),
    supabase
      .from("restaurant_domains")
      .select("host, kind, status")
      .eq("restaurant_id", id),
  ]);

  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const logoUrl: string | null = cfgRow?.logo_path
    ? `${supabaseUrl}/storage/v1/object/public/restaurant-assets/${cfgRow.logo_path}`
    : null;

  const activeDomain = getActiveDomainFromRows(
    (domainRows as Array<{ host: string; kind: string; status: string }> | null),
  );
  const catalogUrl = getRestaurantCanonical(restaurant.slug, activeDomain);

  return (
    <ManageShell
      restaurantId={id}
      restaurantName={restaurant.name}
      restaurantSlug={restaurant.slug}
      ordersEnabled={cfgRow?.orders_enabled ?? true}
      logoUrl={logoUrl}
      userEmail={user.email ?? ""}
      catalogUrl={catalogUrl}
    >
      {children}
    </ManageShell>
  );
}

export const dynamic = "force-dynamic";
