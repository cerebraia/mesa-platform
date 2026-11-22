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

  const { data: adminRow } = await supabase
    .from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!adminRow) redirect("/admin");

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id, name, slug, currency")
    .eq("id", id).is("deleted_at", null).maybeSingle();
  if (!restaurant) notFound();

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

  // Plan usage — authenticated admin can call this RPC
  type PlanUsageLite = { product_count: number; max_products: number | null; plan_name: string | null };
  const { data: planUsageRaw } = await supabase.rpc("get_plan_usage", {
    p_restaurant_id: id,
  });
  const planUsage = (planUsageRaw as PlanUsageLite | null) ?? null;
  const atLimit = planUsage?.max_products != null && planUsage.product_count >= planUsage.max_products;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const totalProducts = categories.reduce((n, c) => n + c.products.length, 0);

  return (
    <>
      <div className="panel-page-header">
        <div>
          <h1 className="panel-page-title">Catálogo</h1>
          <p className="panel-page-desc">
            {totalProducts} producto{totalProducts !== 1 ? "s" : ""} ·{" "}
            {categories.length} categoría{categories.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="panel-page-actions" style={{ flexWrap: "wrap", gap: 8 }}>
          <Link
            href={`/admin/restaurants/${id}/manage/menu/categories/new`}
            className="button secondary small"
            style={{ fontSize: 12 }}
          >
            <Plus size={12} style={{ marginRight: 4 }} />
            Categoría
          </Link>
          <Link
            href={
              atLimit
                ? `/admin/restaurants/${id}`
                : `/admin/restaurants/${id}/manage/menu/products/new`
            }
            className="button small"
            style={atLimit ? { opacity: 0.55, pointerEvents: "none", fontSize: 12 } : { fontSize: 12 }}
            aria-disabled={atLimit}
          >
            <Plus size={12} style={{ marginRight: 4 }} />
            Nuevo producto
          </Link>
          <a
            href={`/api/admin/export?type=products&restaurantId=${id}`}
            className="button secondary small"
            style={{ fontSize: 12 }}
          >
            Exportar CSV
          </a>
          <a
            href={`/r/${restaurant.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ver-menu"
          >
            <ExternalLink size={13} />
            Ver catálogo
          </a>
        </div>
      </div>

      <div className="panel-content">
        {atLimit && planUsage && (
          <div
            role="alert"
            style={{
              background: "#FEF3C7", border: "1px solid #FCD34D",
              borderRadius: 10, padding: "12px 16px", marginBottom: 16,
              display: "flex", alignItems: "flex-start", gap: 10,
            }}
          >
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="#92400E" strokeWidth="2" strokeLinecap="round"
              strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}
              aria-hidden="true"
            >
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div>
              <span style={{ fontWeight: 600, fontSize: 13, color: "#92400E" }}>
                Límite de productos alcanzado ({planUsage.product_count} de {planUsage.max_products})
              </span>
              <p style={{ fontSize: 12, color: "#92400E", margin: "3px 0 0" }}>
                Puedes editar los productos existentes.
                Para crear más, cambia el plan del negocio desde el{" "}
                <Link
                  href={`/admin/restaurants/${id}`}
                  style={{ color: "#92400E", fontWeight: 600, textDecoration: "underline" }}
                >
                  detalle del negocio
                </Link>.
              </p>
            </div>
          </div>
        )}

        {planUsage?.max_products != null && !atLimit && (
          <div style={{ fontSize: 12, color: "#667085", marginBottom: 12, textAlign: "right" }}>
            {planUsage.product_count} de {planUsage.max_products} productos del plan
          </div>
        )}

        <MenuAdminClient
          restaurantId={id}
          categories={categories}
          deleted={deleted}
          currency={restaurant.currency}
          supabaseUrl={supabaseUrl}
          planUsage={planUsage}
          atLimit={atLimit}
        />
      </div>
    </>
  );
}

export const dynamic = "force-dynamic";
