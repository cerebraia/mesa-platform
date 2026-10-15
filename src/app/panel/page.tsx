import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createServerClient } from "@/lib/supabase/server";
import { getActiveMembership } from "@/lib/panel-context";
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
  period_start: string;
  period_end: string;
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

const STATUS_LABEL: Record<string, string> = {
  onboarding: "En configuración",
  active:     "Activo",
  suspended:  "Suspendido",
};

const ORDER_STATUS_LABEL: Record<string, string> = {
  received:   "Recibido",
  accepted:   "Aceptado",
  preparing:  "En preparación",
  ready:      "Listo",
  on_the_way: "En camino",
  completed:  "Completado",
  rejected:   "Rechazado",
  cancelled:  "Cancelado",
};

const PAYMENT_LABEL: Record<string, string> = {
  confirmed: "Pagado",
  pending:   "Pendiente",
};

const PERIOD_LABEL: Record<Period, string> = {
  today:     "Hoy",
  yesterday: "Ayer",
  "7days":   "Últimos 7 días",
  month:     "Este mes",
};

const MODALITY_LABEL: Record<string, string> = {
  pickup:   "Retiro",
  delivery: "Delivery",
};

// ── Helpers ───────────────────────────────────────────────────────

function formatCents(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("es", {
      style:                 "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
}

function formatDateTime(iso: string, timezone: string): string {
  try {
    const d = new Date(iso);
    const date = d.toLocaleDateString("es", { timeZone: timezone, day: "numeric", month: "short" });
    const time = d.toLocaleTimeString("es", { timeZone: timezone, hour: "2-digit", minute: "2-digit" });
    return `${date} ${time}`;
  } catch {
    return new Date(iso).toLocaleString("es");
  }
}

// ── SVG icons ─────────────────────────────────────────────────────

function IconReceived() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
      <rect x="9" y="3" width="6" height="4" rx="1"/>
      <line x1="9" y1="12" x2="15" y2="12"/>
      <line x1="9" y1="16" x2="15" y2="16"/>
    </svg>
  );
}

function IconActive() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}

function IconPaid() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="5" width="20" height="14" rx="2"/>
      <line x1="2" y1="10" x2="22" y2="10"/>
    </svg>
  );
}

function IconTicket() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 9a3 3 0 010-6h20a3 3 0 010 6"/>
      <path d="M2 15a3 3 0 000 6h20a3 3 0 000-6"/>
      <line x1="6" y1="12" x2="6" y2="12"/>
      <line x1="12" y1="12" x2="12" y2="12"/>
      <line x1="18" y1="12" x2="18" y2="12"/>
    </svg>
  );
}

function IconProducts() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7"/>
      <rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/>
    </svg>
  );
}

function IconPlus() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19"/>
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  );
}

// ── Status badge ──────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cls = `order-status-badge badge-${status}`;
  return <span className={cls}>{ORDER_STATUS_LABEL[status] ?? status}</span>;
}

function PaymentBadge({ status }: { status: string }) {
  const cls = `order-status-badge ${status === "confirmed" ? "payment-paid" : "payment-pending"}`;
  return <span className={cls}>{PAYMENT_LABEL[status] ?? status}</span>;
}

function ModalityBadge({ modality }: { modality: string }) {
  const cls = `order-status-badge ${modality === "pickup" ? "modality-pickup" : "modality-delivery"}`;
  return <span className={cls}>{MODALITY_LABEL[modality] ?? modality}</span>;
}

// ── Empty state ───────────────────────────────────────────────────

function EmptyOrders({ periodo }: { periodo: Period }) {
  return (
    <div style={{ padding: "32px 0", textAlign: "center" }}>
      <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 16 }}>
        No se registraron pedidos durante {PERIOD_LABEL[periodo].toLowerCase()}.
      </p>
      <p style={{ fontSize: 12, color: "var(--muted)" }}>
        Cuando lleguen nuevos pedidos aparecerán aquí.
      </p>
    </div>
  );
}

