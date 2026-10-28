import { redirect } from "next/navigation";
import {
  Store,
  Palette,
  ShoppingBag,
  Truck,
  CreditCard,
  Clock,
  Globe,
  LayoutGrid,
} from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { getActiveMembership } from "@/lib/panel-context";
import { PageHeader }      from "@/components/panel/page-header";
import { UnsavedAwareLink } from "@/components/unsaved-changes";
import type {
  RestaurantConfig,
  BusinessHour,
  DeliveryZone,
  PaymentMethod,
} from "@/lib/catalog-types";
import { NegocioForm }    from "./config-form";
import { AppearanceForm } from "./config-form";
import { CatalogModeForm } from "./config-form";
import { HoursEditor }    from "./hours-editor";
import { ZonesEditor }    from "./zones-editor";
import { PaymentsEditor } from "./payments-editor";
import { DomainSection }  from "./domain-section";
import { PlanWidget }     from "@/components/panel/plan-widget";
import type { Metadata }  from "next";

export const metadata: Metadata = { title: "Configuración — Mesa" };

const TIMEZONES = [
  "America/Caracas", "America/Bogota", "America/Lima",
  "America/Santiago", "America/Buenos_Aires", "America/Mexico_City",
  "America/New_York", "America/Los_Angeles", "Europe/Madrid", "UTC",
];

type CfgTab = "negocio" | "apariencia" | "catalogo" | "entregas" | "pagos" | "horarios" | "dominio" | "plan";

const TABS: { id: CfgTab; label: string; icon: React.ReactNode }[] = [
  { id: "negocio",   label: "Mi negocio",   icon: <Store      size={15} /> },
  { id: "apariencia",label: "Apariencia",   icon: <Palette    size={15} /> },
  { id: "catalogo",  label: "Catálogo",     icon: <ShoppingBag size={15} /> },
  { id: "entregas",  label: "Entregas",     icon: <Truck      size={15} /> },
  { id: "pagos",     label: "Pagos",        icon: <CreditCard size={15} /> },
  { id: "horarios",  label: "Horarios",     icon: <Clock      size={15} /> },
  { id: "dominio",   label: "Dominio",      icon: <Globe      size={15} /> },
  { id: "plan",      label: "Plan",         icon: <LayoutGrid size={15} /> },
];

