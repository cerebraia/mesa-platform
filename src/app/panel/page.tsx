import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/sign-out-button";
import { Brand } from "@/components/brand";
import type { MembershipWithRestaurant, MemberRole } from "@/lib/db-types";

const ROLE_LABEL: Record<MemberRole, string> = {
  owner: "Propietario",
  attention: "Atención",
  kitchen: "Cocina",
};

const STATUS_LABEL: Record<string, string> = {
  onboarding: "En configuración",
  active: "Activo",
  suspended: "Suspendido",
};

// Sidebar nav items are scoped to role; kitchen and attention don't
// see product management or settings — the server never returns that
// data to them either (RLS + no queries beyond what their role needs).
const NAV_LINK_STYLE = {
  display: "flex", gap: 14, textAlign: "left" as const,
  border: 0, background: "none", color: "var(--muted)",
  padding: "12px 14px", borderRadius: 9, fontSize: 13, textDecoration: "none",
};

function NavItems({ role }: { role: MemberRole }) {
  return (
    <>
      <button className="active">Inicio</button>
      {/* Pedidos: accessible to all roles */}
      <Link href="/panel/pedidos" style={NAV_LINK_STYLE}>
        {role === "kitchen" ? "Cocina" : "Pedidos"}
      </Link>
      {role === "owner" && (
        <>
          <Link href="/panel/menu" style={NAV_LINK_STYLE}>Menú</Link>
          <button disabled className="muted">Equipo</button>
          <Link href="/panel/configuracion" style={NAV_LINK_STYLE}>Configuración</Link>
        </>
      )}
    </>
  );
}

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
        <ul
          style={{
            fontSize: 14,
            color: "var(--muted)",
            paddingLeft: 20,
            margin: "20px 0 0",
          }}
        >
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
          <strong>{restaurantName}</strong> que necesitan preparación. Las
          siguientes funciones estarán disponibles próximamente:
        </p>
        <ul
          style={{
            fontSize: 14,
            color: "var(--muted)",
            paddingLeft: 20,
            margin: "20px 0 0",
          }}
        >
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
          <span className="muted" style={{ fontSize: 11 }}>
            Disponible en fase 3
          </span>
        </div>
        <div className="metric">
          <span>Productos publicados</span>
          <strong>—</strong>
          <span className="muted" style={{ fontSize: 11 }}>
            Disponible en fase 3
          </span>
        </div>
      </div>

      <div className="dashboard-card" style={{ marginTop: 16 }}>
        <div className="card-heading">
          <h2>Funciones en desarrollo</h2>
          <span className="tag">Fase 3</span>
        </div>
        <p style={{ fontSize: 14, marginTop: 16 }}>
          Este es tu espacio real en Mesa. Las siguientes funciones se
          habilitarán progresivamente:
        </p>
        <ul
          style={{
            fontSize: 14,
            color: "var(--muted)",
            paddingLeft: 20,
            margin: "20px 0 0",
          }}
        >
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

  // Query only own active memberships (RLS: restaurant_members_select restricts
  // to user_id = auth.uid() for non-admins). Role-scoped nav and content are
  // then rendered server-side; no sensitive data beyond what the role needs is
  // fetched or exposed.
  const { data: memberships, error } = await supabase
    .from("restaurant_members")
    .select(
      "id, role, status, restaurant_id, restaurants(id, name, slug, status)",
    )
    .eq("status", "active")
    .returns<MembershipWithRestaurant[]>();

  if (error) {
    throw new Error(`No se pudieron cargar las membresías: ${error.message}`);
  }

  const email = user.email ?? "";
  const initials = email.slice(0, 2).toUpperCase();

  // ── Sin membresías activas ──────────────────────────────────
  if (!memberships || memberships.length === 0) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <header
          className="container"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            minHeight: 64,
            borderBottom: "1px solid var(--border)",
          }}
        >
          <Brand />
          <SignOutButton />
        </header>

        <div className="access-pending">
          <div
            className="avatar"
            style={{ width: 56, height: 56, fontSize: 16, marginBottom: 24 }}
          >
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

  // ── Varios restaurantes: selector ───────────────────────────
  if (memberships.length > 1) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <header
          className="container"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            minHeight: 64,
            borderBottom: "1px solid var(--border)",
          }}
        >
          <Brand />
          <SignOutButton />
        </header>

        <div className="restaurant-selector">
          <h1 style={{ fontSize: 24, letterSpacing: -0.5, marginBottom: 8 }}>
            Selecciona un restaurante
          </h1>
          <p className="muted" style={{ fontSize: 14, marginBottom: 28 }}>
            Tienes acceso a más de un restaurante.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {memberships.map((m) => (
              <Link
                key={m.id}
                href={`/panel?restaurant=${m.restaurant_id}`}
                className="button secondary"
                style={{ justifyContent: "flex-start", gap: 14 }}
              >
                <span className="avatar">
                  {(m.restaurants?.name ?? "?").slice(0, 2).toUpperCase()}
                </span>
                <span>
                  <strong>{m.restaurants?.name ?? "Restaurante"}</strong>
                  <br />
                  <small className="muted">{ROLE_LABEL[m.role]}</small>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Un restaurante ──────────────────────────────────────────
  const membership = memberships[0];
  const restaurant = membership.restaurants;
  const role = membership.role;

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <div>
          <Brand />
        </div>

        <div className="workspace">
          <div className="avatar">{initials}</div>
          <div style={{ minWidth: 0 }}>
            <b
              style={{
                fontSize: 12,
                display: "block",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {restaurant?.name ?? "Restaurante"}
            </b>
            <span className="muted" style={{ fontSize: 11 }}>
              {ROLE_LABEL[role]}
            </span>
          </div>
        </div>

        <nav aria-label="Panel">
          <NavItems role={role} />
        </nav>

        <div className="sidebar-bottom">
          <span style={{ fontSize: 11 }}>{email}</span>
          <SignOutButton />
        </div>
      </aside>

      <main className="dashboard-main">
        <div className="dashboard-top">
          <span>
            {role === "kitchen"
              ? "COCINA"
              : role === "attention"
                ? "ATENCIÓN"
                : "PANEL DE RESTAURANTE"}
          </span>
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
                {role === "kitchen"
                  ? "Cocina"
                  : role === "attention"
                    ? "Atención"
                    : `${restaurant?.name ?? "Tu restaurante"}`}
              </h1>
              <p>
                {restaurant?.name} · {ROLE_LABEL[role]}
              </p>
            </div>
          </div>

          <RoleContent role={role} restaurantName={restaurant?.name ?? "tu restaurante"} />
        </div>
      </main>
    </div>
  );
}
