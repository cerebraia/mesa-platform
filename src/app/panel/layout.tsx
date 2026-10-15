import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { Brand } from "@/components/brand";
import { SignOutButton } from "@/components/sign-out-button";
import { PanelShell } from "./panel-shell";
import type { MemberRole } from "@/lib/db-types";

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Load membership + restaurant for the shell.
  // If the user belongs to multiple restaurants, we use the first active one
  // for the sidebar. Restaurant switching is a future feature.
  const { data: memberships } = await supabase
    .from("restaurant_members")
    .select("restaurant_id, role, restaurants(id, name, slug)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(3)
    .returns<Array<{
      restaurant_id: string;
      role: MemberRole;
      restaurants: { id: string; name: string; slug: string } | null;
    }>>();

  const membership = memberships?.[0] ?? null;

  // No active membership: show access-pending without the full nav shell
  if (!membership || !membership.restaurants) {
    const email    = user.email ?? "";
    const initials = email.slice(0, 2).toUpperCase();
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <header
          className="container"
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            minHeight: 64, borderBottom: "1px solid var(--border)",
          }}
        >
          <Brand />
          <SignOutButton />
        </header>
        <div className="access-pending">
          <div className="avatar" style={{ width: 56, height: 56, fontSize: 16, marginBottom: 24 }}>
            {initials}
          </div>
          <h2 style={{ marginBottom: 12 }}>Acceso pendiente</h2>
          <p className="muted" style={{ fontSize: 14, maxWidth: 360 }}>
            Tu cuenta ({email}) aún no tiene una membresía activa en ningún
            restaurante. Contacta a Mesa para activar tu acceso.
          </p>
          <div style={{ marginTop: 28 }}>
            <SignOutButton />
          </div>
        </div>
      </div>
    );
  }

  const restaurant = membership.restaurants;
  const role       = membership.role;

  return (
    <PanelShell
      role={role}
      restaurantName={restaurant.name}
      restaurantSlug={restaurant.slug}
      userEmail={user.email ?? ""}
    >
      {children}
    </PanelShell>
  );
}
