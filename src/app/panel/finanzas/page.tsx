import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getActiveMembership } from "@/lib/panel-context";
import { PageHeader } from "@/components/panel/page-header";
import { FinanciasSummaryClient } from "./summary-client";
import type { FinancialMovement, FinancialSummary } from "@/lib/catalog-types";

export const dynamic = "force-dynamic";

// ── Helpers ───────────────────────────────────────────────────────

type Period = "today" | "yesterday" | "7days" | "month";

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

function formatDate(iso: string): string {
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("es", {
      day: "2-digit",
      month: "short",
    });
  } catch {
    return iso;
  }
}

const TYPE_LABEL: Record<string, string> = {
  income:   "Ingreso",
  expense:  "Gasto",
  purchase: "Compra",
};

// ── Page ──────────────────────────────────────────────────────────

export default async function FinanzasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp      = await searchParams;
  const periodo = (["today", "yesterday", "7days", "month"].includes(sp.periodo ?? "")
    ? sp.periodo
    : "month") as Period;

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { active } = await getActiveMembership();
  if (!active) redirect("/panel");

  const restaurantId = active.restaurantId;

  // ── Fetch summary via RPC ─────────────────────────────────────
  let summary: FinancialSummary | null = null;
  let moduleUnavailable = false; // true when DB objects don't exist yet

  try {
    const { data, error } = await supabase.rpc("get_financial_summary", {
      p_restaurant_id: restaurantId,
      p_period:        periodo,
    });
    if (error) {
      // Distinguish "module not ready" from other errors
      if (error.message.includes("schema cache") || error.message.includes("not found") || error.code === "PGRST202") {
        moduleUnavailable = true;
      } else {
        console.error("[finanzas] get_financial_summary error:", error.message);
        moduleUnavailable = true; // treat any RPC error as unavailable for UX
      }
    } else if (data) {
      summary = data as FinancialSummary;
    }
  } catch (e) {
    console.error("[finanzas] RPC exception:", (e as Error).message);
    moduleUnavailable = true;
  }

  // ── Fetch recent movements (up to 20) ─────────────────────────
  let movements: Pick<FinancialMovement, "id"|"type"|"amount_cents"|"currency"|"concept"|"category"|"movement_date"|"is_voided"|"created_at">[] | null = null;
  let movFailed = false;

  if (!moduleUnavailable) {
    const { data, error } = await supabase
      .from("financial_movements")
      .select("id, type, amount_cents, currency, concept, category, movement_date, is_voided, created_at")
      .eq("restaurant_id", restaurantId)
      .order("movement_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(20)
      .returns<Pick<FinancialMovement, "id"|"type"|"amount_cents"|"currency"|"concept"|"category"|"movement_date"|"is_voided"|"created_at">[]>();
    if (error) {
      console.error("[finanzas] movements fetch error:", error.message);
      movFailed = true;
    } else {
      movements = data;
    }
  }

  // ── Fetch recent categories for the form datalist ─────────────
  let categories: string[] = [];
  if (!moduleUnavailable) {
    const { data: catRows } = await supabase
      .from("financial_movements")
      .select("category")
      .eq("restaurant_id", restaurantId)
      .not("category", "is", null)
      .order("created_at", { ascending: false })
      .limit(50);
    categories = Array.from(
      new Set((catRows ?? []).map((r) => r.category).filter(Boolean) as string[])
    ).slice(0, 20);
  }

  // ── Fetch stock_tracking_enabled from config ──────────────────
  const { data: cfgRow } = await supabase
    .from("restaurant_config")
    .select("stock_tracking_enabled")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  const stockEnabled = cfgRow?.stock_tracking_enabled ?? false;

  // ── Fetch products for the movement form (if stock enabled) ───
  let products: { id: string; name: string }[] = [];
  if (stockEnabled) {
    const { data: prods } = await supabase
      .from("products")
      .select("id, name")
      .eq("restaurant_id", restaurantId)
      .eq("is_published", true)
      .order("name");
    products = prods ?? [];
  }

  // ── Restaurant currency ───────────────────────────────────────
  const { data: rest } = await supabase
    .from("restaurants")
    .select("currency")
    .eq("id", restaurantId)
    .single();
  const currency = rest?.currency ?? "USD";

  const movList = movements ?? [];
  const hasMovements = movList.length > 0;
  const moduleReady = !moduleUnavailable;

  const PERIOD_LABEL: Record<Period, string> = {
    today:     "Hoy",
    yesterday: "Ayer",
    "7days":   "7 días",
    month:     "Este mes",
  };

  return (
    <>
      <PageHeader
        title="Finanzas"
        description="Registra ingresos, gastos y compras de inventario."
        actions={
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {/* Period tabs */}
            <div className="period-tabs" role="group" aria-label="Filtro de período">
              {(["today", "yesterday", "7days", "month"] as Period[]).map((p) => (
                <Link
                  key={p}
                  href={`/panel/finanzas?periodo=${p}`}
                  className={`period-tab${periodo === p ? " period-tab--on" : ""}`}
                >
                  {PERIOD_LABEL[p]}
                </Link>
              ))}
            </div>
          </div>
        }
      />

      <div className="panel-content">
        {/* ── Module unavailable ────────────────────────────── */}
        {!moduleReady && (
          <div className="dashboard-card" style={{ padding: 32, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
              El módulo de Finanzas no está disponible
            </h3>
            <p style={{ fontSize: 14, color: "#667085", marginBottom: 20, maxWidth: 400, margin: "0 auto 20px" }}>
              Ocurrió un problema al conectar con la base de datos.
              Intenta recargar la página.
            </p>
            <a href="/panel/finanzas" className="button" style={{ textDecoration: "none" }}>
              Reintentar
            </a>
          </div>
        )}

        {/* ── Movement errors (table reachable but query failed) ── */}
        {moduleReady && movFailed && (
          <div className="panel-info-notice" role="alert" style={{ marginBottom: 16 }}>
            No se pudieron cargar los movimientos.{" "}
            <a href="/panel/finanzas" style={{ color: "var(--purple)", fontWeight: 600 }}>
              Reintentar
            </a>
          </div>
        )}

        {/* ── Indicators ───────────────────────────────────── */}
        {moduleReady && summary && (
          <div className="fin-indicators">
            <div className="fin-indicator">
              <div className="fin-indicator-label">Cobrado</div>
              <div className={`fin-indicator-value fin-indicator-value--green`}>
                {formatCents(summary.income_cents, summary.currency)}
              </div>
            </div>
            <div className="fin-indicator">
              <div className="fin-indicator-label">Pagado</div>
              <div className={`fin-indicator-value fin-indicator-value--red`}>
                {formatCents(summary.expense_cents, summary.currency)}
              </div>
            </div>
            <div className="fin-indicator">
              <div className="fin-indicator-label">Flujo neto</div>
              <div className={`fin-indicator-value ${
                summary.net_cents > 0
                  ? "fin-indicator-value--green"
                  : summary.net_cents < 0
                    ? "fin-indicator-value--red"
                    : "fin-indicator-value--neutral"
              }`}>
                {formatCents(summary.net_cents, summary.currency)}
              </div>
            </div>
          </div>
        )}

        {/* ── Movement form (client component with slideout) ─ */}
        {moduleReady && (
          <Suspense fallback={null}>
            <FinanciasSummaryClient
              restaurantId={restaurantId}
              currency={currency}
              stockEnabled={stockEnabled}
              categories={categories}
              products={products}
            />
          </Suspense>
        )}

        {/* ── Movements list ────────────────────────────────── */}
        {moduleReady && (
        <div className="dashboard-card">
          <div className="panel-card-header">
            <div>
              <h2 className="panel-card-title">Movimientos recientes</h2>
              <p className="panel-card-subtitle">Últimos 20 movimientos</p>
            </div>
            {(hasMovements || stockEnabled) && (
              <Link href="/panel/finanzas/analisis" className="text-link" style={{ fontSize: 12 }}>
                Ver análisis →
              </Link>
            )}
          </div>

          {movFailed ? (
            <div className="panel-empty">
              <h3 className="panel-empty-title">No se pudieron cargar los movimientos</h3>
              <p className="panel-empty-desc">
                Intenta recargar la página.
              </p>
              <a href="/panel/finanzas" className="button" style={{ textDecoration: "none" }}>
                Reintentar
              </a>
            </div>
          ) : !hasMovements ? (
            <div className="panel-empty">
              <div className="panel-empty-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22Z"/>
                  <path d="M12 8V12M12 16H12.01"/>
                </svg>
              </div>
              <h3 className="panel-empty-title">Sin movimientos</h3>
              <p className="panel-empty-desc">
                Registra tu primer ingreso o gasto usando el botón &ldquo;Registrar movimiento&rdquo;.
              </p>
            </div>
          ) : (
            <ul className="fin-movements-list">
              {movList.map((m) => (
                <li
                  key={m.id}
                  className={`fin-movement-row${m.is_voided ? " fin-movement-row--voided" : ""}`}
                >
                  <span className="fin-movement-meta" style={{ minWidth: 52 }}>
                    {formatDate(m.movement_date)}
                  </span>
                  <span className={`fin-movement-amount fin-movement-amount--${m.type}`}>
                    {m.type === "income" ? "+" : "−"}
                    {formatCents(m.amount_cents, m.currency)}
                  </span>
                  <span className="fin-movement-concept">{m.concept}</span>
                  {m.category && (
                    <span className="tag" style={{ fontSize: 11 }}>{m.category}</span>
                  )}
                  <span
                    className="order-status-badge"
                    style={{
                      background: m.type === "income" ? "#D1FAE5" : m.type === "purchase" ? "#EDE9FE" : "#FEE2E2",
                      color:      m.type === "income" ? "#065F46" : m.type === "purchase" ? "#5B21B6" : "#991B1B",
                    }}
                  >
                    {TYPE_LABEL[m.type] ?? m.type}
                  </span>
                  {m.is_voided && (
                    <span className="order-status-badge badge-cancelled">Anulado</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        )}
      </div>
    </>
  );
}
