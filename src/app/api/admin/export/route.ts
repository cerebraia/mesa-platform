import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

// ── Auth ──────────────────────────────────────────────────────
// Returns the admin's authenticated Supabase client, which has access to
// all tables via is_platform_admin() RLS policies. This avoids the need
// for a service-role client in Route Handlers, which has issues with the
// @supabase/ssr cookie machinery in this execution context.

async function requireAdminSession() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: adminRow, error: adminErr } = await supabase
    .from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (adminErr || !adminRow) return null;
  return { user, db: supabase };
}

// ── CSV helpers ───────────────────────────────────────────────

const BOM = "﻿"; // UTF-8 BOM for Excel compatibility

function csvCell(value: unknown): string {
  const str = value == null ? "" : String(value);
  // Prevent formula injection: prefix cells starting with =+-@|
  const safe = /^[=+\-@|]/.test(str) ? "'" + str : str;
  const escaped = safe.replace(/"/g, '""');
  if (/[",\n\r]/.test(escaped)) return `"${escaped}"`;
  return escaped;
}

function buildCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows) {
    lines.push(row.map(csvCell).join(","));
  }
  return BOM + lines.join("\r\n");
}

function csvResponse(csv: string, filename: string): NextResponse {
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store, no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

// ── Export handlers ───────────────────────────────────────────

async function exportRestaurants(db: SupabaseClient) {
  const { data, error } = await db
    .from("restaurants")
    .select("id, name, slug, business_type, status, currency, timezone, created_at, deleted_at")
    .order("created_at", { ascending: false })
    .limit(5000);

  if (error) throw new Error(error.message);

  const headers = ["ID", "Nombre", "Slug", "Tipo", "Estado", "Moneda", "Zona horaria", "Creado", "Eliminado"];
  const rows = (data ?? []).map((r) => [
    r.id, r.name, r.slug, r.business_type, r.status,
    r.currency, r.timezone,
    new Date(r.created_at).toISOString(),
    r.deleted_at ? new Date(r.deleted_at).toISOString() : "",
  ]);
  return buildCsv(headers, rows);
}

async function exportProducts(db: SupabaseClient, restaurantId: string | null) {
  let q = db
    .from("products")
    .select(`
      id, name, restaurant_id, category_id, base_price_cents, promo_price_cents,
      is_published, is_available, description, deleted_at, created_at,
      restaurants ( name, currency )
    `)
    .order("created_at", { ascending: false })
    .limit(5000);

  if (restaurantId) q = q.eq("restaurant_id", restaurantId);

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const headers = ["ID", "Negocio", "Moneda", "Nombre", "Descripción",
    "Precio base", "Precio promo", "Publicado", "Disponible", "Eliminado", "Creado"];
  const rows = (data ?? []).map((p: Record<string, unknown>) => {
    const rest = (p.restaurants as { name: string; currency: string } | null);
    const currency = rest?.currency ?? "USD";
    const toAmount = (cents: number | null) => cents != null ? (cents / 100).toFixed(2) : "";
    return [
      p.id, rest?.name ?? "", currency,
      p.name, p.description ?? "",
      toAmount(p.base_price_cents as number | null),
      toAmount(p.promo_price_cents as number | null),
      p.is_published ? "Sí" : "No",
      p.is_available ? "Sí" : "No",
      p.deleted_at ? new Date(p.deleted_at as string).toISOString() : "",
      new Date(p.created_at as string).toISOString(),
    ];
  });
  return buildCsv(headers, rows);
}

async function exportOrders(
  db: SupabaseClient,
  restaurantId: string | null,
  startDate: string | null,
  endDate: string | null,
) {
  let q = db
    .from("orders")
    .select(`
      id, order_number, status, payment_status, modality,
      customer_name, customer_phone, delivery_address,
      subtotal_cents, delivery_fee_cents, total_cents,
      notes, created_at, restaurant_id,
      restaurants ( name, currency )
    `)
    .order("created_at", { ascending: false })
    .limit(5000);

  if (restaurantId) q = q.eq("restaurant_id", restaurantId);
  if (startDate)    q = q.gte("created_at", startDate);
  if (endDate)      q = q.lte("created_at", endDate + "T23:59:59Z");

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const headers = ["ID", "Negocio", "Moneda", "#Pedido", "Estado", "Pago",
    "Modalidad", "Cliente", "Teléfono", "Dirección", "Subtotal", "Envío", "Total", "Notas", "Fecha"];
  const rows = (data ?? []).map((o: Record<string, unknown>) => {
    const rest = (o.restaurants as { name: string; currency: string } | null);
    const currency = rest?.currency ?? "USD";
    const toAmount = (cents: number | null) => cents != null ? (cents / 100).toFixed(2) : "0.00";
    return [
      o.id, rest?.name ?? "", currency,
      o.order_number, o.status, o.payment_status ?? "",
      o.modality, o.customer_name ?? "", o.customer_phone ?? "",
      o.delivery_address ?? "",
      toAmount(o.subtotal_cents as number | null),
      toAmount(o.delivery_fee_cents as number | null),
      toAmount(o.total_cents as number | null),
      o.notes ?? "",
      new Date(o.created_at as string).toISOString(),
    ];
  });
  return buildCsv(headers, rows);
}

async function exportMovements(
  db: SupabaseClient,
  restaurantId: string | null,
  startDate: string | null,
  endDate: string | null,
) {
  let q = db
    .from("financial_movements")
    .select(`
      id, type, concept, amount_cents, movement_date,
      category, notes, reference, created_at, restaurant_id,
      restaurants ( name, currency )
    `)
    .order("movement_date", { ascending: false })
    .limit(5000);

  if (restaurantId) q = q.eq("restaurant_id", restaurantId);
  if (startDate)    q = q.gte("movement_date", startDate);
  if (endDate)      q = q.lte("movement_date", endDate);

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const headers = ["ID", "Negocio", "Moneda", "Tipo", "Concepto", "Monto",
    "Fecha", "Categoría", "Referencia", "Notas", "Registrado"];
  const rows = (data ?? []).map((m: Record<string, unknown>) => {
    const rest = (m.restaurants as { name: string; currency: string } | null);
    return [
      m.id, rest?.name ?? "", rest?.currency ?? "USD",
      m.type, m.concept,
      ((m.amount_cents as number ?? 0) / 100).toFixed(2),
      m.movement_date, m.category ?? "",
      m.reference ?? "", m.notes ?? "",
      new Date(m.created_at as string).toISOString(),
    ];
  });
  return buildCsv(headers, rows);
}

async function exportSubscriptions(db: SupabaseClient, restaurantId: string | null) {
  let q = db
    .from("subscriptions")
    .select(`
      id, status, starts_at, ends_at, notes, created_at, restaurant_id,
      restaurants ( name ),
      plans ( name, price_cents, currency )
    `)
    .order("created_at", { ascending: false })
    .limit(5000);

  if (restaurantId) q = q.eq("restaurant_id", restaurantId);

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const headers = ["ID", "Negocio", "Plan", "Precio plan", "Moneda plan",
    "Estado", "Inicio", "Vencimiento", "Notas", "Creado"];
  const rows = (data ?? []).map((s: Record<string, unknown>) => {
    const rest = (s.restaurants as { name: string } | null);
    const plan = (s.plans as { name: string; price_cents: number; currency: string } | null);
    return [
      s.id, rest?.name ?? "", plan?.name ?? "",
      plan ? (plan.price_cents / 100).toFixed(2) : "",
      plan?.currency ?? "",
      s.status,
      s.starts_at ? new Date(s.starts_at as string).toISOString() : "",
      s.ends_at    ? new Date(s.ends_at    as string).toISOString() : "Indefinida",
      s.notes ?? "",
      new Date(s.created_at as string).toISOString(),
    ];
  });
  return buildCsv(headers, rows);
}

// ── Route handler ─────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdminSession();
  if (!auth) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const sp           = request.nextUrl.searchParams;
  const type         = sp.get("type") ?? "";
  const restaurantId = sp.get("restaurantId");
  const startDate    = sp.get("startDate");
  const endDate      = sp.get("endDate");
  const { db } = auth;

  // Audit log — best-effort, does not block the export on failure
  await db.from("admin_audit_log").insert({
    admin_user_id: auth.user.id,
    action:        `export_${type}`,
    target_type:   "export",
    target_id:     restaurantId,
    details:       { type, restaurantId, startDate, endDate },
  });

  try {
    switch (type) {
      case "restaurants": {
        const csv = await exportRestaurants(db);
        return csvResponse(csv, `negocios_${new Date().toISOString().slice(0, 10)}.csv`);
      }
      case "products": {
        const csv = await exportProducts(db, restaurantId);
        const name = restaurantId ? `productos_${restaurantId.slice(0, 8)}` : "productos";
        return csvResponse(csv, `${name}_${new Date().toISOString().slice(0, 10)}.csv`);
      }
      case "orders": {
        const csv = await exportOrders(db, restaurantId, startDate, endDate);
        const name = restaurantId ? `pedidos_${restaurantId.slice(0, 8)}` : "pedidos";
        return csvResponse(csv, `${name}_${new Date().toISOString().slice(0, 10)}.csv`);
      }
      case "movements": {
        const csv = await exportMovements(db, restaurantId, startDate, endDate);
        const name = restaurantId ? `movimientos_${restaurantId.slice(0, 8)}` : "movimientos";
        return csvResponse(csv, `${name}_${new Date().toISOString().slice(0, 10)}.csv`);
      }
      case "subscriptions": {
        const csv = await exportSubscriptions(db, restaurantId);
        const name = restaurantId ? `suscripciones_${restaurantId.slice(0, 8)}` : "suscripciones";
        return csvResponse(csv, `${name}_${new Date().toISOString().slice(0, 10)}.csv`);
      }
      default:
        return NextResponse.json({
          error: "Tipo de exportación no válido. Usa: restaurants, products, orders, movements, subscriptions",
        }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
