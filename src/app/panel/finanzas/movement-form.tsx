"use client";

import { useActionState, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { X, ChevronDown, ChevronUp } from "lucide-react";
import { saveMovement, type FinanceState } from "./actions";
import { useUnsavedChanges } from "@/components/unsaved-changes";

// ── Types ─────────────────────────────────────────────────────────

interface MovementFormProps {
  restaurantId: string;
  currency:     string;
  stockEnabled: boolean;
  categories:   string[];
  products?:    { id: string; name: string }[];
  movement?: {
    id:            string;
    type:          "income" | "expense" | "purchase";
    amount_cents:  number;
    concept:       string;
    category:      string | null;
    movement_date: string;
    notes:         string | null;
    reference:     string | null;
    counterpart:   string | null;
    product_id:    string | null;
    units:         number | null;
  };
  onSaved: () => void;
  onClose: () => void;
}

// ── Today's date in YYYY-MM-DD format ────────────────────────────

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ── Type labels and styles ────────────────────────────────────────

const TYPE_OPTIONS = [
  { value: "income",   label: "Ingreso",               desc: "Cobro, venta o entrada de dinero" },
  { value: "expense",  label: "Gasto",                 desc: "Pago, comisión u otro egreso" },
  { value: "purchase", label: "Compra de inventario",  desc: "Adquisición de productos o materias primas" },
] as const;

// ── Component ─────────────────────────────────────────────────────

export function MovementForm({
  stockEnabled,
  categories,
  products = [],
  movement,
  onSaved,
  onClose,
}: MovementFormProps) {
  const router = useRouter();
  const { setDirty } = useUnsavedChanges();

  const initial: FinanceState = { error: null };
  const [state, action, isPending] = useActionState(saveMovement, initial);
  const prevState = useRef<FinanceState>(initial);

  const [type, setType]           = useState<"income" | "expense" | "purchase">(movement?.type ?? "income");
  const [showDetails, setShowDetails] = useState(false);
  const [amountVal, setAmountVal] = useState(
    movement ? String(movement.amount_cents / 100) : ""
  );

  // Close on success
  useEffect(() => {
    if (state === prevState.current) return;
    prevState.current = state;
    if (state.success) {
      setDirty(false);
      router.refresh();
      onSaved();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const typeOptions = stockEnabled
    ? TYPE_OPTIONS
    : TYPE_OPTIONS.filter((t) => t.value !== "purchase");

  return (
    <>
      {/* Backdrop */}
      <div
        className="fin-slideout-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slideout panel */}
      <div
        className="fin-slideout"
        role="dialog"
        aria-modal="true"
        aria-label={movement ? "Editar movimiento" : "Registrar movimiento"}
      >
        {/* Header */}
        <div className="fin-slideout-header">
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#202337" }}>
            {movement ? "Editar movimiento" : "Registrar movimiento"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="fin-details-toggle"
            aria-label="Cerrar"
            style={{ padding: 4 }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="fin-slideout-body">
          <form id="movement-form" action={action} onChange={() => setDirty(true)}>
            {movement?.id && (
              <input type="hidden" name="id" value={movement.id} />
            )}
            <input type="hidden" name="type" value={type} />

            {/* Type selector */}
            <div style={{ marginBottom: 20 }}>
              <div className="fin-type-cards">
                {typeOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`fin-type-card${type === opt.value ? " fin-type-card--active" : ""}`}
                    onClick={() => { setType(opt.value); setDirty(true); }}
                    aria-pressed={type === opt.value}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#202337", marginBottom: 3 }}>
                      {opt.label}
                    </div>
                    <div style={{ fontSize: 11, color: "#667085", lineHeight: 1.4 }}>
                      {opt.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Amount — large input */}
            <div className="field" style={{ marginBottom: 16 }}>
              <label htmlFor="mv-amount">Monto *</label>
              <input
                id="mv-amount"
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                required
                value={amountVal}
                onChange={(e) => setAmountVal(e.target.value)}
                placeholder="0.00"
                style={{ fontSize: 24, fontWeight: 700, height: 52, letterSpacing: "-0.5px" }}
              />
            </div>

            {/* Concept */}
            <div className="field" style={{ marginBottom: 16 }}>
              <label htmlFor="mv-concept">Concepto *</label>
              <input
                id="mv-concept"
                name="concept"
                type="text"
                maxLength={200}
                required
                defaultValue={movement?.concept ?? ""}
                placeholder="Ej: Pago de proveedor / Cobro cliente"
              />
            </div>

            {/* Date */}
            <div className="field" style={{ marginBottom: 16 }}>
              <label htmlFor="mv-date">Fecha *</label>
              <input
                id="mv-date"
                name="movement_date"
                type="date"
                required
                defaultValue={movement?.movement_date ?? todayIso()}
              />
            </div>

            {/* Category */}
            <div className="field" style={{ marginBottom: 16 }}>
              <label htmlFor="mv-category">Categoría</label>
              <input
                id="mv-category"
                name="category"
                type="text"
                maxLength={100}
                defaultValue={movement?.category ?? ""}
                placeholder="Ej: Nómina, Arriendo, Ventas"
                list="mv-category-list"
              />
              {categories.length > 0 && (
                <datalist id="mv-category-list">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              )}
            </div>

            {/* More details toggle */}
            <button
              type="button"
              className="fin-details-toggle"
              onClick={() => setShowDetails((v) => !v)}
            >
              {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {showDetails ? "Ocultar detalles" : "Más detalles"}
            </button>

            {showDetails && (
              <div style={{ marginTop: 12 }}>
                <div className="field" style={{ marginBottom: 12 }}>
                  <label htmlFor="mv-notes">Notas</label>
                  <input
                    id="mv-notes"
                    name="notes"
                    type="text"
                    maxLength={500}
                    defaultValue={movement?.notes ?? ""}
                    placeholder="Notas adicionales"
                  />
                </div>

                <div className="field" style={{ marginBottom: 12 }}>
                  <label htmlFor="mv-reference">Referencia / N° comprobante</label>
                  <input
                    id="mv-reference"
                    name="reference"
                    type="text"
                    maxLength={100}
                    defaultValue={movement?.reference ?? ""}
                    placeholder="Ej: FAC-00123"
                  />
                </div>

                <div className="field" style={{ marginBottom: 12 }}>
                  <label htmlFor="mv-counterpart">Contraparte</label>
                  <input
                    id="mv-counterpart"
                    name="counterpart"
                    type="text"
                    maxLength={200}
                    defaultValue={movement?.counterpart ?? ""}
                    placeholder="Proveedor, cliente o banco"
                  />
                </div>

                {/* Purchase-specific fields */}
                {type === "purchase" && (
                  <>
                    {products.length > 0 && (
                      <div className="field" style={{ marginBottom: 12 }}>
                        <label htmlFor="mv-product">Producto (opcional)</label>
                        <select
                          id="mv-product"
                          name="product_id"
                          defaultValue={movement?.product_id ?? ""}
                        >
                          <option value="">— Sin vincular —</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="field" style={{ marginBottom: 12 }}>
                      <label htmlFor="mv-units">Unidades (opcional)</label>
                      <input
                        id="mv-units"
                        name="units"
                        type="number"
                        min="1"
                        step="1"
                        defaultValue={movement?.units ?? ""}
                        placeholder="Ej: 10"
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="fin-slideout-footer">
          {state.error && (
            <p className="auth-error" style={{ flex: 1, margin: 0 }}>
              {state.error}
            </p>
          )}
          <button
            type="button"
            className="button secondary"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="movement-form"
            className="button"
            disabled={isPending}
          >
            {isPending ? "Guardando…" : movement ? "Guardar cambios" : "Registrar"}
          </button>
        </div>
      </div>
    </>
  );
}
