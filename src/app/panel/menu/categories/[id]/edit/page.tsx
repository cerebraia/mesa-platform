import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getActiveMembership } from "@/lib/panel-context";
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

  const { active } = await getActiveMembership();
  if (!active) redirect("/panel");

  const { data: category } = await supabase
    .from("categories")
    .select("*")
    .eq("id", id)
    .eq("restaurant_id", active.restaurantId)
    .maybeSingle<Category>();

  if (!category) redirect("/panel/menu");

  return (
    <>
      <div className="dashboard-top">
        <span>CATÁLOGO · EDITAR CATEGORÍA</span>
        <a href="/panel/menu" className="muted" style={{ fontSize: 12, textDecoration: "none" }}>
          ← Catálogo
        </a>
      </div>
      <CategoryFormPage mode="edit" category={category} />
    </>
  );
}
