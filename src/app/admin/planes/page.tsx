import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { Brand } from "@/components/brand";
import { SignOutButton } from "@/components/sign-out-button";
import { NewPlanForm } from "./new-plan-form";

export default async function PlanesPage() {
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: adminRow } = await supabase
    .from("platform_admins").select("user_id").maybeSingle();
  if (!adminRow) redirect("/panel");

  const { data: plans, error } = await supabase
    .from("plans")
    .select("id, name, description, price_cents, currency, max_products, max_members, is_active, is_test, created_at")
    .order("created_at");

  type Plan = {
    id: string; name: string; description: string | null;
    price_cents: number; currency: string;
    max_products: number | null; max_members: number | null;
    is_active: boolean; is_test: boolean; created_at: string;
  };

  const rows = (plans ?? []) as Plan[];

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <Brand />
        <div className="workspace">
          <div className="avatar">{user.email?.slice(0, 2).toUpperCase()}</div>
          <div>
            <b style={{ fontSize: 12, display: "block" }}>Administración</b>
            <span className="muted" style={{ fontSize: 11 }}>Platform Admin</span>
          </div>
        </div>
        <nav aria-label="Admin">
          <Link href="/admin" style={{
            display: "flex", gap: 14, textAlign: "left", border: 0,
            background: "none", color: "var(--muted)",
            padding: "12px 14px", borderRadius: 9, fontSize: 13, textDecoration: "none",
          }}>
            Restaurantes
          </Link>
          <Link href="/admin/planes" style={{
            display: "flex", gap: 14, textAlign: "left", border: 0,
            background: "var(--soft)", color: "var(--purple)",
            padding: "12px 14px", borderRadius: 9, fontSize: 13,
            textDecoration: "none", fontWeight: 600,
          }}>
            Planes
          </Link>
        </nav>
        <div className="sidebar-bottom">
          <span style={{ fontSize: 11 }}>{user.email}</span>
          <SignOutButton />
        </div>
      </aside>

      <main className="dashboard-main">
        <div className="dashboard-top">
          <span>ADMINISTRACIÓN DE PLATAFORMA</span>
          <span>{rows.length} plan{rows.length !== 1 ? "es" : ""}</span>
        </div>

        <div className="dashboard-content">
          <div className="dashboard-heading">
            <div>
              <h1>Planes</h1>
              <p>Catálogo de planes de suscripción. Usa is_test = true para planes de desarrollo.</p>
            </div>
          </div>

          {error && (
            <div className="auth-error" role="alert" style={{ marginBottom: 16 }}>
              Error al cargar: {error.message}
            </div>
          )}

          {rows.length > 0 && (
            <div className="table-scroll dashboard-card" style={{ marginBottom: 24 }}>
              <table>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Precio</th>
                    <th>Límites</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <span style={{ fontWeight: 600 }}>{p.name}</span>
                        {p.is_test && (
                          <span className="tag" style={{ marginLeft: 7, fontSize: 10 }}>TEST</span>
                        )}
                        {p.description && (
                          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                            {p.description}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: 13 }}>
                        {p.currency} {(p.price_cents / 100).toFixed(2)}
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {p.max_products != null ? `${p.max_products} productos` : "Ilimitado"}
                        {p.max_members != null ? `, ${p.max_members} miembros` : ""}
                      </td>
                      <td>
                        <span
                          className="tag"
                          style={p.is_active
                            ? { color: "#2e7d32", background: "#e8f5e918" }
                            : { color: "#777", background: "#f5f5f5" }}
                        >
                          {p.is_active ? "activo" : "inactivo"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {rows.length === 0 && (
            <div className="dashboard-card" style={{ textAlign: "center", padding: "40px 20px", marginBottom: 24 }}>
              <p style={{ fontSize: 14, color: "var(--muted)" }}>
                No hay planes creados. Crea el primero abajo.
              </p>
            </div>
          )}

          <section className="dashboard-card">
            <h2 style={{ fontSize: 17, marginBottom: 18 }}>Crear plan</h2>
            <NewPlanForm />
          </section>
        </div>
      </main>
    </div>
  );
}

export const dynamic = "force-dynamic";
