"use client";

import { useEffect, useRef } from "react";

interface PublishConfirmModalProps {
  productName: string;
  /** true = publicar, false = despublicar */
  publishing: boolean;
  /** "menú" | "catálogo" — ajusta el texto descriptivo */
  catalogLabel: "menú" | "catálogo";
  isSaving: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function PublishConfirmModal({
  productName,
  publishing,
  catalogLabel,
  isSaving,
  error,
  onConfirm,
  onCancel,
}: PublishConfirmModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Focus initial: Cancelar (spec)
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  // Escape → cancel (only when not saving)
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape" && !isSaving) onCancel();
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isSaving, onCancel]);

  // Trap focus inside modal
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const focusable = document.getElementById("pcm-dialog")?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const title = publishing
    ? "¿Publicar este producto?"
    : "¿Despublicar este producto?";

  const description = publishing
    ? `«${productName}» será visible en tu ${catalogLabel} público.`
    : `«${productName}» dejará de mostrarse en tu ${catalogLabel} público.`;

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={isSaving ? undefined : onCancel}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(25,22,46,0.5)",
          zIndex: 1200,
        }}
      />

      {/* Dialog */}
      <div
        id="pcm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pcm-title"
        aria-describedby="pcm-desc"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%,-50%)",
          zIndex: 1201,
          background: "#ffffff",
          borderRadius: 16,
          boxShadow: "0 24px 64px rgba(25,22,46,0.2), 0 2px 8px rgba(25,22,46,0.08)",
          padding: "28px 28px 24px",
          width: "min(420px, calc(100vw - 32px))",
        }}
      >
        {/* Icon */}
        <div
          aria-hidden="true"
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: publishing ? "rgba(112,59,230,0.1)" : "rgba(167,43,56,0.08)",
            display: "grid",
            placeItems: "center",
            marginBottom: 16,
          }}
        >
          {publishing ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke="#703BE6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke="#a72b38" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
              <line x1="1" y1="1" x2="23" y2="23"/>
            </svg>
          )}
        </div>

        <h2
          id="pcm-title"
          style={{
            fontFamily: "var(--font-poppins, 'Poppins', sans-serif)",
            fontSize: 17,
            fontWeight: 600,
            color: "#19162E",
            margin: "0 0 8px",
            letterSpacing: -0.3,
          }}
        >
          {title}
        </h2>

        <p
          id="pcm-desc"
          style={{
            fontSize: 14,
            color: "#4B5563",
            margin: "0 0 20px",
            lineHeight: 1.5,
          }}
        >
          {description}
        </p>

        {/* Error message */}
        {error && (
          <div
            role="alert"
            style={{
              background: "#FEF2F2",
              border: "1px solid #FECACA",
              borderRadius: 8,
              padding: "10px 12px",
              fontSize: 13,
              color: "#991B1B",
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        {/* Actions */}
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
            ref={confirmRef}
            className="button"
            onClick={onConfirm}
            disabled={isSaving}
            style={{
              minHeight: 40,
              fontSize: 13,
              background: publishing ? "var(--purple, #703BE6)" : "#a72b38",
              color: "#fff",
              border: "none",
              minWidth: 130,
            }}
          >
            {isSaving
              ? "Guardando…"
              : publishing
              ? "Publicar producto"
              : "Despublicar"}
          </button>
        </div>
      </div>
    </>
  );
}
