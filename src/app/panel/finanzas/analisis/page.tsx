import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getActiveMembership } from "@/lib/panel-context";
import { PageHeader } from "@/components/panel/page-header";

export const dynamic = "force-dynamic";

// ── Types ─────────────────────────────────────────────────────────

type ProductWithControl = {
  id: string;
  name: string;
  base_price_cents: number;
  cost_cents: number | null;
  stock_quantity: number | null;
  stock_alert: number | null;
};

// ── Helpers ───────────────────────────────────────────────────────

function formatCents(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("es", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
}

function calcMargin(price: number, cost: number): number {
  if (price <= 0) return 0;
  return ((price - cost) / price) * 100;
}

// ── Page ──────────────────────────────────────────────────────────

export default async function AnalisisPage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { active } = await getActiveMembership();
  if (!active) redirect("/panel");

  const restaurantId = active.restaurantId;

  // Fetch products with cost data
  const { data: products, error } = await supabase
    .from("products")
    .select("id, name, base_price_cents, cost_cents, stock_quantity, stock_alert")
    .eq("restaurant_id", restaurantId)
    .not("cost_cents", "is", null)
    .order("name")
    .returns<ProductWithControl[]>();

  // Fetch restaurant currency
  const { data: rest } = await supabase
    .from("restaurants")
    .select("currency")
    .eq("id", restaurantId)
    .single();
  const currency = rest?.currency ?? "USD";

  const prods = products ?? [];

  // Inventory valuation: sum(stock_quantity * cost_cents) for products with both
  const inventoryValue = prods.reduce((acc, p) => {
    if (p.stock_quantity != null && p.cost_cents != null) {
      return acc + p.stock_quantity * p.cost_cents;
    }
    return acc;
  }, 0);

  return (
    <>
      <PageHeader
        title="Análisis de márgenes"
        description="Costo, precio y margen por producto. Solo productos con costo registrado."
        actions={
          <Link href="/panel/finanzas" className="panel-breadcrumb-link">
            ← Finanzas
          </Link>
        }
      />

      <div className="panel-content">
        {error && (
          <div className="auth-error" role="alert" style={{ marginBottom: 16 }}>
            Error al cargar productos: {error.message}
          </div>
        )}

        {/* Inventory valuation card */}
        {inventoryValue > 0 && (
          <div className="dashboard-card" style={{ marginBottom: 16 }}>
            <div className="panel-card-header">
              <div>
                <h2 className="panel-card-title">Valoración de inventario</h2>
                <p className="panel-card-subtitle">
                  Suma de stock × costo para productos con ambos valores.
                </p>
              </div>
              <span style={{ fontSize: 24, fontWeight: 700, color: "#059669" }}>
                {formatCents(inventoryValue, currency)}
              </span>
            </div>
          </div>
        )}

        {/* Margin table */}
        <div className="dashboard-card">
          <div className="panel-card-header">
            <div>
              <h2 className="panel-card-title">Márgenes por producto</h2>
              <p className="panel-card-subtitle">
                Precio base, costo y margen estimado.
              </p>
            </div>
          </div>

          {prods.length === 0 ? (
            <div className="panel-empty">
              <div className="panel-empty-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 3h2l.4 2M7 13h10l4-8H5.4"/>
                  <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                </svg>
              </div>
              <h3 className="panel-empty-title">Sin datos de costo</h3>
              <p className="panel-empty-desc">
                Añade el costo a tus productos desde el formulario de edición de cada producto.
              </p>
              <Link href="/panel/menu" className="button" style={{ textDecoration: "none" }}>
                Ir al catálogo
              </Link>
            </div>
          ) : (
            <div className="table-scroll">
              <table className="fin-analisis-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th style={{ textAlign: "right" }}>Precio base</th>
                    <th style={{ textAlign: "right" }}>Costo</th>
                    <th style={{ textAlign: "right" }}>Margen</th>
                    <th style={{ textAlign: "right" }}>Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {prods.map((p) => {
                    const margin = p.cost_cents != null
                      ? calcMargin(p.base_price_cents, p.cost_cents)
                      : null;
                    const isLowStock =
                      p.stock_quantity != null &&
                      p.stock_alert != null &&
                      p.stock_quantity <= p.stock_alert;

                    return (
                      <tr key={p.id}>
                        <td>
                          <Link
                            href={`/panel/menu/products/${p.id}/edit`}
                            style={{ color: "#703BE6", fontWeight: 500 }}
                          >
                            {p.name}
                          </Link>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {formatCents(p.base_price_cents, currency)}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {p.cost_cents != null
                            ? formatCents(p.cost_cents, currency)
                            : <span style={{ color: "#9CA3AF" }}>—</span>}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {margin != null ? (
                            <span style={{
                              color:      margin >= 40 ? "#059669" : margin >= 20 ? "#D97706" : "#DC2626",
                              fontWeight: 600,
                            }}>
                              {margin.toFixed(1)}%
                            </span>
                          ) : (
                            <span style={{ color: "#9CA3AF" }}>—</span>
                          )}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {p.stock_quantity != null ? (
                            <span>
                              {p.stock_quantity}
                              {isLowStock && (
                                <span
                                  className="order-status-badge badge-received"
                                  style={{ marginLeft: 6, fontSize: 10 }}
                                >
                                  Bajo
                                </span>
                              )}
                            </span>
                          ) : (
                            <span style={{ color: "#9CA3AF" }}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
