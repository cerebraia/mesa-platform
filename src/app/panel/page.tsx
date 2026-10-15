import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import {
  ClipboardList,
  Clock,
  CreditCard,
  Receipt,
  LayoutGrid,
  Plus,
} from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { getActiveMembership } from "@/lib/panel-context";
import { PageHeader } from "@/components/panel/page-header";
import { EmptyState } from "@/components/panel/empty-state";
import { RestaurantSwitcher } from "./restaurant-switcher";
import { PeriodTabs } from "./period-tabs";
import type { MemberRole } from "@/lib/db-types";

// ── Types ─────────────────────────────────────────────────────────

type Period = "today" | "yesterday" | "7days" | "month";

type RecentOrder = {
  id: string;
  order_number: number;
  status: string;
  payment_status?: string;
  modality: string;
  total_cents?: number;
  created_at: string;
};

type DashboardMetrics = {
  period: string;
  orders_period: number;
  orders_active: number;
  paid_cents: number | null;
  avg_ticket_cents: number | null;
  published_products: number | null;
  recent_orders: RecentOrder[];
};

// ── Constants ─────────────────────────────────────────────────────

const ROLE_LABEL: Record<MemberRole, string> = {
  owner:     "Propietario",
  attention: "Atención",
  kitchen:   "Cocina",
};

const PERIOD_LABEL: Record<Period, string> = {
  today:     "hoy",
  yesterday: "ayer",
  "7days":   "últimos 7 días",
  month:     "este mes",
};

const STATUS_LABEL: Record<string, string> = {
  onboarding: "Configuración",
  active:     "Activo",
  suspended:  "Suspendido",
};

const ORDER_STATUS_LABEL: Record<string, string> = {
  received:   "Recibido",
  accepted:   "Aceptado",
  preparing:  "Preparando",
  ready:      "Listo",
  on_the_way: "En camino",
  completed:  "Completado",
  rejected:   "Rechazado",
  cancelled:  "Cancelado",
};

// ── Helpers ───────────────────────────────────────────────────────

