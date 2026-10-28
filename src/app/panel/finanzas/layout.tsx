import { redirect } from "next/navigation";
import { getActiveMembership } from "@/lib/panel-context";

// Only owners can access Finanzas — same pattern as configuracion/layout.tsx
export default async function FinanzasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { active } = await getActiveMembership();
  if (active?.role !== "owner") redirect("/panel");
  return <>{children}</>;
}
