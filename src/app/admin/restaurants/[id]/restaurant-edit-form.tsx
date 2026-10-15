"use client";

import { useState, useTransition } from "react";
import { updateRestaurant } from "../../actions";

const TIMEZONES = [
  "America/Caracas",
  "America/Bogota",
  "America/Lima",
  "America/Santiago",
  "America/Mexico_City",
  "America/New_York",
  "America/Los_Angeles",
  "UTC",
];

export function RestaurantEditForm({
  restaurantId,
  defaultName,
  defaultCurrency,
  defaultTimezone,
}: {
  restaurantId: string;
  defaultName: string;
  defaultCurrency: string;
  defaultTimezone: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateRestaurant(restaurantId, fd);
      if (result.error) {
        setError(result.error);
      } else {
        setSaved(true);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 480 }}>
      <label className="field-label">
        Nombre
        <input
          name="name"
          type="text"
          required
          minLength={2}
          maxLength={100}
          defaultValue={defaultName}
        />
      </label>

      <label className="field-label" style={{ marginTop: 16 }}>
        Moneda
        <select name="currency" defaultValue={defaultCurrency}>
          <option value="USD">USD</option>
          <option value="VES">VES</option>
          <option value="COP">COP</option>
          <option value="MXN">MXN</option>
          <option value="PEN">PEN</option>
        </select>
      </label>

      <label className="field-label" style={{ marginTop: 16 }}>
        Zona horaria
        <select name="timezone" defaultValue={defaultTimezone}>
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>{tz}</option>
          ))}
        </select>
      </label>

      {error && (
        <div className="auth-error" role="alert" style={{ marginTop: 16 }}>
          {error}
        </div>
      )}
      {saved && (
        <p style={{ color: "#2e7d32", fontSize: 13, marginTop: 12 }}>
          Cambios guardados.
        </p>
      )}

      <button type="submit" className="button small" disabled={pending} style={{ marginTop: 20 }}>
        {pending ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>
  );
}
