import { notFound, redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { MembersAdminClient } from "./members-admin-client";

export default async function ManageMiembrosPage({
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
    .from("restaurants").select("id, name")
    .eq("id", id).is("deleted_at", null).maybeSingle();
  if (!restaurant) notFound();

  const { data: membersRaw } = await supabase
    .from("restaurant_members")
    .select("id, user_id, role, status, created_at")
    .eq("restaurant_id", id)
    .order("created_at");

  type MemberRow = { id: string; user_id: string; role: string; status: string; created_at: string };
  const members = (membersRaw ?? []) as MemberRow[];

  return (
    <>
      <div className="panel-page-header">
        <div>
          <h1 className="panel-page-title">Miembros</h1>
          <p className="panel-page-desc">{members.length} miembro{members.length !== 1 ? "s" : ""}</p>
        </div>
      </div>
      <div className="panel-content" style={{ maxWidth: 720 }}>
        <MembersAdminClient restaurantId={id} members={members} />
      </div>
    </>
  );
}

export const dynamic = "force-dynamic";
