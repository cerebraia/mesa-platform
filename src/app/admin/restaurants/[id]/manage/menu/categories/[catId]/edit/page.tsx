import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { createServerClient as createSsrClient } from "@supabase/ssr";
import { AdminEditCategoryFormClient } from "./admin-edit-category-form-client";

export default async function AdminEditCategoryPage({
  params,
}: {
  params: Promise<{ id: string; catId: string }>;
}) {
  const { id, catId } = await params;
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: adminRow } = await supabase
    .from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!adminRow) redirect("/admin");

  const { data: restaurant } = await supabase
    .from("restaurants").select("id, name").eq("id", id).is("deleted_at", null).maybeSingle();
  if (!restaurant) notFound();

  // Service role to bypass member check on categories
  const db = createSsrClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );
  const { data: category } = await db
    .from("categories")
    .select("id, name, is_active")
    .eq("id", catId)
    .eq("restaurant_id", id)
    .maybeSingle();
  if (!category) notFound();

  const returnPath = `/admin/restaurants/${id}/manage/menu`;

  return (
    <>
      <div className="panel-page-header">
        <div>
          <div className="panel-breadcrumb">
            <Link href={returnPath} className="panel-breadcrumb-link">
              ← Catálogo
            </Link>
          </div>
          <h1 className="panel-page-title">Editar categoría</h1>
          <p className="panel-page-desc">{restaurant.name}</p>
        </div>
      </div>
      <div className="panel-content">
        <div className="dashboard-card" style={{ maxWidth: 480 }}>
          <AdminEditCategoryFormClient
            restaurantId={id}
            category={category}
            returnPath={returnPath}
          />
        </div>
      </div>
    </>
  );
}

export const dynamic = "force-dynamic";
