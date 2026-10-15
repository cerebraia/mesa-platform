import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Authorization: check platform_admins table — never trust token claims.
  // RLS on platform_admins_select only returns rows if the caller IS an admin.
  const { data: adminRow } = await supabase
    .from("platform_admins")
    .select("user_id")
    .maybeSingle();

  if (!adminRow) {
    // Authenticated but not a platform admin.
    redirect("/panel");
  }

  return <>{children}</>;
}
