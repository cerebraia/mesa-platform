import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient as createSsrClient } from "@supabase/ssr";
import { createHash } from "crypto";

function createServiceClient() {
  return createSsrClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );
}

const STATUS_LABEL: Record<string, string> = {
  received:   "Recibido — pendiente de aceptación",
  accepted:   "Aceptado",
  preparing:  "En preparación",
  ready:      "Listo",
  on_the_way: "En camino",
  completed:  "Completado",
  rejected:   "Rechazado",
  cancelled:  "Cancelado",
};

const PAYMENT_TYPE_LABEL: Record<string, string> = {
  cash: "Efectivo", transfer: "Transferencia", mobile_payment: "Pago móvil",
  card: "Tarjeta", other: "Otro",
};

function money(cents: number) {
  return new Intl.NumberFormat("es-VE", { style: "currency", currency: "USD" }).format(cents / 100);
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString("es-VE", {
    day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

type OrderData = {
  id: string;
  order_number: number;
  restaurant_id: string;
  status: string;
  payment_status: string;
  modality: string;
  delivery_zone_name: string | null;
  delivery_address: string | null;
  delivery_fee_cents: number;
  payment_method_name: string | null;
  payment_method_type: string | null;
  payment_instructions: string | null;
  notes: string | null;
  subtotal_cents: number;
  total_cents: number;
  created_at: string;
  items: Array<{
    id: string;
    product_name: string;
    variant_name: string | null;
    unit_price_cents: number;
    quantity: number;
    subtotal_cents: number;
    options: Array<{ option_group_name: string; option_name: string; price_delta_cents: number }>;
  }>;
};

function OrderCard({ order, restaurantName, waUrl, isMain }: {
  order: OrderData;
  restaurantName: string;
  waUrl: string | null;
  isMain: boolean;
}) {
  const isTerminal = ["completed", "rejected", "cancelled"].includes(order.status);
  return (
    <div style={isMain ? {} : { opacity: 0.85 }}>
      <div style={{ textAlign: "center", marginBottom: isMain ? 24 : 16 }}>
        <div style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: isMain ? 56 : 36, height: isMain ? 56 : 36,
          background: isTerminal && order.status !== "completed" ? "#fdecea" : "#e8f5e9",
          borderRadius: "50%", fontSize: isMain ? 26 : 18, marginBottom: 10,
        }}>
          {order.status === "completed" ? "✓" : isTerminal ? "✗" : "🧾"}
        </div>
        <h2 style={{ fontSize: isMain ? 22 : 16, margin: "0 0 4px", letterSpacing: -0.5 }}>
          Pedido #{order.order_number}
        </h2>
        <p style={{ color: "#777", fontSize: 12, margin: 0 }}>{restaurantName} · {fmt(order.created_at)}</p>
      </div>

      <div style={{ background: "#f0f4ff", border: "1px solid #c7d7ff", borderRadius: 8, padding: "12px 16px", marginBottom: 14 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{STATUS_LABEL[order.status] ?? order.status}</div>
        <div style={{ fontSize: 12, color: "#777", marginTop: 4 }}>
          Pago: {order.payment_status === "confirmed" ? "✓ Confirmado" : "Pendiente de verificación"}
        </div>
        {order.status === "received" && (
          <div style={{ fontSize: 11, color: "#888", marginTop: 6 }}>
            Pendiente de aceptación. El pago no se confirma automáticamente.
          </div>
        )}
      </div>

      {/* Delivery */}
      <div style={{ border: "1px solid #eee", borderRadius: 8, padding: "12px 16px", marginBottom: 14 }}>
        <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 13 }}>
          {order.modality === "delivery" ? "🚚 Delivery" : "🏪 Retiro en local"}
        </div>
        {order.modality === "delivery" && order.delivery_zone_name && (
          <div style={{ fontSize: 12, color: "#555" }}>Zona: {order.delivery_zone_name}</div>
        )}
        {order.modality === "delivery" && order.delivery_address && (
          <div style={{ fontSize: 12, color: "#555" }}>Dirección: {order.delivery_address}</div>
        )}
      </div>

      {/* Items */}
      <div style={{ border: "1px solid #eee", borderRadius: 8, overflow: "hidden", marginBottom: 14 }}>
        <div style={{ padding: "10px 14px", borderBottom: "1px solid #eee", fontWeight: 600, fontSize: 13 }}>Productos</div>
        {order.items.map((item, idx) => (
          <div key={item.id} style={{ padding: "10px 14px", borderBottom: idx < order.items.length - 1 ? "1px solid #f0f0f0" : "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 500, fontSize: 13 }}>{item.product_name}</span>
                {item.variant_name && <span style={{ fontSize: 11, color: "#777", marginLeft: 6 }}>({item.variant_name})</span>}
                {item.options?.map((opt, oi) => (
                  <div key={oi} style={{ fontSize: 11, color: "#666", marginTop: 2 }}>
                    + {opt.option_name}{opt.price_delta_cents > 0 ? ` (+${money(opt.price_delta_cents)})` : ""}
                  </div>
                ))}
              </div>
              <div style={{ textAlign: "right", flexShrink: 0, fontSize: 12 }}>
                <div>{money(item.unit_price_cents)} × {item.quantity}</div>
                <div style={{ fontWeight: 600 }}>{money(item.subtotal_cents)}</div>
              </div>
            </div>
          </div>
        ))}
        <div style={{ padding: "10px 14px", borderTop: "1px solid #eee", fontSize: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ color: "#777" }}>Subtotal</span><span>{money(order.subtotal_cents)}</span>
          </div>
          {order.delivery_fee_cents > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ color: "#777" }}>Delivery</span><span>{money(order.delivery_fee_cents)}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, borderTop: "1px solid #eee", paddingTop: 6, marginTop: 4 }}>
            <span>Total</span><span>{money(order.total_cents)}</span>
          </div>
        </div>
      </div>

      {/* Payment */}
      <div style={{ border: "1px solid #eee", borderRadius: 8, padding: "12px 16px", marginBottom: 14 }}>
        <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 13 }}>
          {order.payment_method_name}
          {order.payment_method_type && (
            <span style={{ fontWeight: 400, fontSize: 11, color: "#777", marginLeft: 6 }}>
              ({PAYMENT_TYPE_LABEL[order.payment_method_type] ?? order.payment_method_type})
            </span>
          )}
        </div>
        {order.payment_instructions && (
          <div style={{ background: "#fafafa", border: "1px solid #e8e8e8", borderRadius: 6, padding: "8px 12px", fontSize: 12, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
            {order.payment_instructions}
          </div>
        )}
      </div>

      {order.notes && (
        <div style={{ border: "1px solid #eee", borderRadius: 8, padding: "10px 14px", marginBottom: 14 }}>
          <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 13 }}>Observaciones</div>
          <div style={{ fontSize: 12, color: "#555" }}>{order.notes}</div>
        </div>
      )}

      {isMain && waUrl && (
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <a href={waUrl} target="_blank" rel="noopener noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#25d366", color: "white", borderRadius: 10, padding: "10px 20px", fontWeight: 600, fontSize: 13, textDecoration: "none" }}
          >
            Enviar resumen por WhatsApp
          </a>
          <p style={{ fontSize: 10, color: "#888", marginTop: 6 }}>
            Abrir WhatsApp no confirma que el mensaje fue enviado.
          </p>
        </div>
      )}
    </div>
  );
}

