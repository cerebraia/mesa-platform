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

export default async function MenuPage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { active } = await getActiveMembership();
  if (!active) redirect("/panel");

  const restaurantId = active.restaurantId;

  const { data: categories, error } = await supabase
    .from("categories")
    .select(`
      id, name, position, is_active, restaurant_id, created_at, updated_at,
      products (
        id, name, base_price_cents, promo_price_cents,
        is_available, is_published, position, restaurant_id,
        category_id, description, created_at, updated_at,
        product_images ( id, storage_path, position )
      )
    `)
    .eq("restaurant_id", restaurantId)
    .order("position", { ascending: true })
    .returns<CategoryWithProducts[]>();

  if (error) throw new Error(`Error al cargar el catálogo: ${error.message}`);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const imageBase   = `${supabaseUrl}/storage/v1/object/public/product-images`;
  const cats        = categories ?? [];

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
            <Link href="/panel/menu/products/new" className="panel-quick-action panel-quick-action--primary">
              <Plus size={13} /> Nuevo producto
            </Link>
          </div>
        }
      />

      <div className="panel-content">
        <MenuCatalogClient
          cats={cats}
          imageBase={imageBase}
          defaultTab="productos"
        />
      </div>
    </>
  );
}
