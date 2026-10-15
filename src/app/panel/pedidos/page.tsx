import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getActiveMembership } from "@/lib/panel-context";
import { PageHeader } from "@/components/panel/page-header";
import { OrdersListClient } from "./orders-list-client";

type OrderSummary = {
  id: string;
  order_number: number;
  status: string;
  modality: string;
  payment_status?: string;
  customer_name?: string;
  customer_phone?: string;
  delivery_zone_name?: string;
  delivery_fee_cents?: number;
  payment_method_name?: string;
  payment_method_type?: string;
  subtotal_cents: number;
  total_cents: number;
  created_at: string;
  updated_at?: string;
};

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp = await searchParams;

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { active } = await getActiveMembership();
  if (!active) redirect("/panel");

  const restaurantId = active.restaurantId;
  const role         = active.role;
  const isKitchen    = role === "kitchen";

  const statusFilter   = sp.status     ?? null;
  const paymentFilter  = sp.pago       ?? null;
  const modalityFilter = sp.modalidad  ?? null;
  const dateFrom       = sp.desde      ?? null;
  const dateTo         = sp.hasta      ?? null;
  const page           = parseInt(sp.pagina ?? "1") || 1;

  const { data: result, error } = await supabase.rpc("get_orders_for_panel", {
    p_restaurant_id:  restaurantId,
    p_status:         statusFilter,
    p_payment_status: paymentFilter,
    p_modality:       modalityFilter,
    p_date_from:      dateFrom,
    p_date_to:        dateTo,
    p_page:           page,
    p_per_page:       50,
  });

  const orders: OrderSummary[] = (result as { orders: OrderSummary[] })?.orders ?? [];

  return (
    <>
      <PageHeader
        title={isKitchen ? "Cola de cocina" : "Pedidos"}
        description={
          isKitchen
            ? "Pedidos aceptados y en preparación."
            : "Gestiona y actualiza el estado de los pedidos."
        }
      />

      <div className="panel-content">
        {error && (
          <div className="auth-error" role="alert" style={{ marginBottom: 16 }}>
            Error al cargar pedidos: {error.message}
          </div>
        )}

        <OrdersListClient
          orders={orders}
          role={role}
          restaurantId={restaurantId}
          currentPage={page}
          currentFilters={{
            status: statusFilter,
            pago:   paymentFilter,
            modalidad: modalityFilter,
            desde: dateFrom,
            hasta: dateTo,
          }}
        />
      </div>
    </>
  );
}

export const dynamic = "force-dynamic";
