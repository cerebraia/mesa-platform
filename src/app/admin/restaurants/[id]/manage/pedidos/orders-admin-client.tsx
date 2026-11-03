"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { adminAdvanceOrderStatus } from "../actions";

type OrderRow = {
  id: string; order_number: number; status: string; modality: string;
  payment_status?: string; customer_name?: string;
  subtotal_cents: number; total_cents: number; created_at: string;
};

interface Props {
  restaurantId:  string;
  orders:        OrderRow[];
  total:         number;
  currency:      string;
  page:          number;
  statusFilter:  string | null;
  paymentFilter: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  received:   "Recibido",
  accepted:   "Aceptado",
  preparing:  "Preparando",
  ready:      "Listo",
  on_the_way: "En camino",
  completed:  "Completado",
  rejected:   "Rechazado",
  cancelled:  "Cancelado",
};

const STATUS_BADGE: Record<string, string> = {
  received:   "badge-accepted",
  accepted:   "badge-accepted",
  preparing:  "badge-preparing",
  ready:      "badge-ready",
  on_the_way: "badge-preparing",
  completed:  "badge-completed",
  rejected:   "badge-rejected",
  cancelled:  "badge-cancelled",
};

const TRANSITIONS: Record<string, string[]> = {
  received:   ["accepted", "rejected"],
  accepted:   ["preparing"],
  preparing:  ["ready"],
  ready:      ["completed", "on_the_way"],
  on_the_way: ["completed"],
};

function formatCents(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat("es", {
      style: "currency", currency,
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(cents / 100);
  } catch { return `$${(cents / 100).toFixed(2)}`; }
}

export function OrdersAdminClient({
  restaurantId, orders, total, currency, page, statusFilter, paymentFilter,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const router = useRouter();

  function advance(orderId: string, currentStatus: string, newStatus: string) {
    setActionError(null);
    startTransition(async () => {
      const res = await adminAdvanceOrderStatus(restaurantId, orderId, newStatus, currentStatus);
      if (res.error) setActionError(res.error);
      else router.refresh();
    });
  }

  function buildUrl(params: Record<string, string | null>) {
    const ps = new URLSearchParams();
    const merged = { status: statusFilter, pago: paymentFilter, pagina: String(page), ...params };
    for (const [k, v] of Object.entries(merged)) {
      if (v) ps.set(k, v);
    }
    return `?${ps}`;
  }

  if (orders.length === 0) {
    return (
      <div className="panel-empty">
        <p className="panel-empty-title">Sin pedidos</p>
        <p className="panel-empty-desc">
          {statusFilter ? "Ningún pedido con ese estado." : "Este negocio no tiene pedidos aún."}
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <Link href={buildUrl({ status: null, pagina: "1" })} className={`button secondary small${!statusFilter ? " button--active" : ""}`} style={{ fontSize: 12 }}>
          Todos
        </Link>
        {["received", "accepted", "preparing", "ready", "completed", "rejected"].map((s) => (
          <Link key={s} href={buildUrl({ status: s, pagina: "1" })}
            className={`button secondary small${statusFilter === s ? " button--active" : ""}`}
            style={{ fontSize: 12 }}
          >
            {STATUS_LABEL[s]}
          </Link>
        ))}
      </div>

      {actionError && (
        <div className="auth-error" role="alert" style={{ marginBottom: 12 }}>{actionError}</div>
      )}

      <div className="dashboard-card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Cliente</th>
                <th>Modalidad</th>
                <th>Total</th>
                <th>Estado</th>
                <th>Fecha</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const next = TRANSITIONS[o.status] ?? [];
                return (
                  <tr key={o.id}>
                    <td style={{ fontWeight: 600, fontSize: 13 }}>#{o.order_number}</td>
                    <td style={{ fontSize: 13 }}>{o.customer_name ?? "—"}</td>
                    <td style={{ fontSize: 12, color: "#667085", textTransform: "capitalize" }}>{o.modality}</td>
                    <td style={{ fontSize: 13, fontWeight: 600 }}>{formatCents(o.total_cents, currency)}</td>
                    <td>
                      <span className={`order-status-badge ${STATUS_BADGE[o.status] ?? "badge-cancelled"}`} style={{ fontSize: 11 }}>
                        {STATUS_LABEL[o.status] ?? o.status}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: "#667085" }}>
                      {new Date(o.created_at).toLocaleDateString("es-VE")}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        {next.map((ns) => (
                          <button key={ns} disabled={pending}
                            onClick={() => advance(o.id, o.status, ns)}
                            className="button secondary small" style={{ fontSize: 11 }}
                          >
                            → {STATUS_LABEL[ns]}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
        {page > 1 && (
          <Link href={buildUrl({ pagina: String(page - 1) })} className="button secondary small">← Anterior</Link>
        )}
        <span style={{ fontSize: 12, color: "#667085" }}>Página {page}</span>
        {orders.length === 25 && (
          <Link href={buildUrl({ pagina: String(page + 1) })} className="button secondary small">Siguiente →</Link>
        )}
      </div>
    </>
  );
}