function SectionWrap({ title, desc, children }: {
  title: string; desc?: string; children: React.ReactNode;
}) {
  return (
    <div className="cfg-section">
      {(title || desc) && (
        <div className="cfg-section-header">
          {title && <h2 className="cfg-section-title">{title}</h2>}
          {desc  && <p  className="cfg-section-desc">{desc}</p>}
        </div>
      )}
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
  const tab = (TABS.map((t) => t.id).includes(sp.tab as CfgTab) ? sp.tab : "negocio") as CfgTab;

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
    supabase.from("restaurants")
      .select("id, name, slug, currency, timezone")
      .eq("id", restaurantId).single(),
    supabase.from("restaurant_config")
      .select("*").eq("restaurant_id", restaurantId)
      .maybeSingle<RestaurantConfig>(),
    supabase.from("business_hours")
      .select("*").eq("restaurant_id", restaurantId)
      .order("day_of_week").order("opens_at")
      .returns<BusinessHour[]>(),
    supabase.from("delivery_zones")
      .select("*").eq("restaurant_id", restaurantId)
      .order("position").returns<DeliveryZone[]>(),
    supabase.from("payment_methods")
      .select("*").eq("restaurant_id", restaurantId)
      .order("position").returns<PaymentMethod[]>(),
    supabase.from("restaurant_domains")
      .select("id, host, kind, status")
      .eq("restaurant_id", restaurantId)
      .order("updated_at", { ascending: false }),
  ]);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const ordersEnabled = config?.orders_enabled ?? true;

  function tabHref(id: string) { return `/panel/configuracion?tab=${id}`; }

  return (
    <>
      <PageHeader
        title="Configuración"
        description="Personaliza tu negocio y cómo lo ven tus clientes."
      />

      <div className="panel-content">
        {/* Tab navigation */}
        <nav aria-label="Secciones de configuración" className="cfg-tabs">
          {TABS.map(({ id, label, icon }) => (
            <UnsavedAwareLink
              key={id}
              href={tabHref(id)}
              className={`cfg-tab${tab === id ? " cfg-tab--active" : ""}`}
            >
              <span className="cfg-tab-icon" aria-hidden="true">{icon}</span>
              <span className="cfg-tab-label">{label}</span>
            </UnsavedAwareLink>
          ))}
        </nav>

        {/* ── Mi negocio ─────────────────────────────────────── */}
        {tab === "negocio" && (
          <SectionWrap
            title="Mi negocio"
            desc="Nombre, descripción, contacto y datos públicos del negocio."
          >
            <NegocioForm
              restaurant={{ id: restaurant!.id, name: restaurant!.name, slug: restaurant!.slug, timezone: restaurant!.timezone }}
              config={config ?? undefined}
              timezones={TIMEZONES}
            />
          </SectionWrap>
        )}

        {/* ── Apariencia ─────────────────────────────────────── */}
        {tab === "apariencia" && (
          <SectionWrap
            title="Apariencia"
            desc="Logo, portada, colores y tipografía del catálogo público."
          >
            <AppearanceForm
              restaurant={{ id: restaurant!.id, name: restaurant!.name }}
              config={config ?? undefined}
              supabaseUrl={supabaseUrl}
              restaurantId={restaurantId}
            />
          </SectionWrap>
        )}

        {/* ── Catálogo y pedidos ─────────────────────────────── */}
        {tab === "catalogo" && (
          <SectionWrap
            title="Catálogo y pedidos"
            desc="Elige cómo interactúan tus clientes con el catálogo."
          >
            <CatalogModeForm
              config={config ?? undefined}
              restaurant={{ name: restaurant!.name }}
            />
          </SectionWrap>
        )}

        {/* ── Entregas ───────────────────────────────────────── */}
        {tab === "entregas" && (
          <SectionWrap
            title="Zonas de entrega"
            desc="El comprador elige su zona al finalizar el pedido. Sin validación geográfica automática."
          >
            {!ordersEnabled && (
              <div className="panel-info-notice" style={{ marginBottom: 20 }}>
                Las zonas de entrega solo se usan en modo "Catálogo con pedidos".{" "}
                <UnsavedAwareLink href={tabHref("catalogo")} style={{ color: "var(--purple)", fontWeight: 600 }}>
                  Activar pedidos →
                </UnsavedAwareLink>
              </div>
            )}
            <div className="dashboard-card">
              <ZonesEditor zones={zones ?? []} />
            </div>
          </SectionWrap>
        )}

        {/* ── Pagos ──────────────────────────────────────────── */}
        {tab === "pagos" && (
          <SectionWrap
            title="Medios de pago"
            desc="Las instrucciones son privadas y solo se muestran al comprador en la confirmación del pedido."
          >
            {!ordersEnabled && (
              <div className="panel-info-notice" style={{ marginBottom: 20 }}>
                Los medios de pago solo se usan en modo "Catálogo con pedidos".{" "}
                <UnsavedAwareLink href={tabHref("catalogo")} style={{ color: "var(--purple)", fontWeight: 600 }}>
                  Activar pedidos →
                </UnsavedAwareLink>
              </div>
            )}
            <div className="dashboard-card">
              <PaymentsEditor payments={payments ?? []} />
            </div>
          </SectionWrap>
        )}

        {/* ── Horarios ───────────────────────────────────────── */}
        {tab === "horarios" && (
          <SectionWrap
            title="Horarios de atención"
            desc="Añade intervalos por día. Un cierre antes de la apertura (ej. 22:00–02:00) se interpreta como cruce de medianoche."
          >
            <div className="dashboard-card">
              <HoursEditor hours={hours ?? []} />
            </div>
          </SectionWrap>
        )}

        {/* ── Dominio ────────────────────────────────────────── */}
        {tab === "dominio" && (
          <SectionWrap
            title="Dominio personalizado"
            desc="Solicita un dominio propio para tu catálogo público. El equipo de Mesa lo activa manualmente."
          >
            <div className="dashboard-card">
              <DomainSection
                restaurantSlug={restaurant!.slug}
                domains={(domains ?? []) as Array<{ id: string; host: string; kind: string; status: string }>}
              />
            </div>
          </SectionWrap>
        )}

        {/* ── Plan ───────────────────────────────────────────── */}
        {tab === "plan" && (
          <SectionWrap title="Plan actual" desc="Capacidad y límites de tu suscripción.">
            <div style={{ maxWidth: 640 }}>
              <PlanWidget restaurantId={restaurantId} />
            </div>
          </SectionWrap>
        )}
      </div>
    </>
  );
}

export const dynamic = "force-dynamic";
