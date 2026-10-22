import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { Plus, Search } from "lucide-react";

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

const SUB_BADGE: Record<string, string> = {
  active:    "badge-ready",
  expired:   "badge-rejected",
  cancelled: "badge-cancelled",
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

  const q       = sp.q ?? "";
  const status  = sp.status ?? "";
  const page    = parseInt(sp.pagina ?? "1") || 1;
  const perPage = 20;

  let query = supabase
    .from("restaurants")
    .select(`id, name, slug, status, currency, created_at,
      subscriptions ( id, status, ends_at, plans ( name ) )
    `)
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);
  if (q)      query = query.ilike("name", `%${q}%`);

  query = query.range((page - 1) * perPage, page * perPage - 1);

  const { data: restaurants, error } = await query;

  const { count: total } = await supabase
    .from("restaurants")
    .select("*", { count: "exact", head: true });

  type RestaurantRow = {
    id: string; name: string; slug: string; status: string;
    currency: string; created_at: string;
    subscriptions: Array<{ id: string; status: string; ends_at: string | null; plans: { name: string } | null }>;
  };

  const rows = (restaurants ?? []) as unknown as RestaurantRow[];

  function getActiveSub(row: RestaurantRow) {
    return row.subscriptions?.find(
      (s) => s.status === "active" && (!s.ends_at || new Date(s.ends_at) > new Date()),
    ) ?? null;
  }

  const hasFilters = q || status;

  return (
    <>
      <div className="panel-page-header">
        <div>
          <h1 className="panel-page-title">Restaurantes</h1>
          <p className="panel-page-desc">
            {total != null ? `${total} registrado${total !== 1 ? "s" : ""}` : "Todos los negocios de la plataforma"}
          </p>
        </div>
        <div className="panel-page-actions">
          <Link href="/admin/restaurants/new" className="button small" style={{ fontSize: 13 }}>
            <Plus size={14} />
            Nuevo restaurante
          </Link>
        </div>
      </div>

      <div className="panel-content">
        {error && (
          <div className="auth-error" role="alert" style={{ marginBottom: 16 }}>
            Error al cargar: {error.message}
          </div>
        )}

        {/* Filter bar */}
        <form className="panel-filter-bar">
          <div className="filter-search-wrap">
            <Search size={14} />
            <input
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Buscar por nombre…"
              aria-label="Buscar restaurante"
            />
          </div>
          <select name="status" defaultValue={status}>
            <option value="">Todos los estados</option>
            <option value="onboarding">En configuración</option>
            <option value="active">Activo</option>
            <option value="suspended">Suspendido</option>
          </select>
          <button type="submit" className="button small" style={{ fontSize: 12 }}>
            Buscar
          </button>
          {hasFilters && (
            <Link href="/admin" className="filter-clear">
              Limpiar filtros
            </Link>
          )}
          <span className="filter-count">{rows.length} resultado{rows.length !== 1 ? "s" : ""}</span>
        </form>

        {rows.length === 0 ? (
          <div className="panel-empty">
            <div className="panel-empty-icon">
              <Search size={24} strokeWidth={1.5} />
            </div>
            <p className="panel-empty-title">
              {hasFilters ? "Sin resultados" : "Sin restaurantes"}
            </p>
            <p className="panel-empty-desc">
              {hasFilters
                ? "Ningún restaurante coincide con los filtros aplicados."
                : "Crea el primer restaurante de la plataforma."}
            </p>
            {hasFilters && (
              <Link href="/admin" className="button secondary small" style={{ marginTop: 4 }}>
                Limpiar filtros
              </Link>
            )}
          </div>
        ) : (
          <div className="dashboard-card" style={{ padding: 0, overflow: "hidden" }}>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Restaurante</th>
                    <th>Estado</th>
                    <th>Plan activo</th>
                    <th>Vencimiento</th>
                    <th>Moneda</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const activeSub  = getActiveSub(r);
                    const isExpired  = activeSub?.ends_at && new Date(activeSub.ends_at) < new Date();
                    return (
                      <tr key={r.id}>
                        <td>
                          <div style={{ fontWeight: 600, color: "#202337" }}>{r.name}</div>
                          <div style={{ fontSize: 11, color: "#667085", marginTop: 2 }}>/{r.slug}</div>
                        </td>
                        <td>
                          <span className={`order-status-badge ${STATUS_BADGE[r.status] ?? "badge-cancelled"}`}>
                            {STATUS_LABEL[r.status] ?? r.status}
                          </span>
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
                        <td>
                          {activeSub?.ends_at ? (
                            <span style={{ fontSize: 12, color: isExpired ? "#c62828" : "#667085" }}>
                              {new Date(activeSub.ends_at).toLocaleDateString("es-VE")}
                            </span>
                          ) : activeSub ? (
                            <span style={{ fontSize: 12, color: "#667085" }}>Indefinida</span>
                          ) : (
                            <span style={{ color: "#667085" }}>—</span>
                          )}
                        </td>
                        <td style={{ fontSize: 12, color: "#667085" }}>{r.currency}</td>
                        <td>
                          <Link
                            href={`/admin/restaurants/${r.id}`}
                            className="button secondary small"
                            style={{ fontSize: 12, whiteSpace: "nowrap" }}
                          >
                            Ver restaurante
                          </Link>
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
              <Link
                href={`/admin?pagina=${page - 1}${q ? `&q=${encodeURIComponent(q)}` : ""}${status ? `&status=${status}` : ""}`}
                className="button secondary small"
              >
                ← Anterior
              </Link>
            )}
            <span style={{ fontSize: 12, color: "#667085" }}>Página {page}</span>
            {rows.length === perPage && (
              <Link
                href={`/admin?pagina=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ""}${status ? `&status=${status}` : ""}`}
                className="button secondary small"
              >
                Siguiente →
              </Link>
            )}
          </div>
        )}
      </div>
    </>
  );
}

export const dynamic = "force-dynamic";
