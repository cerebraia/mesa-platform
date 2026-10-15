import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { getActiveMembership } from "@/lib/panel-context";
import { OrderDetailClient } from "../order-detail-client";

type OrderDetail = {
  id: string;
  order_number: number;
  status: string;
  modality: string;
  subtotal_cents: number;
  total_cents: number;
  created_at: string;
  role: string;
  // owner/attention only
  customer_name?: string;
  customer_phone?: string;
  delivery_zone_name?: string;
  delivery_address?: string;
  delivery_fee_cents?: number;
  payment_method_name?: string;
  payment_method_type?: string;
  payment_instructions?: string;
  notes?: string;
  payment_status?: string;
  updated_at?: string;
  items: Array<{
    id: string;
    product_name: string;
    variant_name: string | null;
    unit_price_cents?: number;
    quantity: number;
    subtotal_cents?: number;
    position: number;
    options: Array<{
      option_group_name: string;
      option_name: string;
      price_delta_cents?: number;
    }>;
  }>;
  status_events?: Array<{
    status: string;
    note: string | null;
    created_by: string | null;
    created_at: string;
  }>;
};

function money(cents: number) {
  return new Intl.NumberFormat("es-VE", { style: "currency", currency: "USD" }).format(cents / 100);
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { active } = await getActiveMembership();
  if (!active) redirect("/panel");

  const restaurantId = active.restaurantId;
  const role         = active.role;

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id, name")
    .eq("id", restaurantId)
    .single();

  const { data: rawOrder, error } = await supabase.rpc("get_order_full_detail", {
    p_order_id:      id,
    p_restaurant_id: restaurantId,
  });

  if (error || !rawOrder) notFound();

  const order = rawOrder as OrderDetail;

  const isTerminal = ["completed", "rejected", "cancelled"].includes(order.status);

  const STATUS_LABEL: Record<string, string> = {
    received:          "Recibido",
    accepted:          "Aceptado",
    preparing:         "En preparación",
    ready:             "Listo",
    on_the_way:        "En camino",
    completed:         "Completado",
    rejected:          "Rechazado",
    cancelled:         "Cancelado",
    payment_confirmed: "Pago confirmado",
    payment_pending:   "Pago revertido",
  };

  return (
    <>
      <div className="dashboard-top">
        <span>PEDIDO #{order.order_number}</span>
        <Link href="/panel/pedidos" className="muted" style={{ fontSize: 12, textDecoration: "none" }}>
          ← Pedidos
        </Link>
      </div>

      <div className="dashboard-content">
          <div className="dashboard-heading" style={{ marginBottom: 20 }}>
            <div>
              <h1 style={{ fontSize: 28 }}>Pedido #{order.order_number}</h1>
              <p style={{ fontSize: 13 }}>
                {new Date(order.created_at).toLocaleString("es-VE", {
                  day: "numeric", month: "long", year: "numeric",
                  hour: "2-digit", minute: "2-digit",
                })}
              </p>
            </div>
          </div>

          {/* Status + quick actions (client component) */}
          <OrderDetailClient
            orderId={order.id}
            restaurantId={restaurantId}
            status={order.status}
            paymentStatus={order.payment_status}
            modality={order.modality}
            role={role}
          />

          {/* Customer info — owner/attention only */}
          {role !== "kitchen" && (
            <div className="dashboard-card" style={{ marginBottom: 16 }}>
              <h2 style={{ fontSize: 15, marginBottom: 12 }}>Datos del comprador</h2>
              <div style={{ fontSize: 13, display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 16px" }}>
                <span style={{ color: "var(--muted)" }}>Nombre</span>
                <span>{order.customer_name ?? "—"}</span>
                <span style={{ color: "var(--muted)" }}>Teléfono</span>
                <span>{order.customer_phone ?? "—"}</span>
                {order.modality === "delivery" && (
                  <>
                    <span style={{ color: "var(--muted)" }}>Zona</span>
                    <span>{order.delivery_zone_name ?? "—"}</span>
                    <span style={{ color: "var(--muted)" }}>Dirección</span>
                    <span>{order.delivery_address ?? "—"}</span>
                  </>
                )}
                {order.notes && (
                  <>
                    <span style={{ color: "var(--muted)" }}>Observaciones</span>
                    <span>{order.notes}</span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Items */}
          <div className="dashboard-card" style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 15, marginBottom: 12 }}>
              {role === "kitchen" ? "Para preparar" : "Productos"}
            </h2>
            {order.items.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: "10px 0",
                  borderBottom: "1px solid var(--border)",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 600 }}>
                    {item.quantity > 1 && `${item.quantity}× `}
                    {item.product_name}
                  </span>
                  {item.variant_name && (
                    <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: 6 }}>
                      ({item.variant_name})
                    </span>
                  )}
                  {item.options?.map((opt, oi) => (
                    <div key={oi} style={{ fontSize: 12, color: "var(--muted)", marginTop: 2, paddingLeft: 14 }}>
                      + {opt.option_name}
                      {role !== "kitchen" && opt.price_delta_cents && opt.price_delta_cents > 0
                        ? ` (+${money(opt.price_delta_cents)})`
                        : ""}
                    </div>
                  ))}
                </div>
                {role !== "kitchen" && (
                  <div style={{ textAlign: "right", flexShrink: 0, fontSize: 13 }}>
                    <div>{money(item.unit_price_cents ?? 0)} × {item.quantity}</div>
                    <div style={{ fontWeight: 600 }}>{money(item.subtotal_cents ?? 0)}</div>
                  </div>
                )}
              </div>
            ))}

            {role !== "kitchen" && (
              <div style={{ paddingTop: 12, fontSize: 13 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ color: "var(--muted)" }}>Subtotal</span>
                  <span>{money(order.subtotal_cents)}</span>
                </div>
                {(order.delivery_fee_cents ?? 0) > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ color: "var(--muted)" }}>Delivery</span>
                    <span>{money(order.delivery_fee_cents ?? 0)}</span>
                  </div>
                )}
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  fontWeight: 700, fontSize: 15,
                  borderTop: "1px solid var(--border)", paddingTop: 8, marginTop: 4,
                }}>
                  <span>Total</span>
                  <span>{money(order.total_cents)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Payment — owner/attention only */}
          {role !== "kitchen" && (
            <div className="dashboard-card" style={{ marginBottom: 16 }}>
              <h2 style={{ fontSize: 15, marginBottom: 12 }}>Pago</h2>
              <div style={{ fontSize: 13, display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 16px" }}>
                <span style={{ color: "var(--muted)" }}>Método</span>
                <span>{order.payment_method_name ?? "—"}</span>
                <span style={{ color: "var(--muted)" }}>Estado</span>
                <span style={{ color: order.payment_status === "confirmed" ? "#2e7d32" : "#777", fontWeight: 500 }}>
                  {order.payment_status === "confirmed" ? "Confirmado" : "Pendiente de verificación"}
                </span>
              </div>
              {order.payment_instructions && (
                <div style={{ marginTop: 10, background: "var(--soft)", borderRadius: 8, padding: "10px 14px", fontSize: 12, whiteSpace: "pre-wrap" }}>
                  {order.payment_instructions}
                </div>
              )}
              <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 10 }}>
                El sistema no confirma pagos automáticamente. Verifica manualmente antes de despachar.
              </p>
            </div>
          )}

          {/* Status history — owner/attention only */}
          {role !== "kitchen" && order.status_events && order.status_events.length > 0 && (
            <div className="dashboard-card">
              <h2 style={{ fontSize: 15, marginBottom: 12 }}>Historial</h2>
              {[...order.status_events].reverse().map((ev, i) => (
                <div
                  key={i}
                  style={{ padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 12 }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <span style={{ fontWeight: 500 }}>
                      {STATUS_LABEL[ev.status] ?? ev.status}
                    </span>
                    <span style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>
                      {new Date(ev.created_at).toLocaleString("es-VE", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}
                    </span>
                  </div>
                  {ev.note && (
                    <div style={{ color: "var(--muted)", marginTop: 2 }}>{ev.note}</div>
                  )}
                </div>
              ))}
            </div>
          )}
      </div>
    </>
  );
}

export const dynamic = "force-dynamic";
