import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

// Only owners can access /panel/menu. Applied server-side at the layout level;
// hiding nav items is not enough.
export default async function MenuLayout({
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

  if (membership?.role !== "owner") {
    redirect("/panel");
  }

  return <>{children}</>;
}
