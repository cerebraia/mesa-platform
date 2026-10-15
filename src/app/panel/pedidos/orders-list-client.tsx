"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { advanceOrderStatus } from "./actions";

type OrderSummary = {
  id: string;
  order_number: number;
  status: string;
  modality: string;
  payment_status?: string;
  customer_name?: string;
  delivery_zone_name?: string;
  payment_method_name?: string;
  subtotal_cents: number;
  total_cents: number;
  created_at: string;
};

type Filters = {
  status: string | null;
  pago: string | null;
  modalidad: string | null;
  desde: string | null;
  hasta: string | null;
};

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

const STATUS_COLOR: Record<string, string> = {
  received:   "#703BE6",
  accepted:   "#1976d2",
  preparing:  "#e65100",
  ready:      "#2e7d32",
  on_the_way: "#1565c0",
  completed:  "#388e3c",
  rejected:   "#c62828",
  cancelled:  "#757575",
};

const PAYMENT_LABEL: Record<string, string> = {
  pending:   "Pago pendiente",
  confirmed: "Pago confirmado",
  refunded:  "Devuelto",
};

function money(cents: number) {
  return new Intl.NumberFormat("es-VE", { style: "currency", currency: "USD" }).format(cents / 100);
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return "ahora";
  if (diff < 60) return `hace ${diff} min`;
  const h = Math.floor(diff / 60);
  if (h < 24) return `hace ${h}h`;
  return new Date(iso).toLocaleDateString("es-VE");
}

// Next valid statuses a role can advance to from a given status
function nextActions(
  status: string,
  modality: string,
  role: "owner" | "attention" | "kitchen",
): string[] {
  const isStaff = role !== "kitchen";
  switch (status) {
    case "received":   return isStaff ? ["accepted", "rejected"] : [];
    case "accepted":   return ["preparing"];
    case "preparing":  return ["ready"];
    case "ready":
      if (!isStaff) return [];
      return modality === "delivery" ? ["on_the_way"] : ["completed"];
    case "on_the_way": return isStaff ? ["completed"] : [];
    default: return [];
  }
}

const ACTION_LABEL: Record<string, string> = {
  accepted:   "Aceptar",
  preparing:  "Preparando",
  ready:      "Listo",
  on_the_way: "En camino",
  completed:  "Completado",
  rejected:   "Rechazar",
  cancelled:  "Cancelar",
};

// Quick action button for the list row
function QuickAction({
  orderId,
  currentStatus,
  newStatus,
  role,
  onDone,
}: {
  orderId: string;
  currentStatus: string;
  newStatus: string;
  role: string;
  onDone: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsNote = newStatus === "rejected" || newStatus === "cancelled";

  function handleClick() {
    if (needsNote) { setShowNote(true); return; }
    setError(null);
    startTransition(async () => {
      const result = await advanceOrderStatus(orderId, newStatus, undefined, currentStatus);
      if (result.conflict) setError(`Estado cambiado: ${result.currentStatus ?? "desconocido"}. Actualiza.`);
      else if (result.error) setError(result.error);
      else onDone();
    });
  }

  function handleConfirmNote() {
    if (note.trim().length < 3) { setError("El motivo debe tener al menos 3 caracteres."); return; }
    setError(null);
    startTransition(async () => {
      const result = await advanceOrderStatus(orderId, newStatus, note.trim(), currentStatus);
      if (result.conflict) setError(`Estado cambiado: ${result.currentStatus ?? "desconocido"}. Actualiza.`);
      else if (result.error) setError(result.error);
      else { setShowNote(false); onDone(); }
    });
  }

  if (showNote) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
        <input
          type="text" placeholder="Motivo (obligatorio)" value={note}
          onChange={(e) => setNote(e.target.value)}
          style={{ fontSize: 12, padding: "6px 8px" }}
        />
        {error && <p style={{ color: "#c62828", fontSize: 11, margin: 0 }}>{error}</p>}
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" className="button small" style={{ fontSize: 11 }} onClick={handleConfirmNote} disabled={isPending}>
            {isPending ? "…" : "Confirmar"}
          </button>
          <button type="button" className="button secondary small" style={{ fontSize: 11 }} onClick={() => setShowNote(false)}>
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        className="button small"
        style={{ fontSize: 11, background: newStatus === "rejected" || newStatus === "cancelled" ? "#fdecea" : undefined, color: newStatus === "rejected" || newStatus === "cancelled" ? "#c62828" : undefined, border: newStatus === "rejected" || newStatus === "cancelled" ? "1px solid #fca5a5" : undefined }}
        onClick={handleClick}
        disabled={isPending}
      >
        {isPending ? "…" : ACTION_LABEL[newStatus] ?? newStatus}
      </button>
      {error && <p style={{ color: "#c62828", fontSize: 11, margin: "4px 0 0" }}>{error}</p>}
    </div>
  );
}

