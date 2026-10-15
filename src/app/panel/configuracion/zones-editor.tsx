"use client";

import { useState, useTransition } from "react";
import { saveDeliveryZone, setZoneActive } from "./actions";
import type { DeliveryZone } from "@/lib/catalog-types";

const EMPTY = { name: "", fee_cents: 0, minimum_order_cents: 0, position: 0 };

export function ZonesEditor({ zones }: { zones: DeliveryZone[] }) {
  const [list, setList] = useState(zones);
  const [editing, setEditing] = useState<string | null>(null); // id or "new"
  const [form, setForm] = useState({ ...EMPTY });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function startNew() {
    setForm({ ...EMPTY, position: list.length });
    setEditing("new");
    setError(null);
  }

  function startEdit(z: DeliveryZone) {
    setForm({ name: z.name, fee_cents: z.fee_cents, minimum_order_cents: z.minimum_order_cents, position: z.position });
    setEditing(z.id);
    setError(null);
  }

  function handleSave() {
    if (isPending) return;
    setError(null);
    startTransition(async () => {
      const result = await saveDeliveryZone({
        id: editing === "new" ? undefined : editing ?? undefined,
        ...form,
      });
      if (result.error) { setError(result.error); return; }
      setEditing(null);
      window.location.reload();
    });
  }

  function handleToggle(z: DeliveryZone) {
    if (isPending) return;
    if (!confirm(`¿${z.is_active ? "Desactivar" : "Activar"} la zona "${z.name}"?`)) return;
    startTransition(async () => {
      const result = await setZoneActive(z.id, !z.is_active);
      if (result.error) setError(result.error);
      else window.location.reload();
    });
  }

  return (
    <div>
      {list.length === 0 && !editing && (
        <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>Sin zonas de delivery.</p>
      )}

      <div className="table-scroll">
        <table style={{ fontSize: 13 }}>
          {list.length > 0 && (
            <thead>
              <tr>
                <th>Zona</th>
                <th>Tarifa</th>
                <th>Mínimo</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
          )}
          <tbody>
            {list.map((z) => (
              <tr key={z.id} style={{ opacity: z.is_active ? 1 : 0.5 }}>
                <td>{z.name}</td>
                <td>${(z.fee_cents / 100).toFixed(2)}</td>
                <td>${(z.minimum_order_cents / 100).toFixed(2)}</td>
                <td><span className="tag">{z.is_active ? "Activa" : "Inactiva"}</span></td>
                <td>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button type="button" className="button secondary small" style={{ fontSize: 11 }} onClick={() => startEdit(z)}>Editar</button>
                    <button type="button" className="button secondary small" style={{ fontSize: 11 }} onClick={() => handleToggle(z)} disabled={isPending}>
                      {z.is_active ? "Desactivar" : "Activar"}
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
          <h3 style={{ fontSize: 14, marginBottom: 16 }}>{editing === "new" ? "Nueva zona" : "Editar zona"}</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 12, alignItems: "end" }}>
            <div className="field" style={{ margin: 0 }}>
              <label>Nombre</label>
              <input type="text" maxLength={100} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ej: Centro" />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label>Tarifa ($)</label>
              <input type="number" min="0" step="0.01" style={{ width: 90 }} value={form.fee_cents ? form.fee_cents / 100 : ""} onChange={(e) => setForm((f) => ({ ...f, fee_cents: Math.round(parseFloat(e.target.value || "0") * 100) }))} placeholder="2.00" />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label>Mínimo ($)</label>
              <input type="number" min="0" step="0.01" style={{ width: 90 }} value={form.minimum_order_cents ? form.minimum_order_cents / 100 : ""} onChange={(e) => setForm((f) => ({ ...f, minimum_order_cents: Math.round(parseFloat(e.target.value || "0") * 100) }))} placeholder="0.00" />
            </div>
          </div>
          {error && <p className="auth-error" style={{ marginTop: 8 }}>{error}</p>}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button type="button" className="button small" onClick={handleSave} disabled={isPending}>{isPending ? "Guardando…" : "Guardar"}</button>
            <button type="button" className="button secondary small" onClick={() => { setEditing(null); setError(null); }}>Cancelar</button>
          </div>
        </div>
      )}

      {!editing && (
        <button type="button" className="button secondary small" style={{ marginTop: 12, fontSize: 12 }} onClick={startNew}>+ Agregar zona</button>
      )}
    </div>
  );
}
