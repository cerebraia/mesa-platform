"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { X, Trash2, Archive } from "lucide-react";
import { useRouter } from "next/navigation";
import { archivePlan, deletePlan } from "../actions";

interface Plan {
  id: string;
  name: string;
  is_active: boolean;
}

// Modal shared between archive and delete flows.
function PlanModal({
  plan,
  mode,
  subCount,
  onClose,
}: {
  plan: Plan;
  mode: "archive" | "delete";
  subCount: number;
  onClose: () => void;
}) {
  const [confirmName, setConfirmName] = useState("");
  const [pending, startTransition]    = useTransition();
  const [error, setError]             = useState<string | null>(null);
  const [done, setDone]               = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router   = useRouter();

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  function handleConfirm() {
    if (confirmName !== plan.name) {
      setError("El nombre no coincide. Escríbelo exactamente.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = mode === "archive" ? await archivePlan(plan.id) : await deletePlan(plan.id);
      if (res.error) { setError(res.error); return; }
      setDone(true);
      router.refresh();
    });
  }

  if (done) {
    return (
      <div
        style={{
          position: "fixed", inset: 0, zIndex: 9999,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
        }}
        role="dialog" aria-modal="true"
      >
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.55)" }} onClick={onClose} aria-hidden />
        <div style={{ position: "relative", background: "#fff", borderRadius: 12, padding: "28px 24px", maxWidth: 420, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,.25)" }}>
          <p style={{ fontSize: 14, color: "#374151", marginBottom: 20 }}>
            {mode === "archive"
              ? <>Plan <strong>{plan.name}</strong> archivado. No se puede contratar pero su historial se conserva.</>
              : <>Plan <strong>{plan.name}</strong> eliminado definitivamente.</>
            }
          </p>
          <button type="button" className="button secondary small" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    );
  }

  const isArchive = mode === "archive";
  const title    = isArchive ? "Archivar plan" : "Eliminar plan";
  const action   = isArchive ? "Archivar" : "Eliminar definitivamente";
  const danger   = !isArchive;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
      role="dialog" aria-modal="true" aria-labelledby="plan-modal-title"
    >
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.55)" }} onClick={onClose} aria-hidden />
      <div style={{ position: "relative", background: "#fff", borderRadius: 12, padding: "28px 24px", maxWidth: 440, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,.25)" }}>
        <button
          aria-label="Cerrar"
          onClick={onClose}
          style={{ position: "absolute", top: 12, right: 12, background: "none", border: "none", cursor: "pointer", padding: 4, color: "#667085" }}
        >
          <X size={18} />
        </button>

        <div style={{ marginBottom: 20 }}>
          <div style={{
            width: 44, height: 44, borderRadius: "50%",
            background: danger ? "#FEE2E2" : "#FFF3CD",
            display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16,
          }}>
            {danger ? <Trash2 size={20} color="#DC2626" /> : <Archive size={20} color="#b45309" />}
          </div>
          <h2 id="plan-modal-title" style={{ fontSize: 17, fontWeight: 700, color: "#202337", marginBottom: 8 }}>
            {title}
          </h2>

          {isArchive ? (
            <p style={{ fontSize: 13, color: "#667085", lineHeight: 1.5 }}>
              El plan quedará inactivo y no podrá contratarse. Las {subCount} suscripción(es) existentes
              y su historial se conservan intactos.
            </p>
          ) : (
            <p style={{ fontSize: 13, color: "#667085", lineHeight: 1.5 }}>
              Esta acción es <strong>irreversible</strong>. El plan se eliminará definitivamente.
              {subCount > 0 && (
                <span style={{ color: "#DC2626" }}>
                  {" "}Este plan tiene {subCount} suscripción(es). Archívalo en su lugar.
                </span>
              )}
            </p>
          )}
        </div>

        <div className="field" style={{ marginBottom: 16 }}>
          <label style={{ fontWeight: 600, fontSize: 13, color: "#202337" }}>
            Escribe el nombre del plan para confirmar:
          </label>
          <code style={{
            display: "block", padding: "5px 10px", background: "#F6F7FB",
            borderRadius: 6, fontSize: 12, fontFamily: "monospace", margin: "6px 0 8px",
            color: "#202337",
          }}>
            {plan.name}
          </code>
          <input
            ref={inputRef}
            type="text"
            value={confirmName}
            onChange={(e) => { setConfirmName(e.target.value); setError(null); }}
            placeholder={plan.name}
            autoComplete="off"
          />
        </div>

        {error && <div className="auth-error" role="alert" style={{ marginBottom: 12 }}>{error}</div>}

        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            className="button"
            style={{
              background: confirmName === plan.name
                ? (danger ? "#DC2626" : "#b45309")
                : "#9CA3AF",
              borderColor: "transparent", flex: 1, justifyContent: "center", minHeight: 44,
            }}
            onClick={handleConfirm}
            disabled={pending || confirmName !== plan.name}
          >
            {pending ? "Procesando…" : action}
          </button>
          <button
            type="button"
            className="button secondary small"
            style={{ flex: 1, justifyContent: "center", minHeight: 44 }}
            onClick={onClose}
            disabled={pending}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── PlanActionsClient ─────────────────────────────────────────
// Rendered per row in the plans table (server component wraps this).
// subCount is computed server-side and passed as a prop.

export function PlanActionsClient({
  plan,
  subCount,
}: {
  plan: Plan;
  subCount: number;
}) {
  const [modal, setModal] = useState<"archive" | "delete" | null>(null);

  const canHardDelete = subCount === 0;

  return (
    <>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {plan.is_active && (
          <button
            type="button"
            className="button secondary small"
            style={{ fontSize: 11, color: "#b45309", borderColor: "#fde68a", minHeight: 44 }}
            onClick={() => setModal("archive")}
            title={`Archivar plan "${plan.name}"`}
          >
            <Archive size={12} />
            Archivar
          </button>
        )}
        <button
          type="button"
          className="button secondary small"
          style={{
            fontSize: 11, minHeight: 44,
            color: canHardDelete ? "#DC2626" : "#9CA3AF",
            borderColor: canHardDelete ? "#fecaca" : "#E8E9EF",
            cursor: canHardDelete ? "pointer" : "not-allowed",
          }}
          onClick={() => canHardDelete && setModal("delete")}
          disabled={!canHardDelete}
          title={
            canHardDelete
              ? `Eliminar plan "${plan.name}" definitivamente`
              : `No se puede eliminar: tiene ${subCount} suscripción(es). Archívalo primero.`
          }
        >
          <Trash2 size={12} />
          Eliminar
        </button>
      </div>

      {modal && (
        <PlanModal
          plan={plan}
          mode={modal}
          subCount={subCount}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}
