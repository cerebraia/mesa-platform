import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getActiveMembership } from "@/lib/panel-context";
import { ProductFormPage } from "../../../product-form";
import type {
  Category,
  Product,
  ProductImage,
  ProductVariant,
  OptionGroup,
  Option,
} from "@/lib/catalog-types";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { active } = await getActiveMembership();
  if (!active) redirect("/panel");

  const restaurantId = active.restaurantId;

  const [
    { data: product },
    { data: categories },
    { data: images },
    { data: variants },
    { data: rawGroups },
  ] = await Promise.all([
    supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .eq("restaurant_id", restaurantId)
      .maybeSingle<Product>(),
    supabase
      .from("categories")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true)
      .order("position")
      .returns<Category[]>(),
    supabase
      .from("product_images")
      .select("*")
      .eq("product_id", id)
      .order("position")
      .returns<ProductImage[]>(),
    supabase
      .from("product_variants")
      .select("*")
      .eq("product_id", id)
      .order("position")
      .returns<ProductVariant[]>(),
    supabase
      .from("option_groups")
      .select("*, options(*)")
      .eq("product_id", id)
      .order("position")
      .returns<(OptionGroup & { options: Option[] })[]>(),
  ]);

  if (!product || !categories?.length) redirect("/panel/menu");

  return (
    <>
      <div className="dashboard-top">
        <span>CATÁLOGO · EDITAR PRODUCTO</span>
        <a href="/panel/menu" className="muted" style={{ fontSize: 12, textDecoration: "none" }}>
          ← Catálogo
        </a>
      </div>
      <ProductFormPage
        mode="edit"
        categories={categories!}
        product={product}
        existingImage={images?.[0]}
        existingVariants={variants ?? []}
        existingGroups={rawGroups ?? []}
        restaurantId={restaurantId}
      />
    </>
  );
}
