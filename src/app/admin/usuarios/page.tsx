import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { createServerClient as createSsrClient } from "@supabase/ssr";
import { listPlatformUsers } from "../actions";
import { UsersClient } from "./users-client";

function adminServiceClient() {
  return createSsrClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );
}

export default async function UsuariosPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const svc = adminServiceClient();

  // Verify admin
  const { data: adminRow } = await svc
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!adminRow) redirect("/admin");

  // Load all users (no filters — client-side filtering)
  const usersResult = await listPlatformUsers();

  // Load all restaurants for filter dropdown
  const { data: restaurants } = await svc
    .from("restaurants")
    .select("id, name, slug")
    .is("deleted_at", null)
    .order("name");

  return (
    <UsersClient
      initialUsers={usersResult.users ?? []}
      initialError={usersResult.error}
      restaurants={(restaurants ?? []) as Array<{ id: string; name: string; slug: string }>}
    />
  );
}

export const dynamic = "force-dynamic";
