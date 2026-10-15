"use client";

import { useState, useTransition } from "react";
import { setRestaurantStatus } from "../../actions";

const STATUS_LABEL: Record<string, string> = {
  onboarding: "En configuración",
  active: "Activo",
  suspended: "Suspendido",
};

export function StatusForm({
  restaurantId,
  currentStatus,
}: {
  restaurantId: string;
  currentStatus: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [note, setNote] = useState("");
  const [target, setTarget] = useState<"active" | "suspended" | "onboarding">(
    currentStatus as "active" | "suspended" | "onboarding",
  );

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!note.trim() || note.trim().length < 3) {
      setError("El motivo debe tener al menos 3 caracteres.");
      return;
    }
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await setRestaurantStatus(restaurantId, target, note);
      if (result.error) {
        setError(result.error);
      } else {
        setSaved(true);
        setNote("");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 480 }}>
      <p style={{ fontSize: 13, marginBottom: 14 }}>
        Estado actual:{" "}
        <strong>{STATUS_LABEL[currentStatus] ?? currentStatus}</strong>
      </p>

      <label className="field-label">
        Nuevo estado
        <select
          value={target}
          onChange={(e) => setTarget(e.target.value as typeof target)}
        >
          <option value="onboarding">En configuración</option>
          <option value="active">Activo</option>
          <option value="suspended">Suspendido</option>
        </select>
      </label>

      <label className="field-label" style={{ marginTop: 16 }}>
        Motivo (obligatorio)
        <input
          type="text"
          required
          minLength={3}
          maxLength={200}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ej. Reactivación tras pago recibido"
        />
      </label>

      {error && (
        <div className="auth-error" role="alert" style={{ marginTop: 12 }}>
          {error}
        </div>
      )}
      {saved && (
        <p style={{ color: "#2e7d32", fontSize: 13, marginTop: 12 }}>
          Estado actualizado.
        </p>
      )}

      <button
        type="submit"
        className="button small"
        disabled={pending || target === currentStatus}
        style={{ marginTop: 20 }}
      >
        {pending ? "Aplicando…" : "Aplicar cambio"}
      </button>
    </form>
  );
}
