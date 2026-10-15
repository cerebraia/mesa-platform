"use client";

import { useState, useTransition } from "react";
import { assignOwner } from "../../actions";

export function AssignOwnerForm({ restaurantId }: { restaurantId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    method?: string;
    email?: string;
    invitePending?: boolean;
    note?: string;
  } | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    setError(null);
    setResult(null);
    startTransition(async () => {
      const res = await assignOwner(restaurantId, email);
      if (res.error) {
        setError(res.error);
      } else {
        setResult({
          method: (res.data as Record<string, string> | undefined)?.method,
          email: (res.data as Record<string, string> | undefined)?.email ?? email,
          invitePending: res.invitePending,
          note: res.inviteNote,
        });
        (e.target as HTMLFormElement).reset();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 480 }}>
      <label className="field-label">
        Correo del dueño
        <input
          name="email"
          type="email"
          required
          placeholder="owner@ejemplo.com"
          autoComplete="off"
        />
      </label>
      <span className="caption" style={{ marginTop: 4, display: "block" }}>
        Si ya tiene cuenta se reutiliza. Para cuentas nuevas se envía invitación oficial de
        Supabase Auth. Esta operación nunca concede platform_admin.
      </span>

      {error && (
        <div className="auth-error" role="alert" style={{ marginTop: 12 }}>
          {error}
        </div>
      )}

      {result && !result.invitePending && (
        <p style={{ color: "#2e7d32", fontSize: 13, marginTop: 12 }}>
          {result.method === "existing_user"
            ? `Dueño asignado: ${result.email} (cuenta existente).`
            : `Invitación enviada a ${result.email}.`}
        </p>
      )}

      {result?.invitePending && (
        <div
          role="alert"
          style={{
            marginTop: 12, padding: "10px 14px",
            background: "#fff8e1", border: "1px solid #ffe082",
            borderRadius: 8, fontSize: 12,
          }}
        >
          <strong>Invitación pendiente:</strong> {result.note}
        </div>
      )}

      <button type="submit" className="button small" disabled={pending} style={{ marginTop: 16 }}>
        {pending ? "Asignando…" : "Asignar dueño"}
      </button>
    </form>
  );
}
