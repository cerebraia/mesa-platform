import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import type {
  RestaurantConfig,
  BusinessHour,
  DeliveryZone,
  PaymentMethod,
} from "@/lib/catalog-types";
import { ConfigForm } from "./config-form";
import { HoursEditor } from "./hours-editor";
import { ZonesEditor } from "./zones-editor";
import { PaymentsEditor } from "./payments-editor";
import { DomainSection } from "./domain-section";

const TIMEZONES = [
  "America/Caracas",
  "America/Bogota",
  "America/Lima",
  "America/Santiago",
  "America/Buenos_Aires",
  "America/Mexico_City",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/Madrid",
  "UTC",
];

export default async function ConfiguracionPage() {
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("restaurant_members")
    .select("restaurant_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!membership) redirect("/panel");

  const { restaurantId } = { restaurantId: membership.restaurant_id };

  const [
    { data: restaurant },
    { data: config },
    { data: hours },
    { data: zones },
    { data: payments },
    { data: domains },
  ] = await Promise.all([
    supabase
      .from("restaurants")
      .select("id, name, slug, currency, timezone")
      .eq("id", restaurantId)
      .single(),
    supabase
      .from("restaurant_config")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .maybeSingle<RestaurantConfig>(),
    supabase
      .from("business_hours")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("day_of_week")
      .order("opens_at")
      .returns<BusinessHour[]>(),
    supabase
      .from("delivery_zones")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("position")
      .returns<DeliveryZone[]>(),
    supabase
      .from("payment_methods")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("position")
      .returns<PaymentMethod[]>(),
    supabase
      .from("restaurant_domains")
      .select("id, host, kind, status")
      .eq("restaurant_id", restaurantId)
      .order("updated_at", { ascending: false }),
  ]);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  return (
    <>
      <div className="dashboard-top">
        <span>CONFIGURACIÓN</span>
        <span>{restaurant?.name}</span>
      </div>

      <div className="dashboard-content">
          <div className="dashboard-heading">
            <div>
              <h1>Configuración del restaurante</h1>
              <p>
                Identidad, operación, delivery y medios de pago.
              </p>
            </div>
          </div>

          {/* ── Identidad + Operación ── */}
          <div className="dashboard-card" style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 17, marginBottom: 24 }}>
              Identidad y operación
            </h2>
            <ConfigForm
              restaurant={{ id: restaurant!.id, name: restaurant!.name, slug: restaurant!.slug, timezone: restaurant!.timezone }}
              config={config ?? undefined}
              timezones={TIMEZONES}
              supabaseUrl={supabaseUrl}
              restaurantId={restaurantId}
            />
          </div>

          {/* ── Horarios ── */}
          <div className="dashboard-card" style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 17, marginBottom: 8 }}>Horarios de atención</h2>
            <p className="muted" style={{ fontSize: 12, marginBottom: 20 }}>
              Añade varios intervalos por día. Si el cierre es antes de la apertura (ej.
              22:00→02:00) se interpreta como cruce de medianoche.
            </p>
            <HoursEditor hours={hours ?? []} />
          </div>

          {/* ── Zonas de delivery ── */}
          <div className="dashboard-card" style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 17, marginBottom: 8 }}>Zonas de delivery</h2>
            <p className="muted" style={{ fontSize: 12, marginBottom: 20 }}>
              El comprador seleccionará la zona al finalizar el pedido.
              No se usa validación geográfica automática en esta versión.
            </p>
            <ZonesEditor zones={zones ?? []} />
          </div>

          {/* ── Medios de pago ── */}
          <div className="dashboard-card" style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 17, marginBottom: 8 }}>Medios de pago</h2>
            <p className="muted" style={{ fontSize: 12, marginBottom: 20 }}>
              Las instrucciones son privadas y se mostrarán al comprador
              en el checkout. No incluyas contraseñas ni credenciales.
            </p>
            <PaymentsEditor payments={payments ?? []} />
          </div>

          {/* ── Dominio personalizado ── */}
          <div className="dashboard-card" style={{ marginBottom: 16 }}>
            <DomainSection
              restaurantSlug={restaurant!.slug}
              domains={(domains ?? []) as Array<{ id: string; host: string; kind: string; status: string }>}
            />
          </div>
      </div>
    </>
  );
}
