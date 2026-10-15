"use client";

import { useState, useTransition } from "react";
import { createSubscription } from "../../actions";

type Plan = { id: string; name: string; price_cents: number; currency: string; is_test: boolean };

export function NewSubscriptionForm({
  restaurantId,
  plans,
}: {
  restaurantId: string;
  plans: Plan[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
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
        No hay planes activos. Crea uno en{" "}
        <a href="/admin/planes" style={{ color: "var(--purple)" }}>Planes</a>.
      </p>
    );
  }

  const plan = plans.find((p) => p.id === selectedPlan);

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 480 }}>
      <label className="field-label">
        Plan
        <select
          name="plan_id"
          value={selectedPlan}
          onChange={(e) => setSelectedPlan(e.target.value)}
        >
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.is_test ? " [TEST]" : ""}
              {" — "}
              {p.currency} {(p.price_cents / 100).toFixed(2)}
            </option>
          ))}
        </select>
      </label>

      {plan?.is_test && (
        <p style={{ fontSize: 12, color: "#e65100", marginTop: 6 }}>
          Plan de prueba — solo para desarrollo.
        </p>
      )}

      <label className="field-label" style={{ marginTop: 16 }}>
        Fecha de vencimiento (opcional — dejar vacío para vigencia indefinida)
        <input name="ends_at" type="date" />
      </label>

      <label className="field-label" style={{ marginTop: 16 }}>
        Notas (opcional)
        <input name="notes" type="text" maxLength={500} placeholder="Ej. Primer mes gratuito" />
      </label>

      {error && (
        <div className="auth-error" role="alert" style={{ marginTop: 12 }}>
          {error}
        </div>
      )}
      {saved && (
        <p style={{ color: "#2e7d32", fontSize: 13, marginTop: 12 }}>
          Suscripción creada.
        </p>
      )}

      <button type="submit" className="button small" disabled={pending} style={{ marginTop: 20 }}>
        {pending ? "Creando…" : "Crear suscripción"}
      </button>
    </form>
  );
}
