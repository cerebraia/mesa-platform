"use client";

import { useEffect, useRef } from "react";

interface DeleteProductModalProps {
  productName: string;
  isSaving: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteProductModal({
  productName,
  isSaving,
  error,
  onConfirm,
  onCancel,
}: DeleteProductModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus initial: Cancelar
  useEffect(() => { cancelRef.current?.focus(); }, []);

  // Escape → cancel
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape" && !isSaving) onCancel();
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isSaving, onCancel]);

  // Focus trap
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const el = document.getElementById("dpm-dialog");
      const nodes = el?.querySelectorAll<HTMLElement>(
        "button:not([disabled]),[href],[tabindex]:not([tabindex=\"-1\"])"
      );
      if (!nodes || nodes.length === 0) return;
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
      else            { if (document.activeElement === last)  { e.preventDefault(); first.focus(); } }
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Lock scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={isSaving ? undefined : onCancel}
        style={{ position: "fixed", inset: 0, background: "rgba(25,22,46,0.5)", zIndex: 1200 }}
      />

      {/* Dialog */}
      <div
        id="dpm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dpm-title"
        aria-describedby="dpm-desc"
        style={{
          position: "fixed", top: "50%", left: "50%",
          transform: "translate(-50%,-50%)",
          zIndex: 1201,
          background: "#fff", borderRadius: 16,
          boxShadow: "0 24px 64px rgba(25,22,46,0.2), 0 2px 8px rgba(25,22,46,0.08)",
          padding: "28px 28px 24px",
          width: "min(420px, calc(100vw - 32px))",
        }}
      >
        {/* Trash icon */}
        <div aria-hidden="true" style={{
          width: 40, height: 40, borderRadius: 10, background: "rgba(167,43,56,0.08)",
          display: "grid", placeItems: "center", marginBottom: 16,
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="#a72b38" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6"/>
            <path d="M14 11v6"/>
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
        </div>

        <h2
          id="dpm-title"
          style={{
            fontFamily: "var(--font-poppins,'Poppins',sans-serif)",
            fontSize: 17, fontWeight: 600, color: "#19162E",
            margin: "0 0 8px", letterSpacing: -0.3,
          }}
        >
          ¿Eliminar este producto?
        </h2>

        <p
          id="dpm-desc"
          style={{ fontSize: 14, color: "#4B5563", margin: "0 0 20px", lineHeight: 1.5 }}
        >
          «{productName}» dejará de aparecer en tu catálogo.
          Podrás recuperarlo desde <strong>Productos eliminados</strong>.
        </p>

        {error && (
          <div role="alert" style={{
            background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8,
            padding: "10px 12px", fontSize: 13, color: "#991B1B", marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button
            ref={cancelRef}
            className="button secondary"
            onClick={onCancel}
            disabled={isSaving}
            style={{ minHeight: 40, fontSize: 13 }}
          >
            Cancelar
          </button>
          <button
            className="button"
            onClick={onConfirm}
            disabled={isSaving}
            style={{
              minHeight: 40, fontSize: 13, minWidth: 140,
              background: "#a72b38", color: "#fff", border: "none",
            }}
          >
            {isSaving ? "Eliminando…" : "Eliminar producto"}
          </button>
        </div>
      </div>
    </>
  );
}
