import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getActiveMembership } from "@/lib/panel-context";
import { Brand } from "@/components/brand";
import { SignOutButton } from "@/components/sign-out-button";
import { PanelShell } from "./panel-shell";

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

  const { active } = await getActiveMembership();

  if (!active) {
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

  return (
    <PanelShell
      role={active.role}
      restaurantName={active.restaurant.name}
      restaurantSlug={active.restaurant.slug}
      userEmail={user.email ?? ""}
    >
      {children}
    </PanelShell>
  );
}
