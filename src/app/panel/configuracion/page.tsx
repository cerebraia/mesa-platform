import { redirect } from "next/navigation";
import {
  Settings,
  Clock,
  Truck,
  CreditCard,
  Globe,
  LayoutGrid,
} from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { getActiveMembership } from "@/lib/panel-context";
import { PageHeader } from "@/components/panel/page-header";
import { UnsavedAwareLink } from "@/components/unsaved-changes";
import type {
  RestaurantConfig,
  BusinessHour,
  DeliveryZone,
  PaymentMethod,
} from "@/lib/catalog-types";
import { ConfigForm }     from "./config-form";
import { HoursEditor }    from "./hours-editor";
import { ZonesEditor }    from "./zones-editor";
import { PaymentsEditor } from "./payments-editor";
import { DomainSection }  from "./domain-section";
import { PlanWidget }     from "@/components/panel/plan-widget";

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

type Tab = "general" | "horarios" | "entregas" | "pagos" | "dominio" | "plan";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "general",  label: "General",          icon: <Settings   size={14} /> },
  { id: "horarios", label: "Horarios",          icon: <Clock      size={14} /> },
  { id: "entregas", label: "Entregas",          icon: <Truck      size={14} /> },
  { id: "pagos",    label: "Pagos",             icon: <CreditCard size={14} /> },
  { id: "dominio",  label: "Dominio propio",    icon: <Globe      size={14} /> },
  { id: "plan",     label: "Plan",              icon: <LayoutGrid size={14} /> },
];

function SectionCard({
  title,
  description,
  children,
}: {
  title:        string;
  description?: string;
  children:     React.ReactNode;
}) {
  return (
    <div className="dashboard-card">
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: "#202337", letterSpacing: "-.2px" }}>
          {title}
        </h2>
        {description && (
          <p style={{ fontSize: 13, color: "#667085", marginTop: 4 }}>{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

export default async function ConfiguracionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp  = await searchParams;
  const tab = (TABS.map((t) => t.id).includes(sp.tab as Tab) ? sp.tab : "general") as Tab;

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { active } = await getActiveMembership();
  if (!active) redirect("/panel");

  const restaurantId = active.restaurantId;

  const [
    { data: restaurant },
    { data: config },
    { data: hours },
    { data: zones },
    { data: payments },
    { data: domains },
  ] = await Promise.all([
    supabase.from("restaurants").select("id, name, slug, currency, timezone").eq("id", restaurantId).single(),
    supabase.from("restaurant_config").select("*").eq("restaurant_id", restaurantId).maybeSingle<RestaurantConfig>(),
    supabase.from("business_hours").select("*").eq("restaurant_id", restaurantId).order("day_of_week").order("opens_at").returns<BusinessHour[]>(),
    supabase.from("delivery_zones").select("*").eq("restaurant_id", restaurantId).order("position").returns<DeliveryZone[]>(),
    supabase.from("payment_methods").select("*").eq("restaurant_id", restaurantId).order("position").returns<PaymentMethod[]>(),
    supabase.from("restaurant_domains").select("id, host, kind, status").eq("restaurant_id", restaurantId).order("updated_at", { ascending: false }),
  ]);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  // Build tab href preserving path
  function tabHref(id: string) {
    return `/panel/configuracion?tab=${id}`;
  }

  return (
    <>
      <PageHeader
        title="Configuración"
        description="Identidad, operación, horarios, delivery y medios de pago."
      />

      <div className="panel-content">
        {/* Tab navigation — uses UnsavedAwareLink so guard fires on dirty forms */}
        <nav aria-label="Secciones de configuración" className="panel-tabs" style={{ marginBottom: 24 }}>
          {TABS.map(({ id, label, icon }) => (
            <UnsavedAwareLink
              key={id}
              href={tabHref(id)}
              className={`panel-tab${tab === id ? " panel-tab--active" : ""}`}
            >
              {icon}
              {label}
            </UnsavedAwareLink>
          ))}
        </nav>

        {/* ── General ─── */}
        {tab === "general" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <SectionCard
              title="Identidad del restaurante"
              description="Nombre, descripción, contacto, redes sociales y color de marca del menú."
            >
              {/* Color preview strip */}
              {config?.primary_color && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 14px",
                    background: "#F6F7FB",
                    borderRadius: 8,
                    marginBottom: 20,
                    fontSize: 12,
                    color: "#667085",
                  }}
                >
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      background: config.primary_color,
                      border: "1px solid rgba(0,0,0,.08)",
                      flexShrink: 0,
                    }}
                    aria-label={`Color de marca actual: ${config.primary_color}`}
                  />
                  Color actual del menú público:{" "}
                  <code style={{ fontFamily: "monospace", color: "#202337" }}>
                    {config.primary_color}
                  </code>
                </div>
              )}
              <ConfigForm
                restaurant={{
                  id:       restaurant!.id,
                  name:     restaurant!.name,
                  slug:     restaurant!.slug,
                  timezone: restaurant!.timezone,
                }}
                config={config ?? undefined}
                timezones={TIMEZONES}
                supabaseUrl={supabaseUrl}
                restaurantId={restaurantId}
              />
            </SectionCard>
          </div>
        )}

        {/* ── Horarios ─── */}
        {tab === "horarios" && (
          <SectionCard
            title="Horarios de atención"
            description="Añade intervalos por día. Horario 22:00→02:00 se interpreta como cruce de medianoche."
          >
            <HoursEditor hours={hours ?? []} />
          </SectionCard>
        )}

        {/* ── Entregas ─── */}
        {tab === "entregas" && (
          <SectionCard
            title="Zonas de delivery"
            description="El comprador elige su zona al finalizar el pedido. Sin validación geográfica automática."
          >
            <ZonesEditor zones={zones ?? []} />
          </SectionCard>
        )}

        {/* ── Pagos ─── */}
        {tab === "pagos" && (
          <SectionCard
            title="Medios de pago"
            description="Las instrucciones son privadas y solo se muestran al comprador en la confirmación del pedido."
          >
            <PaymentsEditor payments={payments ?? []} />
          </SectionCard>
        )}

        {/* ── Dominio ─── */}
        {tab === "dominio" && (
          <SectionCard
            title="Dominio personalizado"
            description="Solicita un dominio propio para tu menú público. El equipo de Mesa lo activa manualmente."
          >
            <DomainSection
              restaurantSlug={restaurant!.slug}
              domains={
                (domains ?? []) as Array<{
                  id: string;
                  host: string;
                  kind: string;
                  status: string;
                }>
              }
            />
          </SectionCard>
        )}

        {/* ── Plan ─── */}
        {tab === "plan" && (
          <div style={{ maxWidth: 640 }}>
            <PlanWidget restaurantId={restaurantId} />
          </div>
        )}
      </div>
    </>
  );
}

export const dynamic = "force-dynamic";
