import { redirect } from "next/navigation";
import { getActiveMembership } from "@/lib/panel-context";

// Only owners can access configuration. Atención and cocina cannot modify it.
// Uses getActiveMembership() — reads the panel_restaurant_id cookie — so it
// works correctly for users with memberships in multiple restaurants.
export default async function ConfiguracionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { active } = await getActiveMembership();
  if (active?.role !== "owner") redirect("/panel");
  return <>{children}</>;
}
