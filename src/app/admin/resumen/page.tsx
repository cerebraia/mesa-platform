// Auth and platform_admin authorization are handled exclusively in
// src/app/admin/layout.tsx — this page trusts that the layout already ran.
// Duplicating the check here caused a redirect loop:
//   /admin/resumen → /panel (maybeSingle fails) → /admin (panel layout detects platform_admin)
import { createServerClient } from "@/lib/supabase/server";
import {
  Store, Package, CreditCard,
  Users, Clock, Trash2,
} from "lucide-react";

type Metrics = {
  restaurants: { active: number; onboarding: number; suspended: number; deleted: number; total: number };
  products: { published: number; draft: number; paused: number; deleted: number };
  subscriptions: { active: number; expired: number; cancelled: number };
  payments_by_currency: Array<{ currency: string; count: number; total_cents: number }> | null;
  orders_by_currency: Array<{ currency: string; count: number; total_cents: number }> | null;
};

function MetricCard({
  label, value, icon, color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color?: string;
}) {
  return (
    <div className="admin-metric-card">
      <div
        className="admin-metric-icon"
        style={color ? { background: color + "1a", color } : undefined}
      >
        {icon}
      </div>
      <div className="admin-metric-body">
        <span className="admin-metric-value">{value.toLocaleString("es")}</span>
        <span className="admin-metric-label">{label}</span>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="admin-section-title" style={{ marginTop: 32, marginBottom: 16 }}>
      {children}
    </h2>
  );
}

function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("es", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

export default async function AdminResumenPage() {
  const supabase = await createServerClient();
  const { data: rawMetrics, error } = await supabase.rpc("get_admin_platform_metrics");
  const metrics = rawMetrics as Metrics | null;

  return (
    <>
      <div className="panel-page-header">
        <div>
          <h1 className="panel-page-title">Resumen de plataforma</h1>
          <p className="panel-page-desc">
            Métricas reales de todos los negocios en Wacatalog.
            Las cifras monetarias se muestran separadas por moneda.
          </p>
        </div>
      </div>

      <div className="panel-content">
        {error && (
          <div className="auth-error" role="alert" style={{ marginBottom: 20 }}>
            Error al cargar métricas: {error.message}. Verifica que la migración 039 esté aplicada.
          </div>
        )}

        {!metrics && !error && (
          <p className="panel-empty-desc">Cargando…</p>
        )}

        {metrics && (
          <>
            <SectionTitle>Negocios</SectionTitle>
            <div className="admin-metric-grid">
              <MetricCard label="Activos"          value={metrics.restaurants.active}     icon={<Store size={20} />}  color="#22c55e" />
              <MetricCard label="En configuración" value={metrics.restaurants.onboarding} icon={<Clock size={20} />}  color="#f59e0b" />
              <MetricCard label="Suspendidos"       value={metrics.restaurants.suspended}  icon={<Users size={20} />}  color="#ef4444" />
              <MetricCard label="Eliminados"        value={metrics.restaurants.deleted}    icon={<Trash2 size={20} />} color="#94a3b8" />
            </div>

            <SectionTitle>Productos (en negocios activos)</SectionTitle>
            <div className="admin-metric-grid">
              <MetricCard label="Visibles"   value={metrics.products.published} icon={<Package size={20} />} color="#7C3AED" />
              <MetricCard label="Borradores" value={metrics.products.draft}     icon={<Package size={20} />} color="#94a3b8" />
              <MetricCard label="Pausados"   value={metrics.products.paused}    icon={<Package size={20} />} color="#f59e0b" />
              <MetricCard label="Eliminados" value={metrics.products.deleted}   icon={<Trash2 size={20} />}  color="#ef4444" />
            </div>

            <SectionTitle>Suscripciones — ingresos Wacatalog</SectionTitle>
            <div className="admin-metric-grid">
              <MetricCard label="Activas"    value={metrics.subscriptions.active}    icon={<CreditCard size={20} />} color="#22c55e" />
              <MetricCard label="Vencidas"   value={metrics.subscriptions.expired}   icon={<CreditCard size={20} />} color="#f59e0b" />
              <MetricCard label="Canceladas" value={metrics.subscriptions.cancelled} icon={<CreditCard size={20} />} color="#94a3b8" />
            </div>

            {metrics.payments_by_currency && metrics.payments_by_currency.length > 0 ? (
              <div className="dashboard-card" style={{ marginTop: 16 }}>
                <p className="admin-section-title" style={{ marginBottom: 12 }}>
                  Pagos de suscripción registrados
                </p>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Moneda</th>
                        <th style={{ textAlign: "right" }}>Pagos</th>
                        <th style={{ textAlign: "right" }}>Total recibido</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.payments_by_currency.map((row) => (
                        <tr key={row.currency}>
                          <td><strong>{row.currency}</strong></td>
                          <td style={{ textAlign: "right" }}>{row.count}</td>
                          <td style={{ textAlign: "right", fontWeight: 600, color: "#22c55e" }}>
                            {formatMoney(row.total_cents, row.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="caption" style={{ marginTop: 10 }}>
                  Solo pagos registrados manualmente por el administrador. No representa ingresos netos.
                </p>
              </div>
            ) : (
              metrics.payments_by_currency !== null && (
                <p className="caption" style={{ marginTop: 8 }}>
                  Sin pagos de suscripción registrados.
                </p>
              )
            )}

            <SectionTitle>Actividad de negocios — pedidos</SectionTitle>
            <p className="caption" style={{ marginBottom: 12 }}>
              Pedidos de todos los negocios activos. No confundir con ingresos de Wacatalog.
              Las monedas se muestran por separado; no se suman entre sí.
            </p>
            {metrics.orders_by_currency && metrics.orders_by_currency.length > 0 ? (
              <div className="dashboard-card" style={{ marginTop: 0 }}>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Moneda</th>
                        <th style={{ textAlign: "right" }}>Pedidos</th>
                        <th style={{ textAlign: "right" }}>Importe total (todos los estados)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.orders_by_currency.map((row) => (
                        <tr key={row.currency}>
                          <td><strong>{row.currency}</strong></td>
                          <td style={{ textAlign: "right" }}>{row.count}</td>
                          <td style={{ textAlign: "right" }}>
                            {formatMoney(row.total_cents, row.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="panel-empty" style={{ padding: "24px 0" }}>
                <p className="panel-empty-title">Sin pedidos registrados</p>
                <p className="panel-empty-desc">
                  Los pedidos aparecerán aquí cuando los negocios activos empiecen a recibirlos.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

export const dynamic = "force-dynamic";
