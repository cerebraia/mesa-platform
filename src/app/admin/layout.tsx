import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { AdminShell } from "./admin-shell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Authorization: check platform_admins — never trust token claims.
  const { data: adminRow } = await supabase
    .from("platform_admins")
    .select("user_id")
    .maybeSingle();

  if (!adminRow) redirect("/panel");

  return (
    <AdminShell userEmail={user.email ?? ""}>
      {children}
    </AdminShell>
  );
}
