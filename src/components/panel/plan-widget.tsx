import { createServerClient } from "@/lib/supabase/server";
import { getPlanByCode } from "@/lib/plan-catalog";
import Link from "next/link";
import type { PlanCode } from "@/lib/plan-catalog";

type PlanUsage = {
  product_count:        number;
  member_count:         number;
  plan_code:            PlanCode | null;
  plan_name:            string | null;
  max_products:         number | null;
  max_members:          number | null;
  price_cents:          number | null;
  currency:             string | null;
  subscription_status:  string | null;
  subscription_ends_at: string | null;
};

function UsageBar({
  used,
  max,
  label,
  primaryColor,
}: {
  used: number;
  max: number;
  label: string;
  primaryColor: string;
}) {
  const pct    = max > 0 ? Math.min((used / max) * 100, 100) : 0;
  const isHigh = pct >= 90;
  const barColor = isHigh ? "#e63b3b" : primaryColor;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: "#202337", fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 12, color: isHigh ? "#c62828" : "#667085", fontWeight: isHigh ? 600 : 400 }}>
          {used} de {max}
        </span>
      </div>
      <div style={{ height: 6, background: "#F6F7FB", borderRadius: 3, overflow: "hidden", border: "1px solid #E5E7EB" }}>
        <div
          style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: 3, transition: "width .3s" }}
          role="progressbar"
          aria-valuenow={used}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-label={label}
        />
      </div>
      {isHigh && (
        <p style={{ fontSize: 11, color: "#c62828", marginTop: 4 }}>
          Cerca del límite — considera cambiar de plan.
        </p>
      )}
    </div>
  );
}

export async function PlanWidget({ restaurantId }: { restaurantId: string }) {
  const supabase = await createServerClient();

  const { data: raw, error } = await supabase.rpc("get_plan_usage", {
    p_restaurant_id: restaurantId,
  });

  // If RPC doesn't exist yet (migration 023 pending), show minimal info
  if (error) {
    return (
      <div className="dashboard-card">
        <h2 style={{ fontSize: 15, fontWeight: 600, color: "#202337", marginBottom: 12 }}>Plan activo</h2>
        <p style={{ fontSize: 13, color: "#667085" }}>
          La información del plan no está disponible. Verifica que la migración 023 ha sido aplicada.
        </p>
      </div>
    );
  }

  const usage = raw as PlanUsage;
  const planDef = getPlanByCode(usage.plan_code);
  const primaryColor = "#703BE6";

  // Ends-at formatting
  let endsAtLabel: string | null = null;
  if (usage.subscription_ends_at) {
    const d = new Date(usage.subscription_ends_at);
    const isExpired = d < new Date();
    endsAtLabel = isExpired
      ? `Venció el ${d.toLocaleDateString("es-VE")}`
      : `Vigente hasta ${d.toLocaleDateString("es-VE")}`;
  }

  return (
    <div className="dashboard-card" style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: "#202337", marginBottom: 2 }}>
            {usage.plan_name ?? "Sin plan activo"}
          </h2>
          {planDef && (
            <p style={{ fontSize: 13, color: "#667085" }}>
              {(planDef.price_cents / 100).toFixed(0)} {planDef.currency}/mes · por restaurante
            </p>
          )}
          {!planDef && (
            <p style={{ fontSize: 13, color: "#667085" }}>Modo onboarding — sin límites de cupo</p>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          {usage.subscription_status && (
            <span className={`order-status-badge ${usage.subscription_status === "active" ? "badge-ready" : "badge-rejected"}`}>
              {usage.subscription_status === "active" ? "Activo" : usage.subscription_status}
            </span>
          )}
          {endsAtLabel && (
            <span style={{ fontSize: 11, color: usage.subscription_ends_at && new Date(usage.subscription_ends_at) < new Date() ? "#c62828" : "#667085" }}>
              {endsAtLabel}
            </span>
          )}
        </div>
      </div>

      {/* Usage bars — only when limits exist */}
      {usage.max_products != null && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <UsageBar
            used={usage.product_count}
            max={usage.max_products}
            label="Productos"
            primaryColor={primaryColor}
          />
          {usage.max_members != null && (
            <UsageBar
              used={usage.member_count}
              max={usage.max_members}
              label="Usuarios activos"
              primaryColor={primaryColor}
            />
          )}
        </div>
      )}

      {/* No plan — just show raw counts */}
      {usage.max_products == null && (
        <div style={{ display: "flex", gap: 16 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#202337" }}>{usage.product_count}</div>
            <div style={{ fontSize: 11, color: "#667085" }}>Productos</div>
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#202337" }}>{usage.member_count}</div>
            <div style={{ fontSize: 11, color: "#667085" }}>Usuarios activos</div>
          </div>
        </div>
      )}

      {/* Plan features summary */}
      {planDef && (
        <div style={{ borderTop: "1px solid #E5E7EB", paddingTop: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "#667085", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 8 }}>
            Tu plan incluye
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 4 }}>
            {planDef.features.map((f) => (
              <li key={f} style={{ fontSize: 12, color: "#202337", display: "flex", alignItems: "flex-start", gap: 7 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#703BE6"
                  strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Change plan */}
      <div style={{ borderTop: "1px solid #E5E7EB", paddingTop: 16 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "#202337", marginBottom: 4 }}>
          ¿Necesitas más capacidad?
        </p>
        <p style={{ fontSize: 12, color: "#667085", marginBottom: 0 }}>
          Los cambios de plan se gestionan directamente con el equipo de Mesa.
          Para solicitar un cambio, comunícate con tu contacto asignado.
        </p>
        {/* Pending: connect to a real contact channel once configured */}
        <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 6, fontStyle: "italic" }}>
          Canal de contacto pendiente de configuración.
        </p>
      </div>
    </div>
  );
}
