"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { advanceOrderStatus, confirmOrderPayment } from "./actions";

const STATUS_LABEL: Record<string, string> = {
  received:   "Recibido",
  accepted:   "Aceptado",
  preparing:  "En preparación",
  ready:      "Listo",
  on_the_way: "En camino",
  completed:  "Completado",
  rejected:   "Rechazado",
  cancelled:  "Cancelado",
};

const STATUS_COLOR: Record<string, string> = {
  received:   "#703BE6",
  accepted:   "#1976d2",
  preparing:  "#e65100",
  ready:      "#2e7d32",
  on_the_way: "#1565c0",
  completed:  "#388e3c",
  rejected:   "#c62828",
  cancelled:  "#757575",
};

function nextActions(
  status: string,
  modality: string,
  role: "owner" | "attention" | "kitchen",
): string[] {
  const isStaff = role !== "kitchen";
  switch (status) {
    case "received":   return isStaff ? ["accepted", "rejected"] : [];
    case "accepted":   return ["preparing"];
    case "preparing":  return ["ready"];
    case "ready":
      if (!isStaff) return [];
      return modality === "delivery" ? ["on_the_way"] : ["completed"];
    case "on_the_way": return isStaff ? ["completed"] : [];
    default: return [];
  }
}

const ACTION_LABEL: Record<string, string> = {
  accepted:   "Aceptar pedido",
  preparing:  "Iniciar preparación",
  ready:      "Marcar listo",
  on_the_way: "Marcar en camino",
  completed:  "Marcar completado",
  rejected:   "Rechazar",
  cancelled:  "Cancelar pedido",
};