export default async function PedidoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const cookieStore = await cookies();
  const cookieName = `order_session_${slug}`;
  const raw = cookieStore.get(cookieName)?.value;

  // Parse and validate session tokens
  let tokens: string[] = [];
  try {
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        tokens = parsed.filter(
          (t): t is string => typeof t === "string" && /^[0-9a-f]{64}$/.test(t),
        );
      }
    }
  } catch {
    tokens = [];
  }

  if (tokens.length === 0) notFound();

  const supabase = createServiceClient();

  // Verify the restaurant exists and is active
  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id, name")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  if (!restaurant) notFound();

  // Fetch all orders from the session tokens in parallel.
  // Each token is an independent credential: knowing one doesn't grant
  // access to others. We only return orders that belong to this restaurant.
  const orderResults = await Promise.all(
    tokens.map(async (token) => {
      const tokenHash = createHash("sha256").update(token).digest("hex");
      const { data } = await supabase.rpc("get_order_by_token", {
        p_token_hash: tokenHash,
      });
      if (!data) return null;
      const order = data as OrderData;
      if (order.restaurant_id !== restaurant.id) return null;
      return order;
    }),
  );

  const orders = orderResults.filter((o): o is OrderData => o !== null);
  if (orders.length === 0) notFound();

  const primaryOrder = orders[0];
  const olderOrders = orders.slice(1);

  // WhatsApp summary built from persisted DB data — token NOT included
  const { data: cfg } = await supabase
    .from("restaurant_config")
    .select("whatsapp")
    .eq("restaurant_id", restaurant.id)
    .maybeSingle();

  const waNumber = cfg?.whatsapp?.replace(/\D/g, "");
  let waUrl: string | null = null;
  if (waNumber && primaryOrder) {
    const lines = [
      `*Pedido #${primaryOrder.order_number} — ${restaurant.name}*`, "",
    ];
    for (const item of primaryOrder.items) {
      let line = `• ${item.product_name}`;
      if (item.variant_name) line += ` (${item.variant_name})`;
      if (item.quantity > 1) line += ` ×${item.quantity}`;
      lines.push(line);
      for (const opt of item.options) {
        lines.push(`  – ${opt.option_name}${opt.price_delta_cents > 0 ? ` (+${money(opt.price_delta_cents)})` : ""}`);
      }
    }
    lines.push(
      "",
      `Modalidad: ${primaryOrder.modality === "delivery" ? "Delivery" : "Retiro en local"}`,
    );
    if (primaryOrder.modality === "delivery" && primaryOrder.delivery_address) {
      lines.push(`Dirección: ${primaryOrder.delivery_address}`);
    }
    if (primaryOrder.payment_method_name) lines.push(`Pago: ${primaryOrder.payment_method_name}`);
    lines.push("", `Subtotal: ${money(primaryOrder.subtotal_cents)}`);
    if (primaryOrder.delivery_fee_cents > 0) lines.push(`Delivery: ${money(primaryOrder.delivery_fee_cents)}`);
    lines.push(`*Total: ${money(primaryOrder.total_cents)}*`);
    waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(lines.join("\n"))}`;
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px 20px 80px", fontFamily: "inherit" }}>
      <OrderCard
        order={primaryOrder}
        restaurantName={restaurant.name}
        waUrl={waUrl}
        isMain
      />

      {olderOrders.length > 0 && (
        <div style={{ marginTop: 40, borderTop: "2px dashed #eee", paddingTop: 32 }}>
          <p style={{ fontSize: 13, color: "#777", fontWeight: 600, marginBottom: 24 }}>
            Pedidos anteriores en este navegador
          </p>
          {olderOrders.map((order, i) => (
            <div key={order.id} style={{ marginBottom: i < olderOrders.length - 1 ? 32 : 0 }}>
              <OrderCard
                order={order}
                restaurantName={restaurant.name}
                waUrl={null}
                isMain={false}
              />
              {i < olderOrders.length - 1 && <hr style={{ border: "none", borderTop: "1px solid #f0f0f0", margin: "24px 0" }} />}
            </div>
          ))}
        </div>
      )}

      <p style={{ textAlign: "center", fontSize: 11, color: "#aaa", marginTop: 32 }}>
        Guarda esta página para consultar tus pedidos.
        La sesión expira en 7 días o cuando cambies de dispositivo.
      </p>
    </div>
  );
}

export const dynamic = "force-dynamic";
