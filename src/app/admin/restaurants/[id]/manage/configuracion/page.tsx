import { notFound, redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { ConfigAdminForm } from "./config-admin-form";

export default async function ManageConfigPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: adminRow } = await supabase
    .from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!adminRow) redirect("/admin");

  const { data: restaurant } = await supabase
    .from("restaurants").select("id, name, slug, currency, timezone")
    .eq("id", id).is("deleted_at", null).maybeSingle();
  if (!restaurant) notFound();

  const { data: config } = await supabase
    .from("restaurant_config")
    .select(`
      description, primary_color, background_color, secondary_color, font_family,
      phone, whatsapp, instagram_url, facebook_url, twitter_url,
      address, pickup_enabled, pickup_address, pickup_notes,
      delivery_enabled, is_temporarily_closed, closed_message, orders_enabled,
      seo_title, seo_description, allow_indexing
    `)
    .eq("restaurant_id", id)
    .maybeSingle();

  return (
    <>
      <div className="panel-page-header">
        <div>
          <h1 className="panel-page-title">Configuración</h1>
          <p className="panel-page-desc">{restaurant.name}</p>
        </div>
      </div>
      <div className="panel-content" style={{ maxWidth: 720 }}>
        <ConfigAdminForm
          restaurantId={id}
          restaurant={restaurant}
          config={config ?? {}}
        />
      </div>
    </>
  );
}

export const dynamic = "force-dynamic";
