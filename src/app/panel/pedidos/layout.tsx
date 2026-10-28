import { redirect } from "next/navigation";
import { getActiveMembership } from "@/lib/panel-context";

// /panel/pedidos is accessible to all active members (owner, attention, kitchen).
// Role-specific rendering is handled inside each page.
// Uses getActiveMembership() — reads the panel_restaurant_id cookie — so it
// works correctly for users with memberships in multiple restaurants.
export default async function PedidosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { active } = await getActiveMembership();
  if (!active) redirect("/panel");
  return <>{children}</>;
}
