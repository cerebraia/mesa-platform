"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPlan } from "../actions";

export function NewPlanForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await createPlan(fd);
      if (result.error) {
        setError(result.error);
      } else {
        setSaved(true);
        (e.target as HTMLFormElement).reset();
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 520 }}>
      <label className="field-label">
        Nombre del plan
        <input name="name" type="text" required minLength={2} maxLength={100}
          placeholder="Ej. Básico" />
      </label>

      <label className="field-label" style={{ marginTop: 16 }}>
        Descripción (opcional)
        <input name="description" type="text" maxLength={500}
          placeholder="Descripción breve del plan" />
      </label>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        <label className="field-label">
          Precio (en unidades)
          <input name="price_cents" type="number" required min="0" step="0.01"
            placeholder="0.00" />
        </label>

        <label className="field-label">
          Moneda
          <select name="currency" defaultValue="USD">
            <option value="USD">USD</option>
            <option value="VES">VES</option>
            <option value="COP">COP</option>
          </select>
        </label>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        <label className="field-label">
          Máx. productos (vacío = ilimitado)
          <input name="max_products" type="number" min="1" step="1" />
        </label>

        <label className="field-label">
          Máx. miembros (vacío = ilimitado)
          <input name="max_members" type="number" min="1" step="1" />
        </label>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 20 }}>
        <input
          id="is_test"
          name="is_test"
          type="checkbox"
          value="true"
          style={{ width: 16, height: 16, accentColor: "var(--purple)" }}
        />
        <label htmlFor="is_test" style={{ fontSize: 13, cursor: "pointer" }}>
          Plan de prueba (no se muestra públicamente, solo para desarrollo)
        </label>
      </div>

      {error && (
        <div className="auth-error" role="alert" style={{ marginTop: 16 }}>
          {error}
        </div>
      )}
      {saved && (
        <p style={{ color: "#2e7d32", fontSize: 13, marginTop: 12 }}>
          Plan creado correctamente.
        </p>
      )}

      <button type="submit" className="button" disabled={pending} style={{ marginTop: 24 }}>
        {pending ? "Creando…" : "Crear plan"}
      </button>
    </form>
  );
}