// ── Owner / Attention view ────────────────────────────────────────

function OwnerDashboard({
  metrics,
  periodo,
  currency,
  timezone,
  slug,
}: {
  metrics: DashboardMetrics;
  periodo: Period;
  currency: string;
  timezone: string;
  slug: string;
}) {
  const ordersInPeriod   = metrics.orders_period;
  const ordersActive     = metrics.orders_active;
  const paidCents        = metrics.paid_cents ?? 0;
  const avgCents         = metrics.avg_ticket_cents ?? 0;
  const publishedCount   = metrics.published_products ?? 0;
  const recentOrders     = metrics.recent_orders ?? [];

  return (
    <>
      {/* Metric cards */}
      <div className="metric-grid-4">
        <div className="metric-v2">
          <div className="metric-v2-header">
            <span className="metric-v2-label">Pedidos recibidos</span>
            <div className="metric-v2-icon"><IconReceived /></div>
          </div>
          <div className="metric-v2-value">{ordersInPeriod}</div>
          <div className="metric-v2-sub">{PERIOD_LABEL[periodo]}</div>
        </div>

        <div className="metric-v2">
          <div className="metric-v2-header">
            <span className="metric-v2-label">Pedidos activos</span>
            <div className="metric-v2-icon metric-v2-icon--amber"><IconActive /></div>
          </div>
          <div className="metric-v2-value">{ordersActive}</div>
          <div className="metric-v2-sub">En este momento</div>
        </div>

        <div className="metric-v2">
          <div className="metric-v2-header">
            <span className="metric-v2-label">Confirmado cobrado</span>
            <div className="metric-v2-icon metric-v2-icon--green"><IconPaid /></div>
          </div>
          <div className="metric-v2-value" style={{ fontSize: paidCents > 0 ? 22 : 27 }}>
            {paidCents > 0 ? formatCents(paidCents, currency) : "—"}
          </div>
          <div className="metric-v2-sub">
            {paidCents > 0
              ? `Pago confirmado · ${PERIOD_LABEL[periodo].toLowerCase()}`
              : `Sin pagos confirmados · ${PERIOD_LABEL[periodo].toLowerCase()}`}
          </div>
        </div>

        <div className="metric-v2">
          <div className="metric-v2-header">
            <span className="metric-v2-label">Ticket promedio</span>
            <div className="metric-v2-icon"><IconTicket /></div>
          </div>
          <div className="metric-v2-value" style={{ fontSize: avgCents > 0 ? 22 : 27 }}>
            {avgCents > 0 ? formatCents(avgCents, currency) : "—"}
          </div>
          <div className="metric-v2-sub">
            {avgCents > 0
              ? "Excluye cancelados y rechazados"
              : "Sin pedidos procesados"}
          </div>
        </div>
      </div>

      {/* Products + quick actions */}
      <div className="dashboard-card" style={{ marginBottom: 20 }}>
        <div className="card-heading" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="metric-v2-icon"><IconProducts /></div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>
                {publishedCount === 0 ? "Sin productos publicados" : `${publishedCount} ${publishedCount === 1 ? "producto publicado" : "productos publicados"}`}
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>Catálogo en tiempo real</div>
            </div>
          </div>
        </div>
        <div className="panel-quick-actions">
          <Link href="/panel/menu/products/new" className="panel-quick-action panel-quick-action--primary">
            <IconPlus /> Añadir producto
          </Link>
          <Link href="/panel/pedidos" className="panel-quick-action">
            Ver pedidos
          </Link>
          <Link
            href={`/r/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="panel-quick-action"
          >
            Abrir menú ↗
          </Link>
          {publishedCount === 0 && (
            <Link href="/panel/menu" className="panel-quick-action">
              Ir al catálogo
            </Link>
          )}
        </div>
      </div>

      {/* Recent orders */}
      <div className="dashboard-card">
        <div className="card-heading" style={{ marginBottom: recentOrders.length > 0 ? 16 : 0 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600 }}>Pedidos recientes</h2>
          <Link href="/panel/pedidos" className="text-link" style={{ fontSize: 12 }}>
            Ver todos →
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <EmptyOrders periodo={periodo} />
        ) : (
          <div className="table-scroll">
            <table style={{ fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ width: 60 }}>Núm.</th>
                  <th>Estado</th>
                  <th>Modalidad</th>
                  <th>Pago</th>
                  <th style={{ textAlign: "right" }}>Total</th>
                  <th style={{ textAlign: "right" }}>Fecha</th>
                  <th style={{ width: 40 }} />
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((o) => (
                  <tr key={o.id}>
                    <td style={{ fontWeight: 600 }}>#{o.order_number}</td>
                    <td><StatusBadge status={o.status} /></td>
                    <td><ModalityBadge modality={o.modality} /></td>
                    <td>
                      {o.payment_status
                        ? <PaymentBadge status={o.payment_status} />
                        : <span style={{ color: "var(--muted)" }}>—</span>}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {o.total_cents != null ? formatCents(o.total_cents, currency) : "—"}
                    </td>
                    <td style={{ textAlign: "right", color: "var(--muted)", fontSize: 11 }}>
                      {formatDateTime(o.created_at, timezone)}
                    </td>
                    <td>
                      <Link
                        href={`/panel/pedidos/${o.id}`}
                        style={{ fontSize: 11, color: "var(--purple)", textDecoration: "none", fontWeight: 500 }}
                      >
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

function KitchenDashboard({
  metrics,
  timezone,
}: {
  metrics: DashboardMetrics;
  timezone: string;
}) {
  const ordersActive = metrics.orders_active;
  const queue        = metrics.recent_orders ?? [];

  return (
    <>
      <div className="metric-grid-4" style={{ gridTemplateColumns: "repeat(2,minmax(0,1fr))" }}>
        <div className="metric-v2">
          <div className="metric-v2-header">
            <span className="metric-v2-label">Pedidos activos</span>
            <div className="metric-v2-icon metric-v2-icon--amber"><IconActive /></div>
          </div>
          <div className="metric-v2-value">{ordersActive}</div>
          <div className="metric-v2-sub">En preparación o pendientes</div>
        </div>
        <div className="metric-v2">
          <div className="metric-v2-header">
            <span className="metric-v2-label">En cola ahora</span>
            <div className="metric-v2-icon"><IconReceived /></div>
          </div>
          <div className="metric-v2-value">{queue.length}</div>
          <div className="metric-v2-sub">Aceptados, preparando, listos</div>
        </div>
      </div>

      <div className="dashboard-card">
        <div className="card-heading" style={{ marginBottom: queue.length > 0 ? 16 : 0 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600 }}>Cola de preparación</h2>
          <Link href="/panel/pedidos" className="text-link" style={{ fontSize: 12 }}>
            Ver todos →
          </Link>
        </div>

        {queue.length === 0 ? (
          <div style={{ padding: "32px 0", textAlign: "center" }}>
            <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 8 }}>
              No hay pedidos activos en este momento.
            </p>
            <p style={{ fontSize: 12, color: "var(--muted)" }}>
              Los pedidos aceptados aparecerán aquí cuando lleguen.
            </p>
          </div>
        ) : (
          <div className="table-scroll">
            <table style={{ fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ width: 60 }}>Núm.</th>
                  <th>Estado</th>
                  <th>Modalidad</th>
                  <th style={{ textAlign: "right" }}>Recibido</th>
                  <th style={{ width: 40 }} />
                </tr>
              </thead>
              <tbody>
                {queue.map((o) => (
                  <tr key={o.id}>
                    <td style={{ fontWeight: 600 }}>#{o.order_number}</td>
                    <td><StatusBadge status={o.status} /></td>
                    <td><ModalityBadge modality={o.modality} /></td>
                    <td style={{ textAlign: "right", color: "var(--muted)", fontSize: 11 }}>
                      {formatDateTime(o.created_at, timezone)}
                    </td>
                    <td>
                      <Link
                        href={`/panel/pedidos/${o.id}`}
                        style={{ fontSize: 11, color: "var(--purple)", textDecoration: "none", fontWeight: 500 }}
                      >
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

// ── Page ──────────────────────────────────────────────────────────

export default async function PanelPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp     = await searchParams;
  const periodo = (["today", "yesterday", "7days", "month"].includes(sp.periodo ?? "")
    ? sp.periodo
    : "today") as Period;

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { active, options } = await getActiveMembership();
  if (!active) redirect("/panel");

  const { role, restaurant } = active;
  const restaurantId         = active.restaurantId;

  const { data: rest } = await supabase
    .from("restaurants")
    .select("status, timezone, currency")
    .eq("id", restaurantId)
    .single();

  const timezone = rest?.timezone ?? "America/Caracas";
  const currency = rest?.currency ?? "USD";
  const status   = rest?.status;

  // ── Fetch dashboard metrics from RPC ─────────────────────────
  let metrics:      DashboardMetrics | null = null;
  let metricsError: string | null           = null;

  const { data: metricsRaw, error: rpcError } = await supabase.rpc(
    "get_dashboard_metrics",
    {
      p_restaurant_id: restaurantId,
      p_period:        periodo,
      p_timezone:      timezone,
    },
  );

  if (rpcError) {
    metricsError = rpcError.message;
  } else if (metricsRaw) {
    metrics = metricsRaw as DashboardMetrics;
  }

  const isKitchen  = role === "kitchen";
  const topLabel   = isKitchen ? "COCINA" : role === "attention" ? "ATENCIÓN" : "PANEL";
  const pageTitle  = isKitchen ? "Cola de preparación" :
                     role === "attention" ? "Atención" :
                     restaurant.name;
  const pageSubtitle = isKitchen
    ? "Pedidos aceptados y en preparación."
    : `${restaurant.name} · ${ROLE_LABEL[role]}`;

  return (
    <>
      <div className="dashboard-top">
        <span>{topLabel}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontWeight: 500, letterSpacing: 0 }}>{restaurant.name}</span>
          {status && (
            <span className="tag">{STATUS_LABEL[status] ?? status}</span>
          )}
        </div>
      </div>

      <div className="dashboard-content">
        {/* Restaurant switcher when user has multiple memberships */}
        {active.hasMultiple && (
          <RestaurantSwitcher
            options={options}
            activeRestaurantId={restaurantId}
          />
        )}

        {/* Page heading + period filter */}
        <div className="dashboard-heading">
          <div>
            <h1>{pageTitle}</h1>
            <p>{pageSubtitle}</p>
          </div>
          {!isKitchen && (
            <Suspense fallback={<div className="period-tabs" aria-hidden="true" />}>
              <PeriodTabs current={periodo} />
            </Suspense>
          )}
        </div>

        {/* Error state */}
        {metricsError && (
          <div className="auth-error" role="alert" style={{ marginBottom: 20 }}>
            No se pudieron cargar las métricas: {metricsError}.{" "}
            <a href="/panel" style={{ color: "inherit", textDecoration: "underline" }}>
              Reintentar
            </a>
          </div>
        )}

        {/* Metrics — only rendered when RPC succeeded */}
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

        {/* No-data placeholder — should not normally occur since RPC always returns */}
        {!metrics && !metricsError && (
          <div className="dashboard-card" style={{ padding: "48px 24px", textAlign: "center" }}>
            <p style={{ color: "var(--muted)", fontSize: 14 }}>Cargando datos…</p>
          </div>
        )}
      </div>
    </>
  );
}

export const dynamic = "force-dynamic";
