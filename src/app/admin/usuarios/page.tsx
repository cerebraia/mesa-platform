// Admin → Usuarios page.
// Auth and platform_admin authorization are handled exclusively in
// src/app/admin/layout.tsx — this page trusts that the layout already ran.
// Duplicating the check here caused a redirect to /admin when the service-role
// query returned no row (race or permission gap), sending users in circles.

import { listPlatformUsers } from "../actions";
import { UsersClient } from "./users-client";
import { createServerClient as createSsrClient } from "@supabase/ssr";

function adminServiceClient() {
  return createSsrClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );
}

export default async function UsuariosPage() {
  const svc = adminServiceClient();

  // Load all users (no filters — client-side filtering for small user counts)
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
