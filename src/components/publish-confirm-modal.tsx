"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

// ── Shared modal shell ─────────────────────────────────────────────

function ModalShell({
  id,
  onBackdropClick,
  children,
}: {
  id: string;
  onBackdropClick?: () => void;
  children: React.ReactNode;
}) {
  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <>
      <div
        aria-hidden="true"
        onClick={onBackdropClick}
        style={{ position: "fixed", inset: 0, background: "rgba(25,22,46,0.5)", zIndex: 1200 }}
      />
      <div
        id={id}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-desc`}
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
        {children}
      </div>
    </>
  );
}

function ModalIcon({ publishing }: { publishing: boolean }) {
  return (
    <div
      aria-hidden="true"
      style={{
        width: 40, height: 40, borderRadius: 10,
        background: publishing ? "rgba(112,59,230,0.1)" : "rgba(167,43,56,0.08)",
        display: "grid", placeItems: "center", marginBottom: 16,
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
  );
}

// ── Blocked modal: product has no price ────────────────────────────

interface BlockedNoPriceModalProps {
  productId: string;
  productName: string;
  onCancel: () => void;
}

export function BlockedNoPriceModal({ productId, productName, onCancel }: BlockedNoPriceModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { cancelRef.current?.focus(); }, []);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onCancel]);

  // Trap focus
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const el = document.getElementById("bnp-dialog");
      const nodes = el?.querySelectorAll<HTMLElement>(
        'button:not([disabled]),[href],[tabindex]:not([tabindex="-1"])'
      );
      if (!nodes || nodes.length === 0) return;
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
      else            { if (document.activeElement === last)  { e.preventDefault(); first.focus(); } }
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <ModalShell id="bnp-dialog" onBackdropClick={onCancel}>
      {/* Warning icon */}
      <div aria-hidden="true" style={{
        width: 40, height: 40, borderRadius: 10, background: "#FEF3C7",
        display: "grid", placeItems: "center", marginBottom: 16,
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
          stroke="#92400E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      </div>

      <h2
        id="bnp-dialog-title"
        style={{ fontFamily: "var(--font-poppins,'Poppins',sans-serif)", fontSize: 17, fontWeight: 600, color: "#19162E", margin: "0 0 8px", letterSpacing: -0.3 }}
      >
        Precio obligatorio
      </h2>
      <p
        id="bnp-dialog-desc"
        style={{ fontSize: 14, color: "#4B5563", margin: "0 0 20px", lineHeight: 1.5 }}
      >
        «{productName}» no tiene precio. Añade un precio antes de publicarlo.
      </p>

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
        <button
          ref={cancelRef}
          className="button secondary"
          onClick={onCancel}
          style={{ minHeight: 40, fontSize: 13 }}
        >
          Cerrar
        </button>
        <Link
          href={`/panel/menu/products/${productId}/edit`}
          className="button"
          onClick={onCancel}
          style={{ minHeight: 40, fontSize: 13, background: "var(--purple,#703BE6)", color: "#fff", border: "none", textDecoration: "none", display: "inline-flex", alignItems: "center" }}
        >
          Editar producto
        </Link>
      </div>
    </ModalShell>
  );
}

// ── Main confirm modal ─────────────────────────────────────────────

interface PublishConfirmModalProps {
  productName: string;
  publishing: boolean;
  catalogLabel: "menú" | "catálogo";
  isSaving: boolean;
  error: string | null;
  /** true when pub=F but avail=F — publishing will leave product in "Pausado" state */
  warnUnavailable?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function PublishConfirmModal({
  productName,
  publishing,
  catalogLabel,
  isSaving,
  error,
  warnUnavailable = false,
  onConfirm,
  onCancel,
}: PublishConfirmModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { cancelRef.current?.focus(); }, []);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape" && !isSaving) onCancel();
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isSaving, onCancel]);

  // Trap focus
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const el = document.getElementById("pcm-dialog");
      const nodes = el?.querySelectorAll<HTMLElement>(
        'button:not([disabled]),[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'
      );
      if (!nodes || nodes.length === 0) return;
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
      else            { if (document.activeElement === last)  { e.preventDefault(); first.focus(); } }
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const title = publishing ? "¿Publicar este producto?" : "¿Despublicar este producto?";
  const description = publishing
    ? `«${productName}» será visible en tu ${catalogLabel} público.`
    : `«${productName}» dejará de mostrarse en tu ${catalogLabel} público.`;

  return (
    <ModalShell id="pcm-dialog" onBackdropClick={isSaving ? undefined : onCancel}>
      <ModalIcon publishing={publishing} />

      <h2
        id="pcm-dialog-title"
        style={{ fontFamily: "var(--font-poppins,'Poppins',sans-serif)", fontSize: 17, fontWeight: 600, color: "#19162E", margin: "0 0 8px", letterSpacing: -0.3 }}
      >
        {title}
      </h2>
      <p
        id="pcm-dialog-desc"
        style={{ fontSize: 14, color: "#4B5563", margin: "0 0 20px", lineHeight: 1.5 }}
      >
        {description}
      </p>

      {/* Warning: publishing a product with availability off */}
      {warnUnavailable && publishing && (
        <div style={{
          background: "#FEF3C7", border: "1px solid #FCD34D", borderRadius: 8,
          padding: "10px 12px", fontSize: 13, color: "#92400E", marginBottom: 16, lineHeight: 1.5,
        }}>
          Este producto tiene la disponibilidad desactivada. Quedará en estado{" "}
          <strong>Pausado</strong> y no aparecerá en tu {catalogLabel} hasta que actives
          su disponibilidad desde &ldquo;Editar producto&rdquo;.
        </div>
      )}

      {/* Runtime error */}
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
          ref={confirmRef}
          className="button"
          onClick={onConfirm}
          disabled={isSaving}
          style={{
            minHeight: 40, fontSize: 13,
            background: publishing ? "var(--purple,#703BE6)" : "#a72b38",
            color: "#fff", border: "none", minWidth: 130,
          }}
        >
          {isSaving ? "Guardando…" : publishing ? "Publicar producto" : "Despublicar"}
        </button>
      </div>
    </ModalShell>
  );
}
