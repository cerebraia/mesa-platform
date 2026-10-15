"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, SlidersHorizontal, ChevronLeft, ChevronRight } from "lucide-react";
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
  status:    string | null;
  pago:      string | null;
  modalidad: string | null;
  desde:     string | null;
  hasta:     string | null;
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

const ACTION_LABEL: Record<string, string> = {
  accepted:   "Aceptar",
  preparing:  "Preparando",
  ready:      "Listo",
  on_the_way: "En camino",
  completed:  "Completado",
  rejected:   "Rechazar",
  cancelled:  "Cancelar",
};

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1)  return "ahora";
  if (diff < 60) return `hace ${diff}m`;
  const h = Math.floor(diff / 60);
  if (h < 24)    return `hace ${h}h`;
  return new Date(iso).toLocaleDateString("es-VE");
}

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
    default:           return [];
  }
}

// ── Quick action button ───────────────────────────────────────────

function QuickAction({
  orderId, currentStatus, newStatus, role, onDone,
}: {
  orderId: string;
  currentStatus: string;
  newStatus: string;
  role: string;
  onDone: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [note, setNote]   = useState("");
  const [show, setShow]   = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsNote = newStatus === "rejected" || newStatus === "cancelled";
  const isDanger  = needsNote;

  function handleClick() {
    if (needsNote) { setShow(true); return; }
    setError(null);
    startTransition(async () => {
      const r = await advanceOrderStatus(orderId, newStatus, undefined, currentStatus);
      if (r.conflict) setError(`Estado cambiado a: ${r.currentStatus}. Actualiza.`);
      else if (r.error) setError(r.error);
      else onDone();
    });
  }

  function handleConfirm() {
    if (note.trim().length < 3) { setError("Motivo requerido (mín. 3 caracteres)."); return; }
    setError(null);
    startTransition(async () => {
      const r = await advanceOrderStatus(orderId, newStatus, note.trim(), currentStatus);
      if (r.conflict) setError(`Estado cambiado a: ${r.currentStatus}. Actualiza.`);
      else if (r.error) setError(r.error);
      else { setShow(false); onDone(); }
    });
  }

  if (show) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 200 }}>
        <input
          type="text"
          placeholder="Motivo obligatorio"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          style={{ fontSize: 12, padding: "5px 8px", borderRadius: 6, border: "1px solid #E5E7EB" }}
        />
        {error && <p style={{ color: "#991B1B", fontSize: 11, margin: 0 }}>{error}</p>}
        <div style={{ display: "flex", gap: 5 }}>
          <button className="button small" style={{ fontSize: 11, minHeight: 32 }} onClick={handleConfirm} disabled={isPending}>
            {isPending ? "…" : "Confirmar"}
          </button>
          <button className="button secondary small" style={{ fontSize: 11, minHeight: 32 }} onClick={() => setShow(false)}>
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
        className="panel-quick-action"
        style={{
          fontSize: 11,
          padding: "5px 10px",
          background: isDanger ? "#FEE2E2" : undefined,
          color:      isDanger ? "#991B1B" : undefined,
          borderColor: isDanger ? "#FCA5A5" : undefined,
        }}
        onClick={handleClick}
        disabled={isPending}
        aria-label={`${ACTION_LABEL[newStatus] ?? newStatus} pedido`}
      >
        {isPending ? "…" : ACTION_LABEL[newStatus] ?? newStatus}
      </button>
      {error && <p style={{ color: "#991B1B", fontSize: 11, margin: "4px 0 0" }}>{error}</p>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────

export function OrdersListClient({
  orders,
  role,
  restaurantId,
  currentPage,
  currentFilters,
}: {
  orders:         OrderSummary[];
  role:           "owner" | "attention" | "kitchen";
  restaurantId:   string;
  currentPage:    number;
  currentFilters: Filters;
}) {
  const router = useRouter();
  const [localOrders, setLocalOrders] = useState(orders);
  const isKitchen = role === "kitchen";

  const refresh = useCallback(() => router.refresh(), [router]);
  useEffect(() => { const id = setInterval(refresh, 30_000); return () => clearInterval(id); }, [refresh]);
  useEffect(() => { setLocalOrders(orders); }, [orders]);

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
    return `/panel/pedidos${p.toString() ? `?${p}` : ""}`;
  }

  const hasFilter = Object.values(currentFilters).some(Boolean);

  // Count active statuses for quick chips
  const activeCount = localOrders.filter(
    (o) => !["completed","rejected","cancelled"].includes(o.status)
  ).length;

  return (
    <div>
      {/* Counters */}
      {!isKitchen && (
        <div className="count-strip">
          <span className="count-chip">{localOrders.length} <span>Total cargados</span></span>
          {activeCount > 0 && (
            <span className="count-chip" style={{ color: "#D97706" }}>
              {activeCount} <span style={{ color: "#667085" }}>Activos</span>
            </span>
          )}
        </div>
      )}

      {/* Filter bar — only for owner/attention */}
      {!isKitchen && (
        <div className="panel-filter-bar">
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#667085" }}>
            <SlidersHorizontal size={14} /> Filtros
          </span>

          <select
            value={currentFilters.status ?? ""}
            onChange={(e) => router.push(buildUrl({ status: e.target.value || null, pagina: 1 }))}
            aria-label="Filtrar por estado"
          >
            <option value="">Todos los estados</option>
            {["received","accepted","preparing","ready","on_the_way","completed","rejected","cancelled"].map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>

          <select
            value={currentFilters.pago ?? ""}
            onChange={(e) => router.push(buildUrl({ pago: e.target.value || null, pagina: 1 }))}
            aria-label="Filtrar por pago"
          >
            <option value="">Todos los pagos</option>
            <option value="pending">Pendiente</option>
            <option value="confirmed">Confirmado</option>
          </select>

          <select
            value={currentFilters.modalidad ?? ""}
            onChange={(e) => router.push(buildUrl({ modalidad: e.target.value || null, pagina: 1 }))}
            aria-label="Filtrar por modalidad"
          >
            <option value="">Cualquier modalidad</option>
            <option value="pickup">Retiro</option>
            <option value="delivery">Delivery</option>
          </select>

          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#667085" }}>
            Desde
            <input
              type="date"
              value={currentFilters.desde ?? ""}
              onChange={(e) => router.push(buildUrl({ desde: e.target.value || null, pagina: 1 }))}
              style={{ fontSize: 12, padding: "5px 8px", borderRadius: 6, border: "1px solid #E5E7EB" }}
            />
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#667085" }}>
            Hasta
            <input
              type="date"
              value={currentFilters.hasta ?? ""}
              onChange={(e) => router.push(buildUrl({ hasta: e.target.value || null, pagina: 1 }))}
              style={{ fontSize: 12, padding: "5px 8px", borderRadius: 6, border: "1px solid #E5E7EB" }}
            />
          </label>

          {hasFilter && (
            <Link href="/panel/pedidos" className="filter-clear">
              Limpiar
            </Link>
          )}
        </div>
      )}

      {/* Empty state */}
      {localOrders.length === 0 && (
        <div className="panel-empty">
          <div className="panel-empty-icon">
            <Search size={22} strokeWidth={1.5} />
          </div>
          <p className="panel-empty-title">
            {isKitchen ? "Sin pedidos en preparación" : "Sin pedidos"}
          </p>
          <p className="panel-empty-desc">
            {isKitchen
              ? "Los pedidos aceptados o en preparación aparecerán aquí."
              : hasFilter
              ? "No hay pedidos que coincidan con los filtros seleccionados."
              : "Cuando lleguen pedidos aparecerán aquí."}
          </p>
          {hasFilter && !isKitchen && (
            <Link href="/panel/pedidos" className="button secondary small">
              Limpiar filtros
            </Link>
          )}
        </div>
      )}

      {/* Order table */}
      {localOrders.length > 0 && (
        <div className="dashboard-card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th style={{ paddingLeft: 20, width: 60 }}>#</th>
                  <th>Estado</th>
                  <th>Modalidad</th>
                  {!isKitchen && <th>Cliente</th>}
                  {!isKitchen && <th>Total</th>}
                  {!isKitchen && <th>Pago</th>}
                  <th>Hace</th>
                  <th style={{ paddingRight: 20, minWidth: 160 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {localOrders.map((order) => {
                  const actions    = nextActions(order.status, order.modality, role);
                  const isTerminal = ["completed","rejected","cancelled"].includes(order.status);
                  return (
                    <tr key={order.id} style={{ opacity: isTerminal ? 0.6 : 1 }}>
                      <td style={{ paddingLeft: 20 }}>
                        <Link
                          href={`/panel/pedidos/${order.id}`}
                          style={{ fontWeight: 700, color: "#703BE6", fontSize: 13 }}
                        >
                          #{order.order_number}
                        </Link>
                      </td>
                      <td>
                        <span className={`order-status-badge badge-${order.status}`}>
                          {STATUS_LABEL[order.status] ?? order.status}
                        </span>
                      </td>
                      <td>
                        <span className={`order-status-badge ${order.modality === "pickup" ? "modality-pickup" : "modality-delivery"}`}>
                          {order.modality === "pickup" ? "Retiro" : "Delivery"}
                        </span>
                      </td>
                      {!isKitchen && (
                        <td style={{ fontSize: 13 }}>{order.customer_name ?? "—"}</td>
                      )}
                      {!isKitchen && (
                        <td style={{ fontWeight: 600, fontSize: 13 }}>{money(order.total_cents)}</td>
                      )}
                      {!isKitchen && (
                        <td>
                          <span
                            className={`order-status-badge ${order.payment_status === "confirmed" ? "payment-paid" : "payment-pending"}`}
                          >
                            {order.payment_status === "confirmed" ? "Pagado" : "Pendiente"}
                          </span>
                        </td>
                      )}
                      <td style={{ fontSize: 11, color: "#667085", whiteSpace: "nowrap" }}>
                        {timeAgo(order.created_at)}
                      </td>
                      <td style={{ paddingRight: 20 }}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "flex-start" }}>
                          <Link
                            href={`/panel/pedidos/${order.id}`}
                            className="panel-quick-action"
                            style={{ padding: "5px 10px", fontSize: 11 }}
                          >
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
        </div>
      )}

      {/* Pagination */}
      {!isKitchen && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
          <p style={{ fontSize: 11, color: "#667085", margin: 0 }}>
            Actualización automática cada 30 s.
          </p>
          {(currentPage > 1 || localOrders.length === 50) && (
            <div style={{ display: "flex", gap: 8 }}>
              {currentPage > 1 && (
                <Link href={buildUrl({ pagina: currentPage - 1 })} className="panel-quick-action" style={{ padding: "6px 12px", fontSize: 12 }}>
                  <ChevronLeft size={13} /> Anterior
                </Link>
              )}
              {localOrders.length === 50 && (
                <Link href={buildUrl({ pagina: currentPage + 1 })} className="panel-quick-action" style={{ padding: "6px 12px", fontSize: 12 }}>
                  Siguiente <ChevronRight size={13} />
                </Link>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
