import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { createServerClient as createSsrClient } from "@supabase/ssr";
import { ProductFormPage } from "@/app/panel/menu/product-form";
import {
  adminSaveProduct,
} from "../../../actions";
import type { Category } from "@/lib/catalog-types";

export default async function AdminNewProductPage({
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

  const db = createSsrClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );

  const { data: restaurant } = await db
    .from("restaurants").select("id, name").eq("id", id).is("deleted_at", null).maybeSingle();
  if (!restaurant) notFound();

  const { data: catsRaw } = await db
    .from("categories")
    .select("id, name, position, is_active, restaurant_id, created_at, updated_at")
    .eq("restaurant_id", id)
    .order("position", { ascending: true });
  const categories = (catsRaw ?? []) as Category[];

  const returnPath = `/admin/restaurants/${id}/manage/menu`;

  // Bind restaurantId so the form receives the standard (data) => Promise<...> signature
  const saveAction: Parameters<typeof ProductFormPage>[0]["saveAction"] =
    (data) => adminSaveProduct(id, data);

  return (
    <>
      <div className="panel-page-header">
        <div>
          <div className="panel-breadcrumb">
            <Link href={returnPath} className="panel-breadcrumb-link">
              ← Catálogo
            </Link>
          </div>
          <h1 className="panel-page-title">Nuevo producto</h1>
          <p className="panel-page-desc">{restaurant.name}</p>
        </div>
      </div>
      <ProductFormPage
        mode="new"
        categories={categories}
        restaurantId={id}
        saveAction={saveAction}
        returnPath={returnPath}
        stockEnabled={false}
      />
    </>
  );
}

export const dynamic = "force-dynamic";
