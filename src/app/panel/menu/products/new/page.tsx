import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getActiveMembership } from "@/lib/panel-context";
import { ProductFormPage } from "../../product-form";
import type { Category } from "@/lib/catalog-types";

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category: categoryParam } = await searchParams;
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { active } = await getActiveMembership();
  if (!active) redirect("/panel");

  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .eq("restaurant_id", active.restaurantId)
    .eq("is_active", true)
    .order("position")
    .returns<Category[]>();

  if (!categories?.length) redirect("/panel/menu");

  return (
    <>
      <div className="dashboard-top">
        <span>CATÁLOGO · NUEVO PRODUCTO</span>
        <a href="/panel/menu" className="muted" style={{ fontSize: 12, textDecoration: "none" }}>
          ← Catálogo
        </a>
      </div>
      <ProductFormPage
        mode="new"
        categories={categories}
        defaultCategoryId={categoryParam}
        restaurantId={active.restaurantId}
      />
    </>
  );
}
