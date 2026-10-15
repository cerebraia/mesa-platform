"use client";

import { useState, useTransition } from "react";
import { saveHours, type HourInput } from "./actions";

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

interface Props {
  hours: { id: string; day_of_week: number; opens_at: string; closes_at: string; is_active: boolean }[];
}

function toTimeStr(t: string): string {
  // Postgres returns "HH:MM:SS" — truncate to "HH:MM"
  return t.slice(0, 5);
}

type Row = { day_of_week: number; opens_at: string; closes_at: string; is_active: boolean };

export function HoursEditor({ hours }: Props) {
  const [rows, setRows] = useState<Row[]>(
    hours.length > 0
      ? hours.map((h) => ({
          day_of_week: h.day_of_week,
          opens_at: toTimeStr(h.opens_at),
          closes_at: toTimeStr(h.closes_at),
          is_active: h.is_active,
        }))
      : [],
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function addRow() {
    setRows((r) => [...r, { day_of_week: 1, opens_at: "09:00", closes_at: "21:00", is_active: true }]);
  }

  function updateRow(i: number, field: keyof Row, val: string | number | boolean) {
    setRows((r) => r.map((row, idx) => idx === i ? { ...row, [field]: val } : row));
  }

  function removeRow(i: number) {
    setRows((r) => r.filter((_, idx) => idx !== i));
  }

  function handleSave() {
    if (isPending) return;
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await saveHours(rows as HourInput[]);
      if (result.error) setError(result.error);
      else setSuccess(true);
    });
  }

  return (
    <div>
      {rows.length === 0 && (
        <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
          Sin horarios configurados. El restaurante aparecerá como cerrado.
        </p>
      )}

      {rows.map((row, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "120px 90px 90px auto auto", gap: 8, marginBottom: 8, alignItems: "center" }}>
          <select
            value={row.day_of_week}
            onChange={(e) => updateRow(i, "day_of_week", parseInt(e.target.value))}
            style={{ fontSize: 13 }}
          >
            {DAYS.map((d, di) => <option key={di} value={di}>{d}</option>)}
          </select>
          <input
            type="time"
            value={row.opens_at}
            onChange={(e) => updateRow(i, "opens_at", e.target.value)}
            style={{ fontSize: 13 }}
          />
          <input
            type="time"
            value={row.closes_at}
            onChange={(e) => updateRow(i, "closes_at", e.target.value)}
            style={{ fontSize: 13 }}
          />
          <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, whiteSpace: "nowrap" }}>
            <input
              type="checkbox"
              checked={row.is_active}
              onChange={(e) => updateRow(i, "is_active", e.target.checked)}
              style={{ accentColor: "var(--purple)" }}
            />
            Activo
          </label>
          <button
            type="button"
            onClick={() => removeRow(i)}
            style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 16, cursor: "pointer", padding: "4px 6px" }}
          >
            ✕
          </button>
        </div>
      ))}

      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <button type="button" className="button secondary small" onClick={addRow} style={{ fontSize: 12 }}>
          + Agregar intervalo
        </button>
        <button type="button" className="button small" onClick={handleSave} disabled={isPending}>
          {isPending ? "Guardando…" : "Guardar horarios"}
        </button>
      </div>

      {error && <p className="auth-error" style={{ marginTop: 8 }}>{error}</p>}
      {success && <p style={{ color: "#2e7d32", fontSize: 12, marginTop: 8 }}>Horarios guardados.</p>}

      <p className="muted" style={{ fontSize: 11, marginTop: 12 }}>
        Cruce de medianoche: si el cierre (ej. 02:00) es anterior a la apertura (ej. 22:00),
        el intervalo se interpreta como de la noche al día siguiente.
      </p>
    </div>
  );
}
