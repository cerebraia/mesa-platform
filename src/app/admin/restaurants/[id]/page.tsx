import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { ArrowLeft, ExternalLink } from "lucide-react";
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

const STATUS_BADGE: Record<string, string> = {
  onboarding: "badge-accepted",
  active:     "badge-ready",
  suspended:  "badge-rejected",
};

const ROLE_LABEL: Record<string, string> = {
  owner:     "Propietario",
  attention: "Atención",
  kitchen:   "Cocina",
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

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id, name, slug, currency, timezone, status, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!restaurant) notFound();

  const [
    { data: members },
    { data: subscriptions },
    { data: plans },
    { data: domains },
  ] = await Promise.all([
    supabase.from("restaurant_members").select("id, user_id, role, status").eq("restaurant_id", id),
    supabase.from("subscriptions")
      .select(`id, status, starts_at, ends_at, notes, created_at, plans ( id, name, price_cents, currency )`)
      .eq("restaurant_id", id).order("created_at", { ascending: false }),
    supabase.from("plans").select("id, name, price_cents, currency, is_test, plan_code").eq("is_active", true).order("price_cents"),
    supabase.from("restaurant_domains")
      .select("id, host, kind, status, requested_by, updated_at")
      .eq("restaurant_id", id).order("updated_at", { ascending: false }),
  ]);

  type Member  = { id: string; user_id: string; role: string; status: string };
  type Plan    = { id: string; name: string; price_cents: number; currency: string; plan_code: string | null };
  type Sub     = {
    id: string; status: string; starts_at: string; ends_at: string | null;
    notes: string | null; created_at: string;
    plans: Plan | null;
  };
  type DomainRow = {
    id: string; host: string; kind: string; status: string;
    requested_by: string | null; updated_at: string;
  };

  const memberRows  = (members  ?? []) as Member[];
  const subRows     = (subscriptions ?? []) as unknown as Sub[];
  const planRows    = (plans ?? []) as (Plan & { is_test: boolean; plan_code: string | null })[];
  const domainRows  = (domains ?? []) as DomainRow[];

  const ownerMember = memberRows.find((m) => m.role === "owner" && m.status === "active");

  const activeSub = subRows.find(
    (s) => s.status === "active" && (!s.ends_at || new Date(s.ends_at) > new Date()),
  );

  const subPaymentIds = subRows.map((s) => s.id);
  const { data: payments } = subPaymentIds.length > 0
    ? await supabase
        .from("subscription_payments")
        .select("id, subscription_id, amount_cents, currency, paid_at, reference, notes")
        .in("subscription_id", subPaymentIds)
        .order("paid_at", { ascending: false })
    : { data: [] };

  type Payment = {
    id: string; subscription_id: string; amount_cents: number;
    currency: string; paid_at: string; reference: string | null; notes: string | null;
  };
  const paymentRows = (payments ?? []) as Payment[];

  return (
    <>
      <div className="panel-page-header">
        <div>
          <div className="panel-breadcrumb">
            <Link href="/admin" className="panel-breadcrumb-link">
              <ArrowLeft size={13} />
              Restaurantes
            </Link>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 4 }}>
            <h1 className="panel-page-title" style={{ margin: 0 }}>{restaurant.name}</h1>
            <span className={`order-status-badge ${STATUS_BADGE[restaurant.status] ?? "badge-cancelled"}`}>
              {STATUS_LABEL[restaurant.status] ?? restaurant.status}
            </span>
            {activeSub && (
              <span className="order-status-badge badge-accepted">
                {activeSub.plans?.name}
              </span>
            )}
          </div>
          <p className="panel-page-desc" style={{ marginTop: 4 }}>/{restaurant.slug} · {restaurant.currency}</p>
        </div>
        <div className="panel-page-actions">
          <Link
            href={`/r/${restaurant.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ver-menu"
          >
            <ExternalLink size={13} />
            Ver menú
          </Link>
        </div>
      </div>

      <div className="panel-content">
        <div className="admin-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20, alignItems: "start" }}>

          {/* ── Left column ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Datos básicos */}
            <section className="dashboard-card">
              <h2 className="admin-section-title">Datos del negocio</h2>
              <RestaurantEditForm
                restaurantId={id}
                defaultName={restaurant.name}
                defaultCurrency={restaurant.currency}
                defaultTimezone={restaurant.timezone}
              />
            </section>

            {/* Suscripciones */}
            <section className="dashboard-card">
              <h2 className="admin-section-title">Suscripciones</h2>
              <p style={{ fontSize: 13, color: "#667085", marginBottom: 16 }}>
                Solo los planes marcados como prueba se usan en desarrollo.
              </p>

              {subRows.length === 0 ? (
                <p style={{ fontSize: 13, color: "#667085", marginBottom: 20 }}>
                  Sin suscripciones. El restaurante opera en modo onboarding libre.
                </p>
              ) : (
                <div className="table-scroll" style={{ marginBottom: 20 }}>
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

              <details>
                <summary style={{ fontSize: 13, color: "var(--purple)", cursor: "pointer", fontWeight: 600, userSelect: "none" }}>
                  + Nueva suscripción
                </summary>
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
                  <NewSubscriptionForm restaurantId={id} plans={planRows} />
                </div>
              </details>
            </section>

            {/* Dominios */}
            <section className="dashboard-card">
              <h2 className="admin-section-title">Dominios personalizados</h2>
              <p style={{ fontSize: 13, color: "#667085", marginBottom: 16 }}>
                Activa un dominio solo tras verificar el DNS y configurar Railway. Estos pasos son independientes.
              </p>
              <DomainsAdmin restaurantId={id} domains={domainRows} />
            </section>

            {/* Miembros */}
            {memberRows.length > 0 && (
              <section className="dashboard-card">
                <h2 className="admin-section-title">Miembros ({memberRows.length})</h2>
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
                            <code style={{ fontSize: 11, color: "#667085" }}>{m.user_id}</code>
                          </td>
                          <td>
                            <span className="order-status-badge badge-accepted">
                              {ROLE_LABEL[m.role] ?? m.role}
                            </span>
                          </td>
                          <td>
                            <span className={`order-status-badge ${m.status === "active" ? "badge-ready" : "badge-cancelled"}`}>
                              {m.status === "active" ? "Activo" : m.status}
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

          {/* ── Right column ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Dueño */}
            <section className="dashboard-card">
              <h2 className="admin-section-title">Propietario</h2>
              {ownerMember ? (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 13, color: "#202337", marginBottom: 4 }}>
                    Dueño activo asignado
                  </div>
                  <code style={{ fontSize: 11, color: "#667085", wordBreak: "break-all" }}>
                    {ownerMember.user_id}
                  </code>
                  <p className="caption" style={{ marginTop: 6 }}>
                    Asignar a otro correo transfiere el rol de propietario.
                  </p>
                </div>
              ) : (
                <p style={{ fontSize: 13, color: "#667085", marginBottom: 16 }}>
                  Sin dueño asignado todavía.
                </p>
              )}
              <AssignOwnerForm restaurantId={id} />
            </section>

            {/* Estado del negocio */}
            <section className="dashboard-card">
              <h2 className="admin-section-title">Estado del negocio</h2>
              <p style={{ fontSize: 13, color: "#667085", marginBottom: 16 }}>
                Suspender bloquea nuevos pedidos. Los datos se conservan.
                Reactivar requiere suscripción vigente o ninguna suscripción registrada.
              </p>
              <div style={{ marginBottom: 12 }}>
                <span style={{ fontSize: 12, color: "#667085" }}>Estado actual: </span>
                <span className={`order-status-badge ${STATUS_BADGE[restaurant.status] ?? "badge-cancelled"}`}>
                  {STATUS_LABEL[restaurant.status] ?? restaurant.status}
                </span>
              </div>
              <StatusForm restaurantId={id} currentStatus={restaurant.status} />
            </section>

            {/* Info extra */}
            <section className="dashboard-card">
              <h2 className="admin-section-title">Información</h2>
              <dl style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { label: "ID",         val: <code style={{ fontSize: 11 }}>{id}</code> },
                  { label: "Slug",       val: `/${restaurant.slug}` },
                  { label: "Moneda",     val: restaurant.currency },
                  { label: "Zona hor.",  val: restaurant.timezone },
                  { label: "Creado",     val: new Date(restaurant.created_at).toLocaleDateString("es-VE") },
                ].map(({ label, val }) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13 }}>
                    <dt style={{ color: "#667085", flexShrink: 0 }}>{label}</dt>
                    <dd style={{ color: "#202337", textAlign: "right", wordBreak: "break-all", margin: 0 }}>{val}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}

export const dynamic = "force-dynamic";