export function OrdersListClient({
  orders,
  role,
  restaurantId,
  currentPage,
  currentFilters,
}: {
  orders: OrderSummary[];
  role: "owner" | "attention" | "kitchen";
  restaurantId: string;
  currentPage: number;
  currentFilters: Filters;
}) {
  const router = useRouter();
  const [localOrders, setLocalOrders] = useState(orders);
  const isKitchen = role === "kitchen";

  // Poll every 30 s so the list stays current without full-page refresh
  const refresh = useCallback(() => router.refresh(), [router]);
  useEffect(() => {
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  // Sync orders prop when server refreshes
  useEffect(() => { setLocalOrders(orders); }, [orders]);

  // ── Filters ──────────────────────────────────────────────────
  function buildUrl(overrides: Partial<Filters> & { pagina?: number }) {
    const p = new URLSearchParams();
    const f = { ...currentFilters, ...overrides };
    if (f.status)    p.set("status",    f.status);
    if (f.pago)      p.set("pago",      f.pago);
    if (f.modalidad) p.set("modalidad", f.modalidad);
    if (f.desde)     p.set("desde",     f.desde);
    if (f.hasta)     p.set("hasta",     f.hasta);
    const pg = overrides.pagina ?? currentPage;
    if (pg > 1) p.set("pagina", String(pg));
    const qs = p.toString();
    return `/panel/pedidos${qs ? `?${qs}` : ""}`;
  }

  return (
    <div>
      {/* Filters — only for owner/attention */}
      {!isKitchen && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20, alignItems: "center" }}>
          <select
            value={currentFilters.status ?? ""}
            onChange={(e) => router.push(buildUrl({ status: e.target.value || null, pagina: 1 }))}
            style={{ fontSize: 12, padding: "6px 10px", minWidth: 140 }}
          >
            <option value="">Todos los estados</option>
            {["received","accepted","preparing","ready","on_the_way","completed","rejected","cancelled"].map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
          <select
            value={currentFilters.pago ?? ""}
            onChange={(e) => router.push(buildUrl({ pago: e.target.value || null, pagina: 1 }))}
            style={{ fontSize: 12, padding: "6px 10px", minWidth: 140 }}
          >
            <option value="">Todos los pagos</option>
            <option value="pending">Pendiente</option>
            <option value="confirmed">Confirmado</option>
          </select>
          <select
            value={currentFilters.modalidad ?? ""}
            onChange={(e) => router.push(buildUrl({ modalidad: e.target.value || null, pagina: 1 }))}
            style={{ fontSize: 12, padding: "6px 10px", minWidth: 120 }}
          >
            <option value="">Cualquier modalidad</option>
            <option value="pickup">Retiro</option>
            <option value="delivery">Delivery</option>
          </select>
          <input
            type="date" value={currentFilters.desde ?? ""}
            onChange={(e) => router.push(buildUrl({ desde: e.target.value || null, pagina: 1 }))}
            style={{ fontSize: 12, padding: "6px 10px" }}
          />
          <input
            type="date" value={currentFilters.hasta ?? ""}
            onChange={(e) => router.push(buildUrl({ hasta: e.target.value || null, pagina: 1 }))}
            style={{ fontSize: 12, padding: "6px 10px" }}
          />
          {Object.values(currentFilters).some(Boolean) && (
            <Link href="/panel/pedidos" style={{ fontSize: 12, color: "var(--purple)" }}>
              Limpiar filtros
            </Link>
          )}
        </div>
      )}

      {/* Empty state */}
      {localOrders.length === 0 && (
        <div className="dashboard-card" style={{ textAlign: "center", padding: "40px 20px" }}>
          <p style={{ fontSize: 28, marginBottom: 12 }}>📋</p>
          <p style={{ fontSize: 14, color: "var(--muted)" }}>
            {isKitchen
              ? "No hay pedidos aceptados o en preparación en este momento."
              : "No hay pedidos que coincidan con los filtros."}
          </p>
        </div>
      )}

      {/* Order list */}
      {localOrders.length > 0 && (
        <div className="table-scroll">
          <table style={{ fontSize: 13 }}>
            <thead>
              <tr>
                <th>#</th>
                <th>Estado</th>
                <th>Modalidad</th>
                {!isKitchen && <th>Cliente</th>}
                {!isKitchen && <th>Total</th>}
                {!isKitchen && <th>Pago</th>}
                <th>Hora</th>
                <th style={{ minWidth: 180 }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {localOrders.map((order) => {
                const actions = nextActions(order.status, order.modality, role);
                const isTerminal = ["completed","rejected","cancelled"].includes(order.status);
                return (
                  <tr key={order.id} style={{ opacity: isTerminal ? 0.65 : 1 }}>
                    <td>
                      <Link href={`/panel/pedidos/${order.id}`} style={{ fontWeight: 600, color: "var(--purple)" }}>
                        #{order.order_number}
                      </Link>
                    </td>
                    <td>
                      <span
                        className="tag"
                        style={{
                          background: `${STATUS_COLOR[order.status] ?? "#777"}18`,
                          color: STATUS_COLOR[order.status] ?? "#777",
                        }}
                      >
                        {STATUS_LABEL[order.status] ?? order.status}
                      </span>
                    </td>
                    <td>{order.modality === "delivery" ? "🚚 Delivery" : "🏪 Retiro"}</td>
                    {!isKitchen && <td>{order.customer_name ?? "—"}</td>}
                    {!isKitchen && <td style={{ fontWeight: 600 }}>{money(order.total_cents)}</td>}
                    {!isKitchen && (
                      <td>
                        <span style={{ fontSize: 11, color: order.payment_status === "confirmed" ? "#2e7d32" : "#777" }}>
                          {PAYMENT_LABEL[order.payment_status ?? "pending"] ?? "—"}
                        </span>
                      </td>
                    )}
                    <td style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap" }}>
                      {timeAgo(order.created_at)}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "flex-start" }}>
                        <Link href={`/panel/pedidos/${order.id}`} className="button secondary small" style={{ fontSize: 11 }}>
                          Ver
                        </Link>
                        {actions.map((next) => (
                          <QuickAction
                            key={next}
                            orderId={order.id}
                            currentStatus={order.status}
                            newStatus={next}
                            role={role}
                            onDone={refresh}
                          />
                        ))}
                        {role === "owner" && !isTerminal && (
                          <QuickAction
                            orderId={order.id}
                            currentStatus={order.status}
                            newStatus="cancelled"
                            role={role}
                            onDone={refresh}
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
      )}

      {/* Pagination */}
      {!isKitchen && localOrders.length === 50 && (
        <div style={{ display: "flex", gap: 12, marginTop: 16, justifyContent: "flex-end" }}>
          {currentPage > 1 && (
            <Link href={buildUrl({ pagina: currentPage - 1 })} className="button secondary small" style={{ fontSize: 12 }}>
              ← Anterior
            </Link>
          )}
          <Link href={buildUrl({ pagina: currentPage + 1 })} className="button secondary small" style={{ fontSize: 12 }}>
            Siguiente →
          </Link>
        </div>
      )}

      <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 12 }}>
        Actualización automática cada 30 segundos.
      </p>
    </div>
  );
}
