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
  // Filter by user_id to avoid ambiguous results when multiple admins exist.
  const { data: adminRow, error: adminError } = await supabase
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  // A query error is a real failure — do not silently treat it as "no access".
  if (adminError) {
    throw new Error(
      `Error al verificar permisos de administrador: ${adminError.message}`,
    );
  }

  if (!adminRow) redirect("/panel");

  return (
    <AdminShell userEmail={user.email ?? ""}>
      {children}
    </AdminShell>
  );
}
