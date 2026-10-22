"use client";

import { useState, useTransition } from "react";
import { createSubscription } from "../../actions";
import { getPlanByCode } from "@/lib/plan-catalog";
import type { PlanCode } from "@/lib/plan-catalog";

type Plan = { id: string; name: string; price_cents: number; currency: string; is_test: boolean; plan_code: string | null };

export function NewSubscriptionForm({
  restaurantId,
  plans,
}: {
  restaurantId: string;
  plans: Plan[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError]         = useState<string | null>(null);
  const [saved, setSaved]         = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(plans[0]?.id ?? "");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const endsAt = String(fd.get("ends_at") ?? "").trim() || null;
    const notes  = String(fd.get("notes") ?? "").trim();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await createSubscription(restaurantId, selectedPlan, endsAt, notes);
      if (result.error) {
        setError(result.error);
      } else {
        setSaved(true);
        (e.target as HTMLFormElement).reset();
        setSelectedPlan(plans[0]?.id ?? "");
      }
    });
  }

  if (plans.length === 0) {
    return (
      <p style={{ fontSize: 13, color: "var(--muted)" }}>
        No hay planes activos.{" "}
        <a href="/admin/planes" style={{ color: "var(--purple)" }}>Crea uno en Planes</a>.
      </p>
    );
  }

  const plan = plans.find((p) => p.id === selectedPlan);
  const planDef = plan?.plan_code ? getPlanByCode(plan.plan_code as PlanCode) : null;

  return (
    <form onSubmit={handleSubmit}>
      <div className="field" style={{ marginBottom: 16 }}>
        <label>Plan</label>
        <select
          name="plan_id"
          value={selectedPlan}
          onChange={(e) => setSelectedPlan(e.target.value)}
        >
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}{p.is_test ? " [TEST]" : ""}
              {" — "}{p.currency} {(p.price_cents / 100).toFixed(2)}/mes
            </option>
          ))}
        </select>
      </div>

      {/* Plan details card */}
      {plan && (
        <div style={{
          background: "#F6F7FB", border: "1px solid #E5E7EB", borderRadius: 10,
          padding: "14px 16px", marginBottom: 16, fontSize: 13,
        }}>
          {plan.is_test && (
            <div style={{ color: "#e65100", fontWeight: 600, fontSize: 11, marginBottom: 8 }}>
              ⚠ Plan de prueba — solo para desarrollo
            </div>
          )}
          {planDef ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                <span>
                  <strong>{planDef.max_products}</strong>{" "}
                  <span style={{ color: "#667085" }}>productos máx.</span>
                </span>
                <span>
                  <strong>{planDef.max_members}</strong>{" "}
                  <span style={{ color: "#667085" }}>usuario{planDef.max_members !== 1 ? "s" : ""} máx.</span>
                </span>
                <span>
                  <strong>{planDef.currency} {(planDef.price_cents / 100).toFixed(2)}</strong>{" "}
                  <span style={{ color: "#667085" }}>/mes</span>
                </span>
              </div>
              <div style={{ color: "#667085", fontSize: 12 }}>
                Roles: {planDef.allowed_roles.join(", ")}
              </div>
              <div style={{ color: "#667085", fontSize: 12 }}>{planDef.description_short}</div>
            </div>
          ) : (
            <div style={{ color: "#667085" }}>
              {plan.currency} {(plan.price_cents / 100).toFixed(2)}/mes
            </div>
          )}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div className="field">
          <label>Fecha de vencimiento</label>
          <input name="ends_at" type="date" />
          <span className="caption" style={{ marginTop: 4 }}>Dejar vacío = vigencia indefinida</span>
        </div>
        <div className="field">
          <label>Notas (opcional)</label>
          <input name="notes" type="text" maxLength={500} placeholder="Ej. Primer mes gratuito" />
        </div>
      </div>

      {error && (
        <div className="auth-error" role="alert" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}
      {saved && (
        <p style={{ color: "#2e7d32", fontSize: 13, marginBottom: 12 }}>
          ✓ Suscripción creada correctamente.
        </p>
      )}

      <button type="submit" className="button small" disabled={pending}>
        {pending ? "Creando…" : "Crear suscripción"}
      </button>
    </form>
  );
}