export function OrderDetailClient({
  orderId,
  restaurantId,
  status,
  paymentStatus,
  modality,
  role,
}: {
  orderId: string;
  restaurantId: string;
  status: string;
  paymentStatus?: string;
  modality: string;
  role: "owner" | "attention" | "kitchen";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [conflictStatus, setConflictStatus] = useState<string | null>(null);
  const [noteModal, setNoteModal] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [showPaymentRevert, setShowPaymentRevert] = useState(false);

  const isTerminal = ["completed", "rejected", "cancelled"].includes(status);
  const actions = nextActions(status, modality, role);

  function doAdvance(newStatus: string, withNote?: string) {
    setError(null);
    setConflictStatus(null);
    startTransition(async () => {
      // Pass the status shown in the UI as the expected status.
      // If another operator changed it, the RPC returns a conflict.
      const result = await advanceOrderStatus(orderId, newStatus, withNote, status);
      if (result.conflict) {
        setConflictStatus(result.currentStatus ?? null);
        setError(result.error);
        return;
      }
      if (result.error) { setError(result.error); return; }
      setNoteModal(null);
      setNote("");
      router.refresh();
    });
  }

  function handleActionClick(newStatus: string) {
    const needsNote = newStatus === "rejected" || newStatus === "cancelled";
    if (needsNote) { setNoteModal(newStatus); setNote(""); return; }
    doAdvance(newStatus);
  }

  function handleConfirmNote() {
    if (!noteModal) return;
    if (note.trim().length < 3) { setError("El motivo debe tener al menos 3 caracteres."); return; }
    doAdvance(noteModal, note.trim());
  }

  function handleConfirmPayment(confirmed: boolean) {
    if (!confirmed && paymentStatus === "confirmed" && paymentNote.trim().length < 3) {
      setError("Corregir el pago requiere un motivo de al menos 3 caracteres.");
      return;
    }
    setError(null);
    setConflictStatus(null);
    startTransition(async () => {
      const result = await confirmOrderPayment(
        orderId,
        confirmed,
        !confirmed ? paymentNote.trim() : undefined,
        paymentStatus, // expected payment status
      );
      if (result.conflict) {
        setConflictStatus(result.currentStatus ?? null);
        setError(result.error);
        return;
      }
      if (result.error) { setError(result.error); return; }
      setShowPaymentRevert(false);
      setPaymentNote("");
      router.refresh();
    });
  }

  return (
    <div className="dashboard-card" style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>Estado</div>
          <span
            className="tag"
            style={{
              background: `${STATUS_COLOR[status] ?? "#777"}18`,
              color: STATUS_COLOR[status] ?? "#777",
              fontSize: 14, padding: "6px 12px",
            }}
          >
            {STATUS_LABEL[status] ?? status}
          </span>
        </div>

        {role !== "kitchen" && paymentStatus && (
          <div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>Pago</div>
            <span style={{ fontSize: 12, fontWeight: 500, color: paymentStatus === "confirmed" ? "#2e7d32" : "#777" }}>
              {paymentStatus === "confirmed" ? "✓ Confirmado" : "⏳ Pendiente"}
            </span>
          </div>
        )}
      </div>

      {/* Conflict alert */}
      {conflictStatus && (
        <div
          role="alert"
          style={{ background: "#fff3cd", border: "1px solid #ffc107", borderRadius: 8, padding: "12px 14px", marginBottom: 12 }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 13 }}>Estado desactualizado</div>
          <div style={{ fontSize: 12 }}>
            {error} Estado actual: <strong>{STATUS_LABEL[conflictStatus] ?? conflictStatus}</strong>.
          </div>
          <button
            type="button"
            className="button small"
            style={{ marginTop: 8, fontSize: 12 }}
            onClick={() => { setConflictStatus(null); setError(null); router.refresh(); }}
          >
            Actualizar vista
          </button>
        </div>
      )}

      {!conflictStatus && error && (
        <div className="auth-error" role="alert" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}

      {/* Note modal */}
      {noteModal && (
        <div style={{ background: "var(--soft)", borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>
            {noteModal === "rejected" ? "Rechazar pedido" : "Cancelar pedido"}
          </div>
          <div className="field" style={{ marginBottom: 10 }}>
            <label>Motivo obligatorio</label>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej: Sin stock, restaurante cerrado…" />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="button small" style={{ background: "#c62828", borderColor: "#c62828" }} onClick={handleConfirmNote} disabled={isPending}>
              {isPending ? "…" : "Confirmar"}
            </button>
            <button type="button" className="button secondary small" onClick={() => { setNoteModal(null); setError(null); }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {!isTerminal && !noteModal && !conflictStatus && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {actions.map((next) => (
            <button
              key={next}
              type="button"
              className="button"
              style={{
                fontSize: 13,
                background: next === "rejected" ? "#c62828" : undefined,
                borderColor: next === "rejected" ? "#c62828" : undefined,
              }}
              onClick={() => handleActionClick(next)}
              disabled={isPending}
            >
              {isPending ? "…" : ACTION_LABEL[next] ?? next}
            </button>
          ))}
          {role === "owner" && (
            <button type="button" className="button secondary" style={{ fontSize: 13, color: "#c62828", borderColor: "#fca5a5" }} onClick={() => handleActionClick("cancelled")} disabled={isPending}>
              Cancelar pedido
            </button>
          )}
        </div>
      )}

      {/* Payment confirmation */}
      {role !== "kitchen" && !isTerminal && !conflictStatus && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
          {paymentStatus !== "confirmed" ? (
            <button type="button" className="button" style={{ fontSize: 13, background: "#2e7d32", borderColor: "#2e7d32" }} onClick={() => handleConfirmPayment(true)} disabled={isPending}>
              {isPending ? "…" : "Confirmar pago"}
            </button>
          ) : (
            <div>
              {!showPaymentRevert ? (
                <button type="button" className="button secondary small" style={{ fontSize: 12 }} onClick={() => setShowPaymentRevert(true)} disabled={role !== "owner"}>
                  {role === "owner" ? "Corregir pago confirmado" : "Solo el propietario puede corregir"}
                </button>
              ) : (
                <div style={{ background: "var(--soft)", borderRadius: 10, padding: 14 }}>
                  <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>Revertir confirmación de pago</div>
                  <div className="field" style={{ marginBottom: 10 }}>
                    <label>Motivo obligatorio</label>
                    <input type="text" value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} placeholder="Ej: Transferencia no recibida…" />
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" className="button small" style={{ background: "#e65100", borderColor: "#e65100" }} onClick={() => handleConfirmPayment(false)} disabled={isPending}>
                      {isPending ? "…" : "Revertir"}
                    </button>
                    <button type="button" className="button secondary small" onClick={() => { setShowPaymentRevert(false); setPaymentNote(""); setError(null); }}>
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
