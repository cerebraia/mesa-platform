import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { Plus, ExternalLink } from "lucide-react";
import { MenuAdminClient } from "./menu-admin-client";

export default async function ManageMenuPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Admin check (layout already did this, but actions require it too)
  const { data: adminRow } = await supabase
    .from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!adminRow) redirect("/admin");

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id, name, slug, currency")
    .eq("id", id).is("deleted_at", null).maybeSingle();
  if (!restaurant) notFound();

  // Categories + products
  type Product = {
    id: string; name: string; base_price_cents: number | null;
    is_published: boolean; is_available: boolean;
    deleted_at: string | null; position: number;
    product_images: Array<{ id: string; storage_path: string; position: number }>;
  };
  type Category = {
    id: string; name: string; position: number; is_active: boolean;
    products: Product[];
  };

  const { data: cats, error } = await supabase
    .from("categories")
    .select(`
      id, name, position, is_active,
      products (
        id, name, base_price_cents, is_published, is_available,
        deleted_at, position,
        product_images ( id, storage_path, position )
      )
    `)
    .eq("restaurant_id", id)
    .order("position", { ascending: true })
    .returns<Category[]>();

  if (error) throw new Error(`Error al cargar catálogo: ${error.message}`);

  const categories = (cats ?? []).map((c) => ({
    ...c,
    products: (c.products ?? []).filter((p) => !p.deleted_at),
  }));

  const { data: deletedRaw } = await supabase
    .from("products")
    .select("id, name, category_id, deleted_at")
    .eq("restaurant_id", id)
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false })
    .limit(100);

  const deleted = (deletedRaw ?? []) as Array<{
    id: string; name: string; category_id: string; deleted_at: string;
  }>;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  return (
    <>
      <div className="panel-page-header">
        <div>
          <h1 className="panel-page-title">Catálogo</h1>
          <p className="panel-page-desc">
            {categories.reduce((n, c) => n + c.products.length, 0)} productos ·{" "}
            {categories.length} categorías
          </p>
        </div>
        <div className="panel-page-actions" style={{ flexWrap: "wrap" }}>
          <a
            href={`/api/admin/export?type=products&restaurantId=${id}`}
            className="button secondary small" style={{ fontSize: 12 }}
          >
            Exportar CSV
          </a>
          <a
            href={`/r/${restaurant.slug}`}
            target="_blank" rel="noopener noreferrer"
            className="btn-ver-menu"
          >
            <ExternalLink size={13} />
            Ver catálogo
          </a>
        </div>
      </div>

      <div className="panel-content">
        <MenuAdminClient
          restaurantId={id}
          categories={categories}
          deleted={deleted}
          currency={restaurant.currency}
          supabaseUrl={supabaseUrl}
        />
      </div>
    </>
  );
}

export const dynamic = "force-dynamic";
