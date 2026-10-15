import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { CategoryFormPage } from "../../../category-form";
import type { Category } from "@/lib/catalog-types";

export default async function EditCategoryPage({
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

  const { data: membership } = await supabase
    .from("restaurant_members")
    .select("restaurant_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!membership) redirect("/panel");

  const { data: category } = await supabase
    .from("categories")
    .select("*")
    .eq("id", id)
    .eq("restaurant_id", membership.restaurant_id)
    .maybeSingle<Category>();

  if (!category) redirect("/panel/menu");

  return <CategoryFormPage mode="edit" category={category} />;
}
