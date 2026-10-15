"use client";

import { useState, useTransition } from "react";
import { setSubscriptionStatus, recordPayment } from "../../actions";

type Sub = {
  id: string;
  status: string;
  starts_at: string;
  ends_at: string | null;
  notes: string | null;
  plans: { name: string; price_cents: number; currency: string } | null;
};

type Payment = {
  id: string;
  amount_cents: number;
  currency: string;
  paid_at: string;
  reference: string | null;
  notes: string | null;
};

const SUB_STATUS_COLOR: Record<string, string> = {
  active:    "#2e7d32",
  expired:   "#c62828",
  cancelled: "#777",
};

export function SubscriptionRow({
  sub,
  restaurantId,
  payments,
}: {
  sub: Sub;
  restaurantId: string;
  payments: Payment[];
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const isActive = sub.status === "active" && (!sub.ends_at || new Date(sub.ends_at) > new Date());

  function handleStatusChange(newStatus: "active" | "expired" | "cancelled", note: string) {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await setSubscriptionStatus(sub.id, restaurantId, newStatus, note);
      if (result.error) {
        setError(result.error);
      } else {
        setSaved(true);
      }
    });
  }

  return (
    <>
      <tr>
        <td>
          <span style={{ fontWeight: 600, fontSize: 13 }}>
            {sub.plans?.name ?? "—"}
          </span>
          {sub.notes && (
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
              {sub.notes}
            </div>
          )}
        </td>
        <td>
          <span
            className="tag"
            style={{
              color: SUB_STATUS_COLOR[sub.status] ?? "#777",
              background: `${SUB_STATUS_COLOR[sub.status] ?? "#777"}18`,
            }}
          >
            {sub.status}
          </span>
        </td>
        <td style={{ fontSize: 12 }}>
          {new Date(sub.starts_at).toLocaleDateString("es-VE")}
        </td>
        <td style={{ fontSize: 12 }}>
          {sub.ends_at
            ? new Date(sub.ends_at).toLocaleDateString("es-VE")
            : <span className="muted">Indefinida</span>}
        </td>
        <td style={{ fontSize: 12 }}>
          {payments.length > 0 ? (
            <span style={{ color: "var(--ink)" }}>
              {payments.length} pago{payments.length !== 1 ? "s" : ""}
            </span>
          ) : (
            <span className="muted">—</span>
          )}
        </td>
        <td>
          <button
            className="button secondary small"
            style={{ fontSize: 11 }}
            onClick={() => setShowDetails((v) => !v)}
          >
            {showDetails ? "Cerrar" : "Gestionar"}
          </button>
        </td>
      </tr>

      {showDetails && (
        <tr>
          <td colSpan={6} style={{ background: "var(--bg)", padding: "16px 20px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28, flexWrap: "wrap" }}>

              {/* Change subscription status */}
              <SubStatusSection
                subId={sub.id}
                currentStatus={sub.status}
                restaurantId={restaurantId}
                onSaved={() => setSaved(true)}
              />

              {/* Record payment */}
              <RecordPaymentSection
                subId={sub.id}
                restaurantId={restaurantId}
                defaultCurrency={sub.plans?.currency ?? "USD"}
              />
            </div>

            {error && (
              <p style={{ color: "#a72b38", fontSize: 12, marginTop: 12 }}>{error}</p>
            )}

            {/* Payment history */}
            {payments.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 10 }}>
                  Historial de pagos
                </p>
                <table style={{ width: "100%", fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Importe</th>
                      <th>Referencia</th>
                      <th>Notas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id}>
                        <td>{new Date(p.paid_at).toLocaleDateString("es-VE")}</td>
                        <td>{p.currency} {(p.amount_cents / 100).toFixed(2)}</td>
                        <td>{p.reference ?? "—"}</td>
                        <td>{p.notes ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function SubStatusSection({
  subId,
  currentStatus,
  restaurantId,
  onSaved,
}: {
  subId: string;
  currentStatus: string;
  restaurantId: string;
  onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [newStatus, setNewStatus] = useState<"active" | "expired" | "cancelled">(
    currentStatus as "active" | "expired" | "cancelled",
  );
  const [note, setNote] = useState("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await setSubscriptionStatus(subId, restaurantId, newStatus, note);
      if (result.error) {
        setError(result.error);
      } else {
        setSaved(true);
        onSaved();
        setNote("");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <p style={{ fontWeight: 600, fontSize: 12, marginBottom: 10 }}>Cambiar estado</p>
      <label className="field-label">
        Estado
        <select value={newStatus} onChange={(e) => setNewStatus(e.target.value as typeof newStatus)}>
          <option value="active">Activo</option>
          <option value="expired">Vencido</option>
          <option value="cancelled">Cancelado</option>
        </select>
      </label>
      <label className="field-label" style={{ marginTop: 12 }}>
        Motivo
        <input
          type="text"
          required
          minLength={3}
          maxLength={200}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Motivo del cambio"
        />
      </label>
      {error && <p style={{ color: "#a72b38", fontSize: 12, marginTop: 8 }}>{error}</p>}
      {saved && <p style={{ color: "#2e7d32", fontSize: 12, marginTop: 8 }}>Guardado.</p>}
      <button
        type="submit"
        className="button small"
        disabled={pending || newStatus === currentStatus}
        style={{ marginTop: 14 }}
      >
        {pending ? "Aplicando…" : "Aplicar"}
      </button>
    </form>
  );
}

function RecordPaymentSection({
  subId,
  restaurantId,
  defaultCurrency,
}: {
  subId: string;
  restaurantId: string;
  defaultCurrency: string;
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
      const result = await recordPayment(subId, restaurantId, fd);
      if (result.error) {
        setError(result.error);
      } else {
        setSaved(true);
        (e.target as HTMLFormElement).reset();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <p style={{ fontWeight: 600, fontSize: 12, marginBottom: 10 }}>Registrar pago</p>
      <label className="field-label">
        Importe (en unidades, ej. 10.00)
        <input name="amount" type="number" required min="0.01" step="0.01" />
      </label>
      <label className="field-label" style={{ marginTop: 10 }}>
        Moneda
        <select name="currency" defaultValue={defaultCurrency}>
          <option value="USD">USD</option>
          <option value="VES">VES</option>
          <option value="COP">COP</option>
        </select>
      </label>
      <label className="field-label" style={{ marginTop: 10 }}>
        Fecha de pago
        <input name="paid_at" type="date" required />
      </label>
      <label className="field-label" style={{ marginTop: 10 }}>
        Referencia (opcional)
        <input name="reference" type="text" maxLength={200} placeholder="Ej. TRF-2026-001" />
      </label>
      <label className="field-label" style={{ marginTop: 10 }}>
        Notas (opcional)
        <input name="notes" type="text" maxLength={500} />
      </label>
      {error && <p style={{ color: "#a72b38", fontSize: 12, marginTop: 8 }}>{error}</p>}
      {saved && <p style={{ color: "#2e7d32", fontSize: 12, marginTop: 8 }}>Pago registrado.</p>}
      <button type="submit" className="button small" disabled={pending} style={{ marginTop: 14 }}>
        {pending ? "Registrando…" : "Registrar pago"}
      </button>
    </form>
  );
}
