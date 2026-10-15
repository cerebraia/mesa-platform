"use client";

import { useState, useTransition } from "react";
import { savePaymentMethod, setPaymentActive } from "./actions";
import type { PaymentMethod, PaymentType } from "@/lib/catalog-types";

const PAYMENT_TYPES: { value: PaymentType; label: string }[] = [
  { value: "cash", label: "Efectivo" },
  { value: "transfer", label: "Transferencia bancaria" },
  { value: "mobile_payment", label: "Pago móvil" },
  { value: "card", label: "Tarjeta" },
  { value: "other", label: "Otro" },
];

const TYPE_LABEL: Record<PaymentType, string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
  mobile_payment: "Pago móvil",
  card: "Tarjeta",
  other: "Otro",
};

const EMPTY = { name: "", type: "cash" as PaymentType, instructions: "" };

export function PaymentsEditor({ payments }: { payments: PaymentMethod[] }) {
  const [list, setList] = useState(payments);
  const [editing, setEditing] = useState<string | null>(null); // id or "new"
  const [form, setForm] = useState({ ...EMPTY });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function startNew() {
    setForm({ ...EMPTY });
    setEditing("new");
    setError(null);
  }

  function startEdit(p: PaymentMethod) {
    setForm({ name: p.name, type: p.type, instructions: p.instructions ?? "" });
    setEditing(p.id);
    setError(null);
  }

  function handleSave() {
    if (isPending) return;
    setError(null);
    startTransition(async () => {
      const result = await savePaymentMethod({
        id: editing === "new" ? undefined : editing ?? undefined,
        name: form.name,
        type: form.type,
        instructions: form.instructions,
        position: editing === "new" ? list.length : (list.find((p) => p.id === editing)?.position ?? 0),
      });
      if (result.error) { setError(result.error); return; }
      setEditing(null);
      window.location.reload();
    });
  }

  function handleToggle(p: PaymentMethod) {
    if (isPending) return;
    if (!confirm(`¿${p.is_active ? "Desactivar" : "Activar"} "${p.name}"?`)) return;
    startTransition(async () => {
      const result = await setPaymentActive(p.id, !p.is_active);
      if (result.error) setError(result.error);
      else window.location.reload();
    });
  }

  return (
    <div>
      {list.length === 0 && !editing && (
        <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
          Sin medios de pago configurados.
        </p>
      )}

      <div className="table-scroll">
        <table style={{ fontSize: 13 }}>
          {list.length > 0 && (
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
          )}
          <tbody>
            {list.map((p) => (
              <tr key={p.id} style={{ opacity: p.is_active ? 1 : 0.5 }}>
                <td>{p.name}</td>
                <td>{TYPE_LABEL[p.type]}</td>
                <td><span className="tag">{p.is_active ? "Activo" : "Inactivo"}</span></td>
                <td>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button type="button" className="button secondary small" style={{ fontSize: 11 }} onClick={() => startEdit(p)}>
                      Editar
                    </button>
                    <button type="button" className="button secondary small" style={{ fontSize: 11 }} onClick={() => handleToggle(p)} disabled={isPending}>
                      {p.is_active ? "Desactivar" : "Activar"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 16, marginTop: 16 }}>
          <h3 style={{ fontSize: 14, marginBottom: 16 }}>{editing === "new" ? "Nuevo medio de pago" : "Editar medio de pago"}</h3>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div className="field" style={{ margin: 0 }}>
              <label>Nombre *</label>
              <input
                type="text"
                maxLength={100}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ej: Transferencia Banco Mercantil"
              />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label>Tipo</label>
              <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as PaymentType }))}>
                {PAYMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="field" style={{ margin: "0 0 12px" }}>
            <label>
              Instrucciones para el comprador
              <span className="muted" style={{ fontSize: 11, marginLeft: 8, fontWeight: 400 }}>Privadas — visibles solo en el checkout</span>
            </label>
            <textarea
              maxLength={1000}
              rows={3}
              value={form.instructions}
              onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))}
              placeholder="Ej: Banco Mercantil, cuenta corriente 0105-1234-56-1234567890, a nombre de Restaurante S.A."
              style={{ width: "100%", resize: "vertical", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px", fontSize: 13, fontFamily: "inherit", color: "var(--ink)", background: "white" }}
            />
          </div>

          <p className="muted" style={{ fontSize: 11, marginBottom: 12 }}>
            No incluyas contraseñas bancarias ni credenciales financieras en las instrucciones.
          </p>

          {error && <p className="auth-error" style={{ marginTop: 8 }}>{error}</p>}

          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="button small" onClick={handleSave} disabled={isPending}>
              {isPending ? "Guardando…" : "Guardar"}
            </button>
            <button type="button" className="button secondary small" onClick={() => { setEditing(null); setError(null); }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {!editing && (
        <button type="button" className="button secondary small" style={{ marginTop: 12, fontSize: 12 }} onClick={startNew}>
          + Agregar medio de pago
        </button>
      )}
    </div>
  );
}
