"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { adminSaveMovement, adminDeleteMovement } from "../actions";

type Movement = {
  id: string; type: string; concept: string; amount_cents: number;
  movement_date: string; category: string | null;
  notes: string | null; reference: string | null; created_at: string;
};

interface Props {
  restaurantId: string;
  movements:    Movement[];
  total:        number;
  currency:     string;
  page:         number;
  typeFilter:   string;
  dateFrom:     string;
  dateTo:       string;
}

const TYPE_LABEL: Record<string, string> = {
  income:   "Ingreso",
  expense:  "Gasto",
  purchase: "Compra",
};
const TYPE_COLOR: Record<string, string> = {
  income:   "#166534",
  expense:  "#991B1B",
  purchase: "#1e3a5f",
};

function formatCents(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat("es", {
      style: "currency", currency,
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(cents / 100);
  } catch { return `$${(cents / 100).toFixed(2)}`; }
}

function MovementForm({
  restaurantId, existing, onDone,
}: {
  restaurantId: string;
  existing?: Movement;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (existing) fd.set("id", existing.id);
    setError(null);
    startTransition(async () => {
      const res = await adminSaveMovement(restaurantId, fd);
      if (res.error) setError(res.error);
      else { onDone(); router.refresh(); }
    });
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div className="field">
          <label style={{ fontSize: 12 }}>Tipo</label>
          <select name="type" defaultValue={existing?.type ?? "income"}>
            <option value="income">Ingreso</option>
            <option value="expense">Gasto</option>
            <option value="purchase">Compra</option>
          </select>
        </div>
        <div className="field">
          <label style={{ fontSize: 12 }}>Fecha</label>
          <input name="movement_date" type="date"
            defaultValue={existing?.movement_date ?? new Date().toISOString().slice(0, 10)} required />
        </div>
      </div>
      <div className="field">
        <label style={{ fontSize: 12 }}>Concepto</label>
        <input name="concept" type="text" required defaultValue={existing?.concept ?? ""} maxLength={200} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div className="field">
          <label style={{ fontSize: 12 }}>Monto</label>
          <input name="amount" type="number" step="0.01" min="0.01" required
            defaultValue={existing ? (existing.amount_cents / 100).toFixed(2) : ""} />
        </div>
        <div className="field">
          <label style={{ fontSize: 12 }}>Categoría</label>
          <input name="category" type="text" defaultValue={existing?.category ?? ""} />
        </div>
      </div>
      <div className="field">
        <label style={{ fontSize: 12 }}>Referencia</label>
        <input name="reference" type="text" defaultValue={existing?.reference ?? ""} />
      </div>
      {error && <div className="auth-error" role="alert">{error}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" className="button small" disabled={pending}>
          {pending ? "Guardando…" : existing ? "Actualizar" : "Crear"}
        </button>
        <button type="button" onClick={onDone} className="button secondary small">Cancelar</button>
      </div>
    </form>
  );
}

export function FinanzasAdminClient({
  restaurantId, movements, total, currency, page, typeFilter, dateFrom, dateTo,
}: Props) {
  const [showForm, setShowForm]         = useState(false);
  const [editMovement, setEditMovement] = useState<Movement | null>(null);
  const [pending, startTransition]      = useTransition();
  const [error, setError]               = useState<string | null>(null);
  const router = useRouter();

  function del(id: string) {
    if (!confirm("¿Eliminar este movimiento?")) return;
    setError(null);
    startTransition(async () => {
      const res = await adminDeleteMovement(restaurantId, id);
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  function buildUrl(params: Record<string, string | null>) {
    const ps = new URLSearchParams();
    const merged = { tipo: typeFilter, desde: dateFrom, hasta: dateTo, pagina: String(page), ...params };
    for (const [k, v] of Object.entries(merged)) { if (v) ps.set(k, v); }
    return `?${ps}`;
  }

  return (
    <>
      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <Link href={buildUrl({ tipo: null })}
          className={`button secondary small${!typeFilter ? " button--active" : ""}`}
          style={{ fontSize: 12 }}>Todos</Link>
        {["income", "expense", "purchase"].map((t) => (
          <Link key={t} href={buildUrl({ tipo: t, pagina: "1" })}
            className={`button secondary small${typeFilter === t ? " button--active" : ""}`}
            style={{ fontSize: 12 }}>{TYPE_LABEL[t]}</Link>
        ))}
        <form style={{ display: "flex", gap: 6, alignItems: "center", marginLeft: "auto" }}>
          <input name="desde" type="date" defaultValue={dateFrom} style={{ fontSize: 12, padding: "4px 8px" }} />
          <span style={{ fontSize: 12, color: "#667085" }}>al</span>
          <input name="hasta" type="date" defaultValue={dateTo} style={{ fontSize: 12, padding: "4px 8px" }} />
          <input type="hidden" name="tipo" value={typeFilter} />
          <button type="submit" className="button secondary small" style={{ fontSize: 12 }}>Filtrar</button>
        </form>
        <button
          onClick={() => { setShowForm(true); setEditMovement(null); }}
          className="button small" style={{ fontSize: 12 }}
        >
          <Plus size={13} />
          Nuevo
        </button>
      </div>

      {error && <div className="auth-error" role="alert" style={{ marginBottom: 12 }}>{error}</div>}

      {(showForm && !editMovement) && (
        <div className="dashboard-card" style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Nuevo movimiento</h3>
          <MovementForm restaurantId={restaurantId} onDone={() => setShowForm(false)} />
        </div>
      )}

      {editMovement && (
        <div className="dashboard-card" style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Editar movimiento</h3>
          <MovementForm restaurantId={restaurantId} existing={editMovement}
            onDone={() => setEditMovement(null)} />
        </div>
      )}

      {movements.length === 0 ? (
        <div className="panel-empty">
          <p className="panel-empty-title">Sin movimientos</p>
        </div>
      ) : (
        <div className="dashboard-card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Concepto</th>
                  <th>Categoría</th>
                  <th>Monto</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id}>
                    <td style={{ fontSize: 12, color: "#667085" }}>
                      {new Date(m.movement_date + "T00:00:00").toLocaleDateString("es-VE", {
                        day: "2-digit", month: "short",
                      })}
                    </td>
                    <td>
                      <span style={{ fontSize: 11, fontWeight: 600, color: TYPE_COLOR[m.type] ?? "#667085" }}>
                        {TYPE_LABEL[m.type] ?? m.type}
                      </span>
                    </td>
                    <td style={{ fontSize: 13 }}>{m.concept}</td>
                    <td style={{ fontSize: 12, color: "#667085" }}>{m.category ?? "—"}</td>
                    <td style={{ fontSize: 13, fontWeight: 600, color: TYPE_COLOR[m.type] }}>
                      {m.type === "income" ? "+" : "–"} {formatCents(m.amount_cents, currency)}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={() => setEditMovement(m)}
                          className="button secondary small" style={{ fontSize: 11 }}>
                          Editar
                        </button>
                        <button disabled={pending}
                          onClick={() => del(m.id)}
                          className="button secondary small"
                          style={{ fontSize: 11, color: "#DC2626" }}>
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {(total > 30) && (
        <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
          {page > 1 && (
            <Link href={buildUrl({ pagina: String(page - 1) })} className="button secondary small">← Anterior</Link>
          )}
          <span style={{ fontSize: 12, color: "#667085" }}>Página {page} · {total} total</span>
          {movements.length === 30 && (
            <Link href={buildUrl({ pagina: String(page + 1) })} className="button secondary small">Siguiente →</Link>
          )}
        </div>
      )}
    </>
  );
}
