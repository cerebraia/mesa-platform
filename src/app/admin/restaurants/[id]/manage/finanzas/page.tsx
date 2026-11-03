import { notFound, redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { FinanzasAdminClient } from "./finanzas-admin-client";

export default async function ManageFinanzasPage({
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

  const type    = sp.tipo  ?? "";
  const dateFrom = sp.desde ?? "";
  const dateTo   = sp.hasta ?? "";
  const page     = parseInt(sp.pagina ?? "1") || 1;
  const perPage  = 30;

  let query = supabase
    .from("financial_movements")
    .select("id, type, concept, amount_cents, movement_date, category, notes, reference, created_at",
      { count: "exact" })
    .eq("restaurant_id", id)
    .order("movement_date", { ascending: false })
    .order("created_at",    { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);

  if (type)      query = query.eq("type", type);
  if (dateFrom)  query = query.gte("movement_date", dateFrom);
  if (dateTo)    query = query.lte("movement_date", dateTo);

  const { data: movementsRaw, count, error } = await query;

  type Movement = {
    id: string; type: string; concept: string; amount_cents: number;
    movement_date: string; category: string | null; notes: string | null;
    reference: string | null; created_at: string;
  };
  const movements = (movementsRaw ?? []) as Movement[];
  const total = count ?? 0;

  return (
    <>
      <div className="panel-page-header">
        <div>
          <h1 className="panel-page-title">Finanzas</h1>
          <p className="panel-page-desc">{total} movimiento{total !== 1 ? "s" : ""}</p>
        </div>
        <div className="panel-page-actions">
          <a
            href={`/api/admin/export?type=movements&restaurantId=${id}${dateFrom ? `&startDate=${dateFrom}` : ""}${dateTo ? `&endDate=${dateTo}` : ""}`}
            className="button secondary small" style={{ fontSize: 12 }}
          >
            Exportar CSV
          </a>
        </div>
      </div>
      <div className="panel-content">
        {error && (
          <div className="auth-error" role="alert" style={{ marginBottom: 16 }}>{error.message}</div>
        )}
        <FinanzasAdminClient
          restaurantId={id}
          movements={movements}
          total={total}
          currency={restaurant.currency}
          page={page}
          typeFilter={type}
          dateFrom={dateFrom}
          dateTo={dateTo}
        />
      </div>
    </>
  );
}

export const dynamic = "force-dynamic";
