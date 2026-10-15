import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import type { MembershipWithRestaurant, MemberRole } from "@/lib/db-types";

// The layout (layout.tsx) handles auth, membership check, and the shell.
// This page renders only the content area.

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
          <strong>{restaurantName}</strong>. Las siguientes funciones estarán
          disponibles próximamente:
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
  // owner
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
          Este es tu espacio real en Mesa. Las siguientes funciones se habilitarán progresivamente:
        </p>
        <ul style={{ fontSize: 14, color: "var(--muted)", paddingLeft: 20, margin: "20px 0 0" }}>
          <li style={{ padding: "6px 0" }}>Gestión de categorías y productos</li>
          <li style={{ padding: "6px 0" }}>Carga de fotografías desde Supabase Storage</li>
          <li style={{ padding: "6px 0" }}>Recepción y seguimiento de pedidos</li>
          <li style={{ padding: "6px 0" }}>Vista de cocina con estados en tiempo real</li>
          <li style={{ padding: "6px 0" }}>Gestión del equipo y configuración del restaurante</li>
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

  const { data: memberships, error } = await supabase
    .from("restaurant_members")
    .select("id, role, status, restaurant_id, restaurants(id, name, slug, status)")
    .eq("status", "active")
    .returns<MembershipWithRestaurant[]>();

  if (error) {
    throw new Error(`No se pudieron cargar las membresías: ${error.message}`);
  }

  // Layout handles the no-membership case, but guard here too for safety.
  if (!memberships?.length) {
    redirect("/panel");
  }

  const membership   = memberships[0];
  const restaurant   = membership.restaurants;
  const role         = membership.role;
  const restaurantName = restaurant?.name ?? "Tu restaurante";

  const sectionTitle =
    role === "kitchen"   ? "COCINA" :
    role === "attention" ? "ATENCIÓN" :
    "PANEL DE RESTAURANTE";

  return (
    <>
      <div className="dashboard-top">
        <span>{sectionTitle}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span>{restaurant?.name ?? ""}</span>
          <span className="tag">
            {STATUS_LABEL[restaurant?.status ?? ""] ?? restaurant?.status}
          </span>
        </div>
      </div>

      <div className="dashboard-content">
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
