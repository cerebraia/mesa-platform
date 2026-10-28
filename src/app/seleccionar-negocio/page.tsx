import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { Brand } from "@/components/brand";
import { SignOutButton } from "@/components/sign-out-button";
import { SelectorClient, type BusinessOption } from "./selector-client";
import { selectRestaurant } from "@/app/panel/select-restaurant";
import type { MemberRole } from "@/lib/db-types";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Seleccionar negocio — Mesa",
};

export default async function SeleccionarNegocioPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // ── Step 1: memberships ───────────────────────────────────────────
  // restaurant_config has no direct FK to restaurant_members, so we
  // query memberships and configs separately to avoid PGRST200.
  const { data: rows, error: membershipsError } = await supabase
    .from("restaurant_members")
    .select("restaurant_id, role, restaurants(id, name, slug)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at")
    .returns<Array<{
      restaurant_id: string;
      role: MemberRole;
      restaurants: { id: string; name: string; slug: string } | null;
    }>>();

  // ── Explicit error rendering — never redirect on query failure ────
  // If we redirect to /panel on error, panel/layout.tsx redirects back
  // here, creating a redirect loop for users with no valid cookie.
  if (membershipsError) {
    return (
      <SelectorPageShell>
        <div className="sbx-hero">
          <h1 className="sbx-title">Error al cargar negocios</h1>
          <p className="sbx-desc" style={{ color: "#991B1B" }}>
            {membershipsError.message}
          </p>
          <p style={{ marginTop: 12, fontSize: 13, color: "#667085" }}>
            Recarga la página o{" "}
            <a href="/seleccionar-negocio" style={{ color: "var(--purple)" }}>
              intenta de nuevo
            </a>.
          </p>
        </div>
      </SelectorPageShell>
    );
  }

  const valid = (rows ?? []).filter((r) => r.restaurants != null);

  // ── 0 memberships: access pending (panel handles the message) ─────
  if (valid.length === 0) redirect("/panel");

  // ── 1 membership: auto-select, skip the selector screen ──────────
  if (valid.length === 1) {
    await selectRestaurant(valid[0].restaurant_id);
    redirect("/panel");
  }

  // ── Step 2: catalog mode for each restaurant (separate query) ─────
  const restaurantIds = valid.map((r) => r.restaurant_id);
  const { data: configs } = await supabase
    .from("restaurant_config")
    .select("restaurant_id, orders_enabled")
    .in("restaurant_id", restaurantIds);

  const configMap: Record<string, boolean> = Object.fromEntries(
    (configs ?? []).map((c) => [c.restaurant_id, c.orders_enabled ?? true]),
  );

  const options: BusinessOption[] = valid.map((r) => ({
    restaurantId:   r.restaurant_id,
    restaurantName: r.restaurants!.name,
    role:           r.role,
    ordersEnabled:  configMap[r.restaurant_id] ?? true,
  }));

  // Identify the currently selected restaurant (if any) so the UI can
  // highlight it — the cookie is only read for this cosmetic hint.
  // It does NOT cause any redirect from this page.
  const { cookies } = await import("next/headers");
  const cookieStore  = await cookies();
  const currentId    = cookieStore.get("panel_restaurant_id")?.value ?? null;

  return (
    <SelectorPageShell>
      <div className="sbx-hero">
        <h1 className="sbx-title">¿Qué negocio quieres administrar?</h1>
        <p className="sbx-desc">Selecciona un negocio para entrar a su panel.</p>
      </div>
      <SelectorClient options={options} currentRestaurantId={currentId} />
    </SelectorPageShell>
  );
}

// ── Shared shell (header + footer) ────────────────────────────────

function SelectorPageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="sbx-page">
      <header className="sbx-header">
        <Brand />
        <SignOutButton />
      </header>
      <main className="sbx-main">{children}</main>
      <footer className="sbx-footer">
        Creado con{" "}
        <strong style={{ color: "var(--purple)", fontWeight: 600 }}>Mesa</strong>
      </footer>
    </div>
  );
}

export const dynamic = "force-dynamic";
