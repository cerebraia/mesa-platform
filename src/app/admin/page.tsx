import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { Plus, Search, Download, Trash2 } from "lucide-react";
import { BUSINESS_TYPE_LABEL } from "@/lib/db-types";
import type { BusinessType } from "@/lib/db-types";
import { DeleteRestaurantModal } from "./restaurants/[id]/delete-modal";

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

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp = await searchParams;
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const q            = sp.q       ?? "";
  const status       = sp.status  ?? "";
  const bizType      = sp.tipo    ?? "";
  const planFilter   = sp.plan    ?? "";
  const tab          = sp.tab     ?? "active"; // "active" | "deleted"
  const page         = parseInt(sp.pagina ?? "1") || 1;
  const perPage      = 20;

  const isDeleted = tab === "deleted";

  let query = supabase
    .from("restaurants")
    .select(`id, name, slug, status, currency, business_type, created_at, deleted_at,
      subscriptions ( id, status, ends_at, plans ( id, name ) )
    `)
    .order("created_at", { ascending: false });

  if (isDeleted) {
    query = query.not("deleted_at", "is", null);
  } else {
    query = query.is("deleted_at", null);
    if (status)  query = query.eq("status", status);
    if (bizType) query = query.eq("business_type", bizType);
  }

  if (q) query = query.ilike("name", `%${q}%`);
  query = query.range((page - 1) * perPage, page * perPage - 1);

  const { data: restaurants, error } = await query;

  const { count: total } = await supabase
    .from("restaurants")
    .select("*", { count: "exact", head: true })
    .is("deleted_at", null);

  const { count: deletedCount } = await supabase
    .from("restaurants")
    .select("*", { count: "exact", head: true })
    .not("deleted_at", "is", null);

  // Load plans for filter
  const { data: allPlans } = await supabase
    .from("plans")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

  type PlanRef = { id: string; name: string };
  type RestaurantRow = {
    id: string; name: string; slug: string; status: string;
    currency: string; business_type: BusinessType; created_at: string; deleted_at: string | null;
    subscriptions: Array<{ id: string; status: string; ends_at: string | null; plans: PlanRef | null }>;
  };

  let rows = (restaurants ?? []) as unknown as RestaurantRow[];

  // Plan filter: applied after query since it's a nested relation
  if (!isDeleted && planFilter) {
    rows = rows.filter((r) =>
      r.subscriptions?.some((s) => s.status === "active" && s.plans?.id === planFilter),
    );
  }

  function getActiveSub(row: RestaurantRow) {
    return row.subscriptions?.find(
      (s) => s.status === "active" && (!s.ends_at || new Date(s.ends_at) > new Date()),
    ) ?? null;
  }

  const hasFilters = q || status || bizType || planFilter;
  const plans = (allPlans ?? []) as PlanRef[];

  // Build URLSearchParams helper preserving current filters
  function pageUrl(p: number) {
    const ps = new URLSearchParams();
    if (q)        ps.set("q", q);
    if (status)   ps.set("status", status);
    if (bizType)  ps.set("tipo", bizType);
    if (planFilter) ps.set("plan", planFilter);
    if (tab !== "active") ps.set("tab", tab);
    ps.set("pagina", String(p));
    return `/admin?${ps}`;
  }

  function tabUrl(t: string) {
    const ps = new URLSearchParams();
    if (q) ps.set("q", q);
    ps.set("tab", t);
    return `/admin?${ps}`;
  }

  return (
    <>
      <div className="panel-page-header">
        <div>
          <h1 className="panel-page-title">Negocios</h1>
          <p className="panel-page-desc">
            {total != null ? `${total} activo${total !== 1 ? "s" : ""}` : "Todos los negocios de la plataforma"}
            {deletedCount ? ` · ${deletedCount} eliminado${deletedCount !== 1 ? "s" : ""}` : ""}
          </p>
        </div>
        <div className="panel-page-actions" style={{ flexWrap: "wrap" }}>
          <a
            href="/api/admin/export?type=restaurants"
            className="button secondary small"
            style={{ fontSize: 12 }}
          >
            <Download size={13} />
            Exportar
          </a>
          <Link href="/admin/restaurants/new" className="button small" style={{ fontSize: 13 }}>
            <Plus size={14} />
            Nuevo negocio
          </Link>
        </div>
      </div>

      <div className="panel-content">
        {/* Tabs */}
        <div className="panel-tabs" style={{ marginBottom: 16 }}>
          <Link
            href={tabUrl("active")}
            className={`panel-tab${!isDeleted ? " panel-tab--active" : ""}`}
          >
            Negocios activos {total != null ? `(${total})` : ""}
          </Link>
          <Link
            href={tabUrl("deleted")}
            className={`panel-tab${isDeleted ? " panel-tab--active" : ""}`}
          >
            <Trash2 size={13} style={{ marginRight: 4 }} />
            Eliminados {deletedCount ? `(${deletedCount})` : ""}
          </Link>
        </div>

        {error && (
          <div className="auth-error" role="alert" style={{ marginBottom: 16 }}>
            Error al cargar: {error.message}
          </div>
        )}

        {/* Filter bar — only for active tab */}
        {!isDeleted && (
          <form className="panel-filter-bar">
            <div className="filter-search-wrap">
              <Search size={14} />
              <input
                name="q"
                type="search"
                defaultValue={q}
                placeholder="Buscar por nombre…"
                aria-label="Buscar negocio"
              />
            </div>
            <select name="tipo" defaultValue={bizType}>
              <option value="">Todos los tipos</option>
              <option value="restaurant">Restaurante</option>
              <option value="store">Tienda</option>
              <option value="other">Otro</option>
            </select>
            <select name="status" defaultValue={status}>
              <option value="">Todos los estados</option>
              <option value="onboarding">En configuración</option>
              <option value="active">Activo</option>
              <option value="suspended">Suspendido</option>
            </select>
            {plans.length > 0 && (
              <select name="plan" defaultValue={planFilter}>
                <option value="">Todos los planes</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )}
            <button type="submit" className="button small" style={{ fontSize: 12 }}>
              Buscar
            </button>
            {hasFilters && (
              <Link href="/admin" className="filter-clear">Limpiar</Link>
            )}
            <span className="filter-count">{rows.length} resultado{rows.length !== 1 ? "s" : ""}</span>
          </form>
        )}

        {isDeleted && q && (
          <form className="panel-filter-bar" style={{ marginBottom: 12 }}>
            <div className="filter-search-wrap">
              <Search size={14} />
              <input name="q" type="search" defaultValue={q} placeholder="Buscar eliminados…" />
            </div>
            <input type="hidden" name="tab" value="deleted" />
            <button type="submit" className="button small" style={{ fontSize: 12 }}>Buscar</button>
          </form>
        )}

        {rows.length === 0 ? (
          <div className="panel-empty">
            <div className="panel-empty-icon"><Search size={24} strokeWidth={1.5} /></div>
            <p className="panel-empty-title">
              {isDeleted
                ? "Sin negocios eliminados"
                : hasFilters ? "Sin resultados" : "Sin negocios"}
            </p>
            <p className="panel-empty-desc">
              {isDeleted
                ? "Cuando elimines un negocio aparecerá aquí para poder restaurarlo."
                : hasFilters
                  ? "Ningún negocio coincide con los filtros."
                  : "Crea el primer negocio de la plataforma."}
            </p>
          </div>
        ) : (
          <div className="dashboard-card" style={{ padding: 0, overflow: "hidden" }}>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Negocio</th>
                    <th>Tipo</th>
                    <th>Estado</th>
                    <th>Plan activo</th>
                    <th>Moneda</th>
                    {isDeleted && <th>Eliminado</th>}
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const activeSub = getActiveSub(r);
                    return (
                      <tr key={r.id} style={{ opacity: isDeleted ? 0.75 : 1 }}>
                        <td>
                          <div style={{ fontWeight: 600, color: "#202337" }}>{r.name}</div>
                          <div style={{ fontSize: 11, color: "#667085", marginTop: 2 }}>/{r.slug}</div>
                        </td>
                        <td>
                          <span style={{ fontSize: 12, color: "#667085" }}>
                            {BUSINESS_TYPE_LABEL[r.business_type] ?? r.business_type}
                          </span>
                        </td>
                        <td>
                          {isDeleted ? (
                            <span className="order-status-badge badge-rejected">Eliminado</span>
                          ) : (
                            <span className={`order-status-badge ${STATUS_BADGE[r.status] ?? "badge-cancelled"}`}>
                              {STATUS_LABEL[r.status] ?? r.status}
                            </span>
                          )}
                        </td>
                        <td>
                          {activeSub ? (
                            <span className="order-status-badge badge-ready" style={{ fontSize: 11 }}>
                              {activeSub.plans?.name ?? "—"}
                            </span>
                          ) : (
                            <span style={{ fontSize: 12, color: "#667085" }}>Sin suscripción</span>
                          )}
                        </td>
                        <td style={{ fontSize: 12, color: "#667085" }}>{r.currency}</td>
                        {isDeleted && (
                          <td style={{ fontSize: 11, color: "#667085" }}>
                            {r.deleted_at ? new Date(r.deleted_at).toLocaleDateString("es-VE") : "—"}
                          </td>
                        )}
                        <td>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <Link
                              href={`/admin/restaurants/${r.id}`}
                              className="button secondary small"
                              style={{ fontSize: 12, whiteSpace: "nowrap" }}
                            >
                              Ver
                            </Link>
                            {!isDeleted && !r.deleted_at && (
                              <DeleteRestaurantModal
                                restaurantId={r.id}
                                restaurantName={r.name}
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pagination */}
        {(rows.length === perPage || page > 1) && (
          <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end", alignItems: "center" }}>
            {page > 1 && (
              <Link href={pageUrl(page - 1)} className="button secondary small">← Anterior</Link>
            )}
            <span style={{ fontSize: 12, color: "#667085" }}>Página {page}</span>
            {rows.length === perPage && (
              <Link href={pageUrl(page + 1)} className="button secondary small">Siguiente →</Link>
            )}
          </div>
        )}
      </div>
    </>
  );
}

export const dynamic = "force-dynamic";
