import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { AdminCategoryFormClient } from "./admin-category-form-client";

export default async function AdminNewCategoryPage({
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

  const { data: restaurant } = await supabase
    .from("restaurants").select("id, name").eq("id", id).is("deleted_at", null).maybeSingle();
  if (!restaurant) notFound();

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
          <h1 className="panel-page-title">Nueva categoría</h1>
          <p className="panel-page-desc">{restaurant.name}</p>
        </div>
      </div>
      <div className="panel-content">
        <div className="dashboard-card" style={{ maxWidth: 480 }}>
          <AdminCategoryFormClient restaurantId={id} returnPath={returnPath} />
        </div>
      </div>
    </>
  );
}

export const dynamic = "force-dynamic";
