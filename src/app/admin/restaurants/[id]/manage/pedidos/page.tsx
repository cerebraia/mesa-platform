import { notFound, redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { OrdersAdminClient } from "./orders-admin-client";

export default async function ManagePedidosPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: adminRow } = await supabase
    .from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!adminRow) redirect("/admin");

  const { data: restaurant } = await supabase
    .from("restaurants").select("id, name, currency")
    .eq("id", id).is("deleted_at", null).maybeSingle();
  if (!restaurant) notFound();

  const statusFilter   = sp.status    ?? null;
  const paymentFilter  = sp.pago      ?? null;
  const page           = parseInt(sp.pagina ?? "1") || 1;

  const { data: result, error } = await supabase.rpc("get_orders_for_panel", {
    p_restaurant_id:  id,
    p_status:         statusFilter,
    p_payment_status: paymentFilter,
    p_modality:       null,
    p_date_from:      null,
    p_date_to:        null,
    p_page:           page,
    p_page_size:      25,
  });

  type OrderRow = {
    id: string; order_number: number; status: string; modality: string;
    payment_status?: string; customer_name?: string;
    subtotal_cents: number; total_cents: number;
    created_at: string;
  };

  const orders = ((result as { orders?: OrderRow[] })?.orders ?? []) as OrderRow[];
  const total  = ((result as { total?: number })?.total ?? 0) as number;

  return (
    <>
      <div className="panel-page-header">
        <div>
          <h1 className="panel-page-title">Pedidos</h1>
          <p className="panel-page-desc">{total} pedido{total !== 1 ? "s" : ""} registrado{total !== 1 ? "s" : ""}</p>
        </div>
        <div className="panel-page-actions">
          <a
            href={`/api/admin/export?type=orders&restaurantId=${id}`}
            className="button secondary small" style={{ fontSize: 12 }}
          >
            Exportar CSV
          </a>
        </div>
      </div>
      <div className="panel-content">
        {error && (
          <div className="auth-error" role="alert" style={{ marginBottom: 16 }}>
            {error.message}
          </div>
        )}
        <OrdersAdminClient
          restaurantId={id}
          orders={orders}
          total={total}
          currency={restaurant.currency}
          page={page}
          statusFilter={statusFilter}
          paymentFilter={paymentFilter}
        />
      </div>
    </>
  );
}

export const dynamic = "force-dynamic";
