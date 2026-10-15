import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getActiveMembership } from "@/lib/panel-context";
import { selectRestaurant } from "./select-restaurant";
import type { MemberRole } from "@/lib/db-types";

const ROLE_LABEL: Record<MemberRole, string> = {
  owner:     "Propietario",
  attention: "Atención",
  kitchen:   "Cocina",
};

const STATUS_LABEL: Record<string, string> = {
  onboarding: "En configuración",
  active:     "Activo",
  suspended:  "Suspendido",
};

function RoleContent({ role, restaurantName }: { role: MemberRole; restaurantName: string }) {
  if (role === "attention") {
    return (
      <div className="dashboard-card">
        <div className="card-heading">
          <h2>Vista de atención</h2>
          <span className="tag">Fase 3</span>
        </div>
        <p style={{ fontSize: 14, marginTop: 16 }}>
          Desde aquí recibirás y gestionarás los pedidos de{" "}
          <strong>{restaurantName}</strong>.
        </p>
        <ul style={{ fontSize: 14, color: "var(--muted)", paddingLeft: 20, margin: "20px 0 0" }}>
          <li style={{ padding: "6px 0" }}>Recepción de nuevos pedidos en tiempo real</li>
          <li style={{ padding: "6px 0" }}>Confirmación y actualización de estado</li>
          <li style={{ padding: "6px 0" }}>Comunicación de tiempos al cliente</li>
        </ul>
      </div>
    );
  }
  if (role === "kitchen") {
    return (
      <div className="dashboard-card">
        <div className="card-heading">
          <h2>Vista de cocina</h2>
          <span className="tag">Fase 3</span>
        </div>
        <p style={{ fontSize: 14, marginTop: 16 }}>
          Aquí verás los pedidos activos de{" "}
          <strong>{restaurantName}</strong> que necesitan preparación.
        </p>
        <ul style={{ fontSize: 14, color: "var(--muted)", paddingLeft: 20, margin: "20px 0 0" }}>
          <li style={{ padding: "6px 0" }}>Cola de pedidos por preparar</li>
          <li style={{ padding: "6px 0" }}>Detalle de cada pedido con variantes</li>
          <li style={{ padding: "6px 0" }}>Marcar como listo para entrega</li>
        </ul>
      </div>
    );
  }
  return (
    <>
      <div className="metric-grid">
        <div className="metric">
          <span>Pedidos hoy</span>
          <strong>—</strong>
          <span className="muted" style={{ fontSize: 11 }}>Disponible en fase 3</span>
        </div>
        <div className="metric">
          <span>Productos publicados</span>
          <strong>—</strong>
          <span className="muted" style={{ fontSize: 11 }}>Disponible en fase 3</span>
        </div>
      </div>
      <div className="dashboard-card" style={{ marginTop: 16 }}>
        <div className="card-heading">
          <h2>Funciones en desarrollo</h2>
          <span className="tag">Fase 3</span>
        </div>
        <p style={{ fontSize: 14, marginTop: 16 }}>
          Las siguientes funciones se habilitarán progresivamente:
        </p>
        <ul style={{ fontSize: 14, color: "var(--muted)", paddingLeft: 20, margin: "20px 0 0" }}>
          <li style={{ padding: "6px 0" }}>Gestión de categorías y productos</li>
          <li style={{ padding: "6px 0" }}>Carga de fotografías</li>
          <li style={{ padding: "6px 0" }}>Recepción y seguimiento de pedidos</li>
          <li style={{ padding: "6px 0" }}>Vista de cocina con estados en tiempo real</li>
          <li style={{ padding: "6px 0" }}>Gestión del equipo y configuración</li>
        </ul>
      </div>
    </>
  );
}

export default async function PanelPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { active, options } = await getActiveMembership();
  if (!active) redirect("/panel");

  const { role, restaurant } = active;
  const restaurantName = restaurant.name;

  // Load restaurant status for display
  const { data: restaurantData } = await supabase
    .from("restaurants")
    .select("status")
    .eq("id", active.restaurantId)
    .single();

  const sectionTitle =
    role === "kitchen"   ? "COCINA" :
    role === "attention" ? "ATENCIÓN" :
    "PANEL DE RESTAURANTE";

  return (
    <>
      <div className="dashboard-top">
        <span>{sectionTitle}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span>{restaurantName}</span>
          {restaurantData?.status && (
            <span className="tag">
              {STATUS_LABEL[restaurantData.status] ?? restaurantData.status}
            </span>
          )}
        </div>
      </div>

      <div className="dashboard-content">
        {/* Restaurant switcher for users with multiple memberships */}
        {active.hasMultiple && (
          <div className="dashboard-card" style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 15, marginBottom: 12 }}>Cambiar restaurante</h2>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {options.map((opt) => {
                const isCurrent = opt.restaurantId === active.restaurantId;
                return (
                  <form key={opt.restaurantId} action={selectRestaurant.bind(null, opt.restaurantId)}>
                    <button
                      type="submit"
                      className={isCurrent ? "button small" : "button secondary small"}
                      style={{ fontSize: 12 }}
                    >
                      {opt.restaurantName}
                      {isCurrent && " ✓"}
                    </button>
                  </form>
                );
              })}
            </div>
          </div>
        )}

        <div className="dashboard-heading">
          <div>
            <h1>
              {role === "kitchen"   ? "Cocina" :
               role === "attention" ? "Atención" :
               restaurantName}
            </h1>
            <p>{restaurantName} · {ROLE_LABEL[role]}</p>
          </div>
        </div>

        <RoleContent role={role} restaurantName={restaurantName} />
      </div>
    </>
  );
}
