import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

export default async function ConfiguracionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Only owners can access configuration. Atención and cocina cannot modify it.
  const { data: membership } = await supabase
    .from("restaurant_members")
    .select("role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (membership?.role !== "owner") redirect("/panel");

  return <>{children}</>;
}
