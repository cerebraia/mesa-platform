import { redirect, notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { ManageShell } from "./manage-shell";

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

  const { data: cfgRow } = await supabase
    .from("restaurant_config")
    .select("orders_enabled, logo_path")
    .eq("restaurant_id", id)
    .maybeSingle();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const logoUrl: string | null = cfgRow?.logo_path
    ? `${supabaseUrl}/storage/v1/object/public/restaurant-assets/${cfgRow.logo_path}`
    : null;

  return (
    <ManageShell
      restaurantId={id}
      restaurantName={restaurant.name}
      restaurantSlug={restaurant.slug}
      ordersEnabled={cfgRow?.orders_enabled ?? true}
      logoUrl={logoUrl}
      userEmail={user.email ?? ""}
    >
      {children}
    </ManageShell>
  );
}

export const dynamic = "force-dynamic";
