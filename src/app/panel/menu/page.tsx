import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { getActiveMembership } from "@/lib/panel-context";
import { PageHeader } from "@/components/panel/page-header";
import { MenuCatalogClient } from "./menu-catalog-client";
import type { Category, Product, ProductImage } from "@/lib/catalog-types";

type ProductWithImage = Product & { product_images: ProductImage[] };
type CategoryWithProducts = Category & { products: ProductWithImage[] };

export type DeletedProduct = {
  id: string;
  name: string;
  category_id: string;
  category_name: string | null;
  deleted_at: string;
  storage_path: string | null;
};

export default async function MenuPage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { active } = await getActiveMembership();
  if (!active) redirect("/panel");

  const restaurantId = active.restaurantId;

  // Active products — exclude deleted
  const { data: categories, error } = await supabase
    .from("categories")
    .select(`
      id, name, position, is_active, restaurant_id, created_at, updated_at,
      products (
        id, name, base_price_cents, promo_price_cents,
        is_available, is_published, position, restaurant_id,
        category_id, description, created_at, updated_at, deleted_at,
        product_images ( id, storage_path, position )
      )
    `)
    .eq("restaurant_id", restaurantId)
    .order("position", { ascending: true })
    .returns<CategoryWithProducts[]>();

  if (error) throw new Error(`Error al cargar el catálogo: ${error.message}`);

  // Authenticated RLS sees all restaurant products; filter soft-deleted server-side.
  const cats = (categories ?? []).map((c) => ({
    ...c,
    products: (c.products ?? []).filter((p) => !p.deleted_at),
  }));

  // Deleted products for the trash tab
  const { data: deletedRaw } = await supabase
    .from("products")
    .select(`
      id, name, category_id, deleted_at,
      product_images ( storage_path )
    `)
    .eq("restaurant_id", restaurantId)
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });

  // Enrich with category names
  const catMap = new Map((categories ?? []).map((c) => [c.id, c.name]));
  const deletedProducts: DeletedProduct[] = (deletedRaw ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    category_id: p.category_id,
    category_name: catMap.get(p.category_id) ?? null,
    deleted_at: p.deleted_at,
    storage_path: (p.product_images?.[0] as { storage_path: string } | undefined)?.storage_path ?? null,
  }));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const imageBase   = `${supabaseUrl}/storage/v1/object/public/product-images`;

  // Plan usage
  type PlanUsageLite = { product_count: number; max_products: number | null; plan_name: string | null };
  const { data: planUsageRaw } = await supabase.rpc("get_plan_usage", {
    p_restaurant_id: restaurantId,
  });
  const planUsage = planUsageRaw as PlanUsageLite | null;

  const atLimit = planUsage?.max_products != null && planUsage.product_count >= planUsage.max_products;

  const { data: cfgRow } = await supabase
    .from("restaurant_config")
    .select("orders_enabled")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  const catalogLabel: "menú" | "catálogo" = (cfgRow?.orders_enabled ?? true) ? "menú" : "catálogo";

  return (
    <>
      <PageHeader
        title="Catálogo"
        description="Gestiona categorías, productos, variantes y extras."
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            <Link href="/panel/menu/categories/new" className="panel-quick-action">
              <Plus size={13} /> Categoría
            </Link>
            <Link
              href={atLimit ? "/panel/configuracion?tab=plan" : "/panel/menu/products/new"}
              className={`panel-quick-action${atLimit ? "" : " panel-quick-action--primary"}`}
              aria-disabled={atLimit}
              style={atLimit ? { opacity: .55, pointerEvents: "none" } : undefined}
            >
              <Plus size={13} /> Nuevo producto
            </Link>
          </div>
        }
      />

      <div className="panel-content">
        {atLimit && planUsage && (
          <div
            role="alert"
            style={{
              background: "#FEF3C7", border: "1px solid #FCD34D", borderRadius: 10,
              padding: "12px 16px", marginBottom: 16,
              display: "flex", alignItems: "flex-start", gap: 10,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#92400E"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <div>
              <span style={{ fontWeight: 600, fontSize: 13, color: "#92400E" }}>
                Límite de productos alcanzado ({planUsage.product_count} de {planUsage.max_products})
              </span>
              <p style={{ fontSize: 12, color: "#92400E", margin: "3px 0 0" }}>
                Puedes editar los productos existentes. Para crear nuevos,{" "}
                <Link href="/panel/configuracion?tab=plan" style={{ color: "#92400E", fontWeight: 600, textDecoration: "underline" }}>
                  revisa tu plan actual
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

        <MenuCatalogClient
          cats={cats}
          imageBase={imageBase}
          defaultTab="productos"
          catalogLabel={catalogLabel}
          deletedProducts={deletedProducts}
        />
      </div>
    </>
  );
}