function formatCents(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("es", {
      style: "currency", currency,
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
}

function formatTime(iso: string, timezone: string): string {
  try {
    return new Date(iso).toLocaleString("es", {
      timeZone: timezone, month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return new Date(iso).toLocaleString("es");
  }
}

// ── Status badges ─────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`order-status-badge badge-${status}`}>
      {ORDER_STATUS_LABEL[status] ?? status}
    </span>
  );
}

function PayBadge({ status }: { status: string }) {
  return (
    <span className={`order-status-badge ${status === "confirmed" ? "payment-paid" : "payment-pending"}`}>
      {status === "confirmed" ? "Pagado" : "Pendiente"}
    </span>
  );
}

function ModalityBadge({ modality }: { modality: string }) {
  return (
    <span className={`order-status-badge ${modality === "pickup" ? "modality-pickup" : "modality-delivery"}`}>
      {modality === "pickup" ? "Retiro" : "Delivery"}
    </span>
  );
}

// ── Owner / Attention view ────────────────────────────────────────

function OwnerDashboard({
  metrics, periodo, currency, timezone, slug,
}: {
  metrics: DashboardMetrics;
  periodo: Period;
  currency: string;
  timezone: string;
  slug: string;
}) {
  const paid   = metrics.paid_cents ?? 0;
  const avg    = metrics.avg_ticket_cents ?? 0;
  const prods  = metrics.published_products ?? 0;
  const recent = metrics.recent_orders ?? [];

  return (
    <>
      <div className="metric-grid-4">
        <div className="metric-v2">
          <div className="metric-v2-header">
            <span className="metric-v2-label">Pedidos recibidos</span>
            <div className="metric-v2-icon"><ClipboardList size={18} /></div>
          </div>
          <div className="metric-v2-value">{metrics.orders_period}</div>
          <div className="metric-v2-sub">
            {PERIOD_LABEL[periodo].charAt(0).toUpperCase() + PERIOD_LABEL[periodo].slice(1)}
          </div>
        </div>

        <div className="metric-v2">
          <div className="metric-v2-header">
            <span className="metric-v2-label">Pedidos activos</span>
            <div className="metric-v2-icon metric-v2-icon--amber"><Clock size={18} /></div>
          </div>
          <div className="metric-v2-value">{metrics.orders_active}</div>
          <div className="metric-v2-sub">En este momento</div>
        </div>

        <div className="metric-v2">
          <div className="metric-v2-header">
            <span className="metric-v2-label">Confirmado cobrado</span>
            <div className="metric-v2-icon metric-v2-icon--green"><CreditCard size={18} /></div>
          </div>
          <div className="metric-v2-value" style={{ fontSize: paid > 0 ? 20 : 26 }}>
            {paid > 0 ? formatCents(paid, currency) : "—"}
          </div>
          <div className="metric-v2-sub">
            {paid > 0 ? `Pago confirmado · ${PERIOD_LABEL[periodo]}` : `Sin pagos confirmados · ${PERIOD_LABEL[periodo]}`}
          </div>
        </div>

        <div className="metric-v2">
          <div className="metric-v2-header">
            <span className="metric-v2-label">Ticket promedio</span>
            <div className="metric-v2-icon"><Receipt size={18} /></div>
          </div>
          <div className="metric-v2-value" style={{ fontSize: avg > 0 ? 20 : 26 }}>
            {avg > 0 ? formatCents(avg, currency) : "—"}
          </div>
          <div className="metric-v2-sub">
            {avg > 0 ? "Excluye cancelados y rechazados" : "Sin pedidos procesados"}
          </div>
        </div>
      </div>

      {/* Products + quick actions */}
      <div className="dashboard-card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="metric-v2-icon" style={{ flexShrink: 0 }}><LayoutGrid size={18} /></div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#202337" }}>
                {prods === 0
                  ? "Sin productos publicados"
                  : `${prods} ${prods === 1 ? "producto publicado" : "productos publicados"}`}
              </div>
              <div style={{ fontSize: 11, color: "#667085" }}>Catálogo en tiempo real</div>
            </div>
          </div>
          <div className="panel-quick-actions" style={{ margin: 0 }}>
            <Link href="/panel/menu/products/new" className="panel-quick-action panel-quick-action--primary">
              <Plus size={13} /> Añadir producto
            </Link>
            <Link href="/panel/pedidos" className="panel-quick-action">
              Ver pedidos
            </Link>
            <Link href={`/r/${slug}`} target="_blank" rel="noopener noreferrer" className="panel-quick-action">
              Abrir menú
            </Link>
          </div>
        </div>
      </div>

      {/* Recent orders */}
      <div className="dashboard-card">
        <div className="card-heading" style={{ marginBottom: recent.length > 0 ? 16 : 0 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: "#202337", letterSpacing: "-.2px" }}>
            Pedidos recientes
          </h2>
          <Link href="/panel/pedidos" className="text-link" style={{ fontSize: 12 }}>
            Ver todos →
          </Link>
        </div>

        {recent.length === 0 ? (
          <div style={{ padding: "32px 0", textAlign: "center" }}>
            <p style={{ fontSize: 14, color: "#667085", marginBottom: 8 }}>
              No se registraron pedidos {PERIOD_LABEL[periodo]}.
            </p>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Núm.</th>
                  <th>Estado</th>
                  <th>Modalidad</th>
                  <th>Pago</th>
                  <th style={{ textAlign: "right" }}>Total</th>
                  <th style={{ textAlign: "right" }}>Fecha</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {recent.map((o) => (
                  <tr key={o.id}>
                    <td style={{ fontWeight: 600, color: "#202337" }}>#{o.order_number}</td>
                    <td><StatusBadge status={o.status} /></td>
                    <td><ModalityBadge modality={o.modality} /></td>
                    <td>
                      {o.payment_status
                        ? <PayBadge status={o.payment_status} />
                        : <span style={{ color: "#667085" }}>—</span>}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 600 }}>
                      {o.total_cents != null ? formatCents(o.total_cents, currency) : "—"}
                    </td>
                    <td style={{ textAlign: "right", color: "#667085", fontSize: 11 }}>
                      {formatTime(o.created_at, timezone)}
                    </td>
                    <td>
                      <Link href={`/panel/pedidos/${o.id}`} style={{ fontSize: 11, color: "#703BE6", fontWeight: 500 }}>
                        Ver
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

// ── Kitchen view ──────────────────────────────────────────────────

function KitchenDashboard({ metrics, timezone }: { metrics: DashboardMetrics; timezone: string }) {
  const queue = metrics.recent_orders ?? [];

  return (
    <>
      <div className="metric-grid-4" style={{ gridTemplateColumns: "repeat(2,minmax(0,1fr))" }}>
        <div className="metric-v2">
          <div className="metric-v2-header">
            <span className="metric-v2-label">Pedidos activos</span>
            <div className="metric-v2-icon metric-v2-icon--amber"><Clock size={18} /></div>
          </div>
          <div className="metric-v2-value">{metrics.orders_active}</div>
          <div className="metric-v2-sub">En preparación o pendientes</div>
        </div>
        <div className="metric-v2">
          <div className="metric-v2-header">
            <span className="metric-v2-label">En cola ahora</span>
            <div className="metric-v2-icon"><ClipboardList size={18} /></div>
          </div>
          <div className="metric-v2-value">{queue.length}</div>
          <div className="metric-v2-sub">Aceptados, preparando, listos</div>
        </div>
      </div>

      <div className="dashboard-card">
        <div className="card-heading" style={{ marginBottom: queue.length > 0 ? 16 : 0 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: "#202337" }}>Cola de preparación</h2>
          <Link href="/panel/pedidos" className="text-link" style={{ fontSize: 12 }}>Ver todos →</Link>
        </div>
        {queue.length === 0 ? (
          <div style={{ padding: "32px 0", textAlign: "center" }}>
            <p style={{ fontSize: 14, color: "#667085" }}>No hay pedidos activos en este momento.</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Núm.</th>
                  <th>Estado</th>
                  <th>Modalidad</th>
                  <th style={{ textAlign: "right" }}>Recibido</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {queue.map((o) => (
                  <tr key={o.id}>
                    <td style={{ fontWeight: 600 }}>#{o.order_number}</td>
                    <td><span className={`order-status-badge badge-${o.status}`}>{ORDER_STATUS_LABEL[o.status] ?? o.status}</span></td>
                    <td><span className={`order-status-badge ${o.modality === "pickup" ? "modality-pickup" : "modality-delivery"}`}>{o.modality === "pickup" ? "Retiro" : "Delivery"}</span></td>
                    <td style={{ textAlign: "right", color: "#667085", fontSize: 11 }}>{formatTime(o.created_at, timezone)}</td>
                    <td><Link href={`/panel/pedidos/${o.id}`} style={{ fontSize: 11, color: "#703BE6", fontWeight: 500 }}>Ver</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────

export default async function PanelPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp      = await searchParams;
  const periodo = (["today","yesterday","7days","month"].includes(sp.periodo ?? "")
    ? sp.periodo : "today") as Period;

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { active, options } = await getActiveMembership();
  if (!active) redirect("/panel");

  const { role, restaurant } = active;

  const { data: rest } = await supabase
    .from("restaurants")
    .select("status, timezone, currency")
    .eq("id", active.restaurantId)
    .single();

  const timezone = rest?.timezone ?? "America/Caracas";
  const currency = rest?.currency ?? "USD";
  const status   = rest?.status;

  let metrics:      DashboardMetrics | null = null;
  let metricsError: string | null           = null;

  const { data: raw, error: rpcErr } = await supabase.rpc("get_dashboard_metrics", {
    p_restaurant_id: active.restaurantId,
    p_period:        periodo,
    p_timezone:      timezone,
  });

  if (rpcErr)      metricsError = rpcErr.message;
  else if (raw)    metrics = raw as DashboardMetrics;

  const isKitchen = role === "kitchen";
  const pageTitle = isKitchen ? "Cocina" : role === "attention" ? "Atención" : restaurant.name;
  const pageDesc  = isKitchen
    ? "Pedidos aceptados y en preparación."
    : `${restaurant.name} · ${ROLE_LABEL[role]}`;

  return (
    <>
      <PageHeader
        title={pageTitle}
        description={pageDesc}
        actions={
          !isKitchen ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {status && (
                <span className="tag" style={{ fontSize: 11 }}>
                  {STATUS_LABEL[status] ?? status}
                </span>
              )}
              <Suspense fallback={<div className="period-tabs" />}>
                <PeriodTabs current={periodo} />
              </Suspense>
            </div>
          ) : undefined
        }
      />

      <div className="panel-content">
        {active.hasMultiple && (
          <div style={{ marginBottom: 16 }}>
            <RestaurantSwitcher options={options} activeRestaurantId={active.restaurantId} />
          </div>
        )}

        {metricsError && (
          <div className="auth-error" role="alert" style={{ marginBottom: 16 }}>
            No se pudieron cargar las métricas: {metricsError}.{" "}
            <a href="/panel" style={{ color: "inherit", textDecoration: "underline" }}>Reintentar</a>
          </div>
        )}

        {metrics && !metricsError && (
          isKitchen ? (
            <KitchenDashboard metrics={metrics} timezone={timezone} />
          ) : (
            <OwnerDashboard
              metrics={metrics}
              periodo={periodo}
              currency={currency}
              timezone={timezone}
              slug={restaurant.slug}
            />
          )
        )}

        {!metrics && !metricsError && (
          <EmptyState
            icon={ClipboardList}
            title="Cargando datos…"
            description="Las métricas del restaurante aparecerán aquí en un momento."
          />
        )}
      </div>
    </>
  );
}

export const dynamic = "force-dynamic";
