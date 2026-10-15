import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
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

  const { data: membership } = await supabase
    .from("restaurant_members")
    .select("restaurant_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!membership) redirect("/panel");

  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .eq("restaurant_id", membership.restaurant_id)
    .eq("is_active", true)
    .order("position")
    .returns<Category[]>();

  if (!categories?.length) {
    redirect("/panel/menu");
  }

  return (
    <ProductFormPage
      mode="new"
      categories={categories}
      defaultCategoryId={categoryParam}
      restaurantId={membership.restaurant_id}
    />
  );
}
