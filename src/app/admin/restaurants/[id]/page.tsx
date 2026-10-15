import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { Brand } from "@/components/brand";
import { SignOutButton } from "@/components/sign-out-button";
import { RestaurantEditForm } from "./restaurant-edit-form";
import { AssignOwnerForm } from "./assign-owner-form";
import { StatusForm } from "./status-form";
import { NewSubscriptionForm } from "./new-subscription-form";
import { SubscriptionRow } from "./subscription-row";
import { DomainsAdmin } from "./domains-admin";

const STATUS_LABEL: Record<string, string> = {
  onboarding: "En configuración",
  active:     "Activo",
  suspended:  "Suspendido",
};

const STATUS_COLOR: Record<string, string> = {
  onboarding: "#703BE6",
  active:     "#2e7d32",
  suspended:  "#c62828",
};

export default async function RestaurantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: adminRow } = await supabase
    .from("platform_admins").select("user_id").maybeSingle();
  if (!adminRow) redirect("/panel");

  // Load restaurant
  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id, name, slug, currency, timezone, status, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!restaurant) notFound();

  // Load members to find owner
  const { data: members } = await supabase
    .from("restaurant_members")
    .select("id, user_id, role, status")
    .eq("restaurant_id", id);

  // Load subscriptions with plan info
  const { data: subscriptions } = await supabase
    .from("subscriptions")
    .select(`
      id, status, starts_at, ends_at, notes, created_at,
      plans ( id, name, price_cents, currency )
    `)
    .eq("restaurant_id", id)
    .order("created_at", { ascending: false });

  // Load all active plans for the new subscription form
  const { data: plans } = await supabase
    .from("plans")
    .select("id, name, price_cents, currency, is_test")
    .eq("is_active", true)
    .order("created_at");

  // Load subscription payments
  const subIds = (subscriptions ?? []).map((s) => s.id);
  const { data: payments } = subIds.length > 0
    ? await supabase
        .from("subscription_payments")
        .select("id, subscription_id, amount_cents, currency, paid_at, reference, notes")
        .in("subscription_id", subIds)
        .order("paid_at", { ascending: false })
    : { data: [] };

  // Load domains
  const { data: domains } = await supabase
    .from("restaurant_domains")
    .select("id, host, kind, status, requested_by, updated_at")
    .eq("restaurant_id", id)
    .order("updated_at", { ascending: false });

  type Member = { id: string; user_id: string; role: string; status: string };
  type Plan = { id: string; name: string; price_cents: number; currency: string };
  type Sub = {
    id: string; status: string; starts_at: string; ends_at: string | null;
    notes: string | null; created_at: string;
    plans: Plan | null;
  };
  type Payment = {
    id: string; subscription_id: string; amount_cents: number;
    currency: string; paid_at: string; reference: string | null; notes: string | null;
  };

  type DomainRow = {
    id: string; host: string; kind: string; status: string;
    requested_by: string | null; updated_at: string;
  };

  const memberRows  = (members ?? []) as Member[];
  const subRows     = (subscriptions ?? []) as unknown as Sub[];
  const planRows    = (plans ?? []) as (Plan & { is_test: boolean })[];
  const paymentRows = (payments ?? []) as Payment[];
  const domainRows  = (domains ?? []) as DomainRow[];

  const ownerMember = memberRows.find((m) => m.role === "owner" && m.status === "active");

  const activeSub = subRows.find(
    (s) => s.status === "active" && (!s.ends_at || new Date(s.ends_at) > new Date()),
  );

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
            background: "var(--soft)", color: "var(--purple)",
            padding: "12px 14px", borderRadius: 9, fontSize: 13,
            textDecoration: "none", fontWeight: 600,
          }}>
            Restaurantes
          </Link>
          <Link href="/admin/planes" style={{
            display: "flex", gap: 14, textAlign: "left", border: 0,
            background: "none", color: "var(--muted)",
            padding: "12px 14px", borderRadius: 9, fontSize: 13,
            textDecoration: "none",
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
          <span>RESTAURANTE</span>
          <Link href="/admin" className="muted" style={{ fontSize: 11, textDecoration: "none" }}>
            ← Todos los restaurantes
          </Link>
        </div>

        <div className="dashboard-content">
          <div className="dashboard-heading">
            <div>
              <h1>{restaurant.name}</h1>
              <p>
                <span className="caption">{restaurant.slug}</span>
                {"  ·  "}
                <span
                  className="tag"
                  style={{
                    background: `${STATUS_COLOR[restaurant.status] ?? "#777"}18`,
                    color: STATUS_COLOR[restaurant.status] ?? "#777",
                  }}
                >
                  {STATUS_LABEL[restaurant.status] ?? restaurant.status}
                </span>
                {activeSub && (
                  <span className="tag" style={{ marginLeft: 6, background: "#e8f5e918", color: "#2e7d32" }}>
                    {activeSub.plans?.name}
                  </span>
                )}
              </p>
            </div>
            <Link href={`/r/${restaurant.slug}`} target="_blank" className="button secondary small" style={{ fontSize: 12 }}>
              Ver menú ↗
            </Link>
          </div>

          {/* Edit basic data */}
          <section className="dashboard-card" style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 17, marginBottom: 18 }}>Datos del negocio</h2>
            <RestaurantEditForm
              restaurantId={id}
              defaultName={restaurant.name}
              defaultCurrency={restaurant.currency}
              defaultTimezone={restaurant.timezone}
            />
          </section>

          {/* Owner */}
          <section className="dashboard-card" style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 17, marginBottom: 6 }}>Dueño</h2>
            {ownerMember ? (
              <div style={{ marginBottom: 18 }}>
                <p style={{ fontSize: 13, color: "var(--ink)" }}>
                  Usuario activo: <code style={{ fontSize: 12 }}>{ownerMember.user_id}</code>
                </p>
                <span className="caption">Cambiar dueño asignará el rol al nuevo correo.</span>
              </div>
            ) : (
              <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 18 }}>
                Sin dueño asignado todavía.
              </p>
            )}
            <AssignOwnerForm restaurantId={id} />
          </section>

          {/* Status / suspend */}
          <section className="dashboard-card" style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 17, marginBottom: 6 }}>Estado del negocio</h2>
            <p className="caption" style={{ marginBottom: 18 }}>
              Suspender impide nuevos pedidos. Los pedidos existentes y datos se conservan.
              La reactivación requiere suscripción válida o eliminar la suscripción caducada.
            </p>
            <StatusForm
              restaurantId={id}
              currentStatus={restaurant.status}
            />
          </section>

          {/* Subscriptions */}
          <section className="dashboard-card" style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 17, marginBottom: 4 }}>Suscripciones</h2>
            <p className="caption" style={{ marginBottom: 18 }}>
              Solo los planes marcados como prueba se usan en desarrollo. No publiques
              tarifas comerciales hasta estar en producción.
            </p>

            {subRows.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 18 }}>
                Sin suscripciones registradas. El restaurante opera en modo onboarding libre.
              </p>
            ) : (
              <div className="table-scroll" style={{ marginBottom: 24 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Plan</th>
                      <th>Estado</th>
                      <th>Inicio</th>
                      <th>Vencimiento</th>
                      <th>Pagos</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {subRows.map((sub) => (
                      <SubscriptionRow
                        key={sub.id}
                        sub={sub}
                        restaurantId={id}
                        payments={paymentRows.filter((p) => p.subscription_id === sub.id)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <details style={{ marginTop: 8 }}>
              <summary style={{ fontSize: 13, color: "var(--purple)", cursor: "pointer", fontWeight: 600 }}>
                + Nueva suscripción
              </summary>
              <div style={{ marginTop: 16 }}>
                <NewSubscriptionForm
                  restaurantId={id}
                  plans={planRows}
                />
              </div>
            </details>
          </section>

          {/* Domains */}
          <section className="dashboard-card" style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 17, marginBottom: 6 }}>Dominios</h2>
            <p className="caption" style={{ marginBottom: 18 }}>
              Activa un dominio solo tras verificar manualmente el DNS y configurar Railway.
              Activar aquí no configura Railway ni emite certificados.
            </p>
            <DomainsAdmin restaurantId={id} domains={domainRows} />
          </section>

          {/* Members summary */}
          {memberRows.length > 0 && (
            <section className="dashboard-card">
              <h2 style={{ fontSize: 17, marginBottom: 18 }}>Miembros ({memberRows.length})</h2>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>User ID</th>
                      <th>Rol</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {memberRows.map((m) => (
                      <tr key={m.id}>
                        <td>
                          <code style={{ fontSize: 11 }}>{m.user_id}</code>
                        </td>
                        <td>
                          <span className="tag">{m.role}</span>
                        </td>
                        <td>
                          <span
                            className="tag"
                            style={m.status === "active"
                              ? { color: "#2e7d32", background: "#e8f5e918" }
                              : undefined}
                          >
                            {m.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

export const dynamic = "force-dynamic";
