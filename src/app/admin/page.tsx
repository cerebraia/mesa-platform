import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { Brand } from "@/components/brand";
import { SignOutButton } from "@/components/sign-out-button";

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
    .select(`id, name, slug, status, currency, timezone, created_at,
      subscriptions ( id, status, ends_at, plan_id, plans ( name ) )
    `)
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);
  if (q)      query = query.ilike("name", `%${q}%`);

  query = query.range((page - 1) * perPage, page * perPage - 1);

  const { data: restaurants, error } = await query;

  const [{ count: total }] = await Promise.all([
    supabase.from("restaurants").select("*", { count: "exact", head: true }),
  ]);

  type RestaurantRow = {
    id: string; name: string; slug: string; status: string;
    currency: string; timezone: string; created_at: string;
    subscriptions: Array<{ id: string; status: string; ends_at: string | null; plan_id: string; plans: { name: string } | null }>;
  };

  const rows = (restaurants ?? []) as unknown as RestaurantRow[];

  function getActiveSub(row: RestaurantRow) {
    return row.subscriptions?.find(
      (s) => s.status === "active" && (!s.ends_at || new Date(s.ends_at) > new Date()),
    ) ?? null;
  }

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <Brand />
        <div className="workspace">
          <div className="avatar">{(user.email ?? "").slice(0, 2).toUpperCase()}</div>
          <div>
            <b style={{ fontSize: 12, display: "block" }}>Administración</b>
            <span className="muted" style={{ fontSize: 11 }}>Platform Admin</span>
          </div>
        </div>
        <nav aria-label="Admin">
          <Link href="/admin" style={{ display: "flex", gap: 14, textAlign: "left", border: 0, background: "var(--soft)", color: "var(--purple)", padding: "12px 14px", borderRadius: 9, fontSize: 13, textDecoration: "none", fontWeight: 600 }}>
            Restaurantes
          </Link>
          <Link href="/admin/planes" style={{ display: "flex", gap: 14, textAlign: "left", border: 0, background: "none", color: "var(--muted)", padding: "12px 14px", borderRadius: 9, fontSize: 13, textDecoration: "none" }}>
            Planes
          </Link>
          <button disabled className="muted">Dominios</button>
        </nav>
        <div className="sidebar-bottom">
          <span style={{ fontSize: 11 }}>{user.email}</span>
          <SignOutButton />
        </div>
      </aside>

      <main className="dashboard-main">
        <div className="dashboard-top">
          <span>ADMINISTRACIÓN DE PLATAFORMA</span>
          <span>{total ?? 0} restaurantes</span>
        </div>

        <div className="dashboard-content">
          <div className="dashboard-heading">
            <div>
              <h1>Restaurantes</h1>
              <p>Gestión de todos los negocios de la plataforma.</p>
            </div>
            <Link href="/admin/restaurants/new" className="button" style={{ fontSize: 13 }}>
              + Nuevo restaurante
            </Link>
          </div>

          {error && (
            <div className="auth-error" role="alert" style={{ marginBottom: 16 }}>
              Error al cargar: {error.message}
            </div>
          )}

          {/* Search + filters */}
          <form style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
            <input
              name="q" type="search" defaultValue={q}
              placeholder="Buscar por nombre…"
              style={{ fontSize: 13, padding: "8px 12px", minWidth: 200 }}
            />
            <select name="status" defaultValue={status} style={{ fontSize: 13, padding: "8px 10px" }}>
              <option value="">Todos los estados</option>
              <option value="onboarding">En configuración</option>
              <option value="active">Activo</option>
              <option value="suspended">Suspendido</option>
            </select>
            <button type="submit" className="button small" style={{ fontSize: 12 }}>Buscar</button>
            {(q || status) && (
              <Link href="/admin" className="button secondary small" style={{ fontSize: 12 }}>
                Limpiar
              </Link>
            )}
          </form>

          {rows.length === 0 ? (
            <div className="dashboard-card" style={{ textAlign: "center", padding: "40px 20px" }}>
              <p style={{ fontSize: 14, color: "var(--muted)" }}>
                {q || status ? "No hay resultados para estos filtros." : "No hay restaurantes registrados."}
              </p>
            </div>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Restaurante</th>
                    <th>Estado</th>
                    <th>Plan / Suscripción</th>
                    <th>Vencimiento</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const activeSub = getActiveSub(r);
                    const isExpired = activeSub?.ends_at && new Date(activeSub.ends_at) < new Date();
                    return (
                      <tr key={r.id}>
                        <td>
                          <Link href={`/admin/restaurants/${r.id}`} style={{ fontWeight: 600, color: "var(--purple)" }}>
                            {r.name}
                          </Link>
                          <div style={{ fontSize: 11, color: "var(--muted)" }}>{r.slug} · {r.currency}</div>
                        </td>
                        <td>
                          <span className="tag" style={{
                            background: `${STATUS_COLOR[r.status] ?? "#777"}18`,
                            color: STATUS_COLOR[r.status] ?? "#777",
                          }}>
                            {STATUS_LABEL[r.status] ?? r.status}
                          </span>
                        </td>
                        <td>
                          {activeSub
                            ? <span style={{ fontSize: 12 }}>{activeSub.plans?.name ?? "—"}</span>
                            : <span style={{ fontSize: 12, color: "var(--muted)" }}>Sin suscripción</span>}
                        </td>
                        <td>
                          {activeSub?.ends_at ? (
                            <span style={{ fontSize: 12, color: isExpired ? "#c62828" : "inherit" }}>
                              {new Date(activeSub.ends_at).toLocaleDateString("es-VE")}
                            </span>
                          ) : activeSub ? (
                            <span style={{ fontSize: 12, color: "var(--muted)" }}>Indefinida</span>
                          ) : "—"}
                        </td>
                        <td>
                          <Link href={`/admin/restaurants/${r.id}`} className="button secondary small" style={{ fontSize: 11 }}>
                            Ver
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {rows.length === perPage && (
            <div style={{ display: "flex", gap: 12, marginTop: 16, justifyContent: "flex-end" }}>
              {page > 1 && (
                <Link href={`/admin?pagina=${page - 1}${q ? `&q=${q}` : ""}${status ? `&status=${status}` : ""}`}
                  className="button secondary small" style={{ fontSize: 12 }}>
                  ← Anterior
                </Link>
              )}
              <Link href={`/admin?pagina=${page + 1}${q ? `&q=${q}` : ""}${status ? `&status=${status}` : ""}`}
                className="button secondary small" style={{ fontSize: 12 }}>
                Siguiente →
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export const dynamic = "force-dynamic";
