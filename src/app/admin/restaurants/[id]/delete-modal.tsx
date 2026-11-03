"use client";

import { useTransition, useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Trash2, X } from "lucide-react";
import { softDeleteRestaurant } from "../../actions";
import { useRouter } from "next/navigation";

interface Props {
  restaurantId: string;
  restaurantName: string;
}

export function DeleteRestaurantModal({ restaurantId, restaurantName }: Props) {
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setConfirmed("");
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  function handleDelete() {
    if (confirmed !== restaurantName) {
      setError("El nombre no coincide. Escríbelo exactamente.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await softDeleteRestaurant(restaurantId, confirmed);
      if (result.error) {
        setError(result.error);
      } else {
        setOpen(false);
        router.push("/admin");
      }
    });
  }

  const modal = open
    ? createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "16px",
          }}
        >
          <div
            style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.55)" }}
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            style={{
              position: "relative", background: "#fff", borderRadius: 12,
              padding: "28px 24px", maxWidth: 440, width: "100%",
              boxShadow: "0 20px 60px rgba(0,0,0,.25)",
            }}
          >
            <button
              aria-label="Cerrar"
              onClick={() => setOpen(false)}
              style={{
                position: "absolute", top: 12, right: 12,
                background: "none", border: "none", cursor: "pointer",
                padding: 4, color: "#667085",
              }}
            >
              <X size={18} />
            </button>

            <div style={{ marginBottom: 20 }}>
              <div style={{
                width: 44, height: 44, borderRadius: "50%",
                background: "#FEE2E2", display: "flex", alignItems: "center",
                justifyContent: "center", marginBottom: 16,
              }}>
                <Trash2 size={20} color="#DC2626" />
              </div>
              <h2 id="delete-modal-title" style={{ fontSize: 17, fontWeight: 700, color: "#202337", marginBottom: 8 }}>
                Eliminar negocio
              </h2>
              <p style={{ fontSize: 13, color: "#667085", lineHeight: 1.5 }}>
                Esta acción es reversible desde &quot;Negocios eliminados&quot;, pero el negocio
                quedará inmediatamente suspendido y no aceptará pedidos ni aparecerá
                en su URL pública.
              </p>
              <p style={{ fontSize: 13, color: "#667085", marginTop: 10, lineHeight: 1.5 }}>
                Se conservan todos los productos, pedidos, pagos e historial.
              </p>
            </div>

            <div className="field" style={{ marginBottom: 16 }}>
              <label htmlFor="confirm-name" style={{ fontWeight: 600, color: "#202337", fontSize: 13 }}>
                Escribe el nombre del negocio para confirmar:
              </label>
              <code style={{ display: "block", padding: "6px 10px", background: "#F6F7FB",
                borderRadius: 6, fontSize: 13, fontFamily: "monospace", margin: "8px 0",
                color: "#202337", wordBreak: "break-all" }}>
                {restaurantName}
              </code>
              <input
                id="confirm-name"
                ref={inputRef}
                type="text"
                value={confirmed}
                onChange={(e) => setConfirmed(e.target.value)}
                placeholder={restaurantName}
                autoComplete="off"
              />
            </div>

            {error && (
              <div className="auth-error" role="alert" style={{ marginBottom: 12 }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={handleDelete}
                disabled={pending || confirmed !== restaurantName}
                className="button"
                style={{
                  background: confirmed === restaurantName ? "#DC2626" : "#9CA3AF",
                  borderColor: "transparent", flex: 1, justifyContent: "center",
                  cursor: confirmed === restaurantName ? "pointer" : "not-allowed",
                }}
              >
                {pending ? "Eliminando…" : "Eliminar negocio"}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="button secondary"
                style={{ flex: 1, justifyContent: "center" }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="button secondary small"
        style={{ fontSize: 12, color: "#DC2626", borderColor: "#FCA5A5" }}
      >
        <Trash2 size={13} />
        Eliminar
      </button>
      {modal}
    </>
  );
}
