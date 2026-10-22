import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { Package } from "lucide-react";
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
    <>
      <div className="panel-page-header">
        <div>
          <h1 className="panel-page-title">Planes</h1>
          <p className="panel-page-desc">Catálogo de suscripciones. Usa <code style={{ fontSize: 11 }}>is_test = true</code> en desarrollo.</p>
        </div>
      </div>

      <div className="panel-content">
        {error && (
          <div className="auth-error" role="alert" style={{ marginBottom: 16 }}>
            Error al cargar: {error.message}
          </div>
        )}

        {rows.length === 0 ? (
          <div className="panel-empty" style={{ marginBottom: 24 }}>
            <div className="panel-empty-icon"><Package size={24} strokeWidth={1.5} /></div>
            <p className="panel-empty-title">Sin planes creados</p>
            <p className="panel-empty-desc">Crea el primer plan de suscripción abajo.</p>
          </div>
        ) : (
          <div className="dashboard-card" style={{ padding: 0, overflow: "hidden", marginBottom: 24 }}>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Precio</th>
                    <th>Límites</th>
                    <th>Estado</th>
                    <th>Tipo</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: "#202337" }}>{p.name}</div>
                        {p.description && (
                          <div style={{ fontSize: 11, color: "#667085", marginTop: 2 }}>{p.description}</div>
                        )}
                      </td>
                      <td style={{ fontSize: 13, fontWeight: 500 }}>
                        {p.currency} {(p.price_cents / 100).toFixed(2)} / mes
                      </td>
                      <td style={{ fontSize: 12, color: "#667085" }}>
                        {p.max_products != null ? `${p.max_products} productos` : "Ilimitado"}
                        {p.max_members != null ? ` · ${p.max_members} miembros` : ""}
                      </td>
                      <td>
                        <span className={`order-status-badge ${p.is_active ? "badge-ready" : "badge-cancelled"}`}>
                          {p.is_active ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td>
                        {p.is_test && (
                          <span className="order-status-badge badge-accepted">TEST</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Create plan */}
        <div className="dashboard-card">
          <h2 style={{ fontSize: 15, fontWeight: 600, color: "#202337", marginBottom: 20 }}>Crear plan</h2>
          <NewPlanForm />
        </div>
      </div>
    </>
  );
}

export const dynamic = "force-dynamic";
