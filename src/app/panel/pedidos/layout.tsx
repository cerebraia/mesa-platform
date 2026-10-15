import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

// /panel/pedidos is accessible to all active members (owner, attention, kitchen).
// Role-specific rendering is handled inside each page.
export default async function PedidosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("restaurant_members")
    .select("role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!membership) redirect("/panel");

  return <>{children}</>;
}
