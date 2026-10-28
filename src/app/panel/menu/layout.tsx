import { redirect } from "next/navigation";
import { getActiveMembership } from "@/lib/panel-context";

// Only owners can access /panel/menu. Applied server-side at the layout level;
// hiding nav items is not enough.
// Uses getActiveMembership() — reads the panel_restaurant_id cookie — so it
// works correctly for users with memberships in multiple restaurants.
export default async function MenuLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { active } = await getActiveMembership();
  if (active?.role !== "owner") redirect("/panel");
  return <>{children}</>;
}
