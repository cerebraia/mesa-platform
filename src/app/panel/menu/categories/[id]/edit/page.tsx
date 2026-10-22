import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getActiveMembership } from "@/lib/panel-context";
import { PageHeader } from "@/components/panel/page-header";
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
      <PageHeader
        title={`Editar: ${category.name}`}
        description="Modifica el nombre y estado de la categoría."
        breadcrumb={<a href="/panel/menu" className="panel-breadcrumb-link">← Catálogo</a>}
      />
      <CategoryFormPage mode="edit" category={category} />
    </>
  );
}
