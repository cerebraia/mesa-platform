"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { X, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { hardDeleteRestaurant } from "../../actions";

interface Props {
  restaurantId: string;
  restaurantSlug: string;
  restaurantName: string;
  subCount: number;
  orderCount: number;
  productCount: number;
  memberCount: number;
}

export function HardDeleteRestaurantModal({
  restaurantId,
  restaurantSlug,
  restaurantName,
  subCount,
  orderCount,
  productCount,
  memberCount,
}: Props) {
  const [open, setOpen]               = useState(false);
  const [confirmSlug, setConfirmSlug] = useState("");
  const [error, setError]             = useState<string | null>(null);
  const [pending, startTransition]    = useTransition();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const hasFinancialData = subCount > 0 || orderCount > 0;

  useEffect(() => {
    if (open) { setConfirmSlug(""); setError(null); setTimeout(() => inputRef.current?.focus(), 50); }
  }, [open]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  function handleDelete() {
    if (confirmSlug !== restaurantSlug) {
      setError("El slug no coincide. Escríbelo exactamente.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await hardDeleteRestaurant(restaurantId, confirmSlug);
      if (res.error) { setError(res.error); return; }
      router.push("/admin");
    });
  }

  return (
    <>
      <button
        type="button"
        className="button secondary small"
        style={{ fontSize: 12, color: "#DC2626", borderColor: "#fecaca" }}
        onClick={() => setOpen(true)}
        disabled={hasFinancialData}
        title={
          hasFinancialData
            ? `No disponible: hay ${subCount} suscripción(es) o ${orderCount} pedido(s). Usa el archivo en su lugar.`
            : "Eliminar definitivamente este negocio y todos sus datos"
        }
      >
        <Trash2 size={13} />
        Eliminar definitivamente
      </button>

      {open && (
        <div
          role="dialog" aria-modal="true" aria-labelledby="hard-del-title"
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
          }}
        >
          <div
            style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.55)" }}
            onClick={() => setOpen(false)} aria-hidden
          />
          <div style={{
            position: "relative", background: "#fff", borderRadius: 12,
            padding: "28px 24px", maxWidth: 460, width: "100%",
            boxShadow: "0 20px 60px rgba(0,0,0,.25)",
          }}>
            <button
              aria-label="Cerrar"
              onClick={() => setOpen(false)}
              style={{ position: "absolute", top: 12, right: 12, background: "none", border: "none", cursor: "pointer", padding: 4, color: "#667085" }}
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
              <h2 id="hard-del-title" style={{ fontSize: 17, fontWeight: 700, color: "#202337", marginBottom: 8 }}>
                Eliminar definitivamente
              </h2>
              <p style={{ fontSize: 13, color: "#667085", lineHeight: 1.5, marginBottom: 10 }}>
                Esta acción es <strong>irreversible</strong>. Se eliminarán permanentemente:
              </p>
              <ul style={{ fontSize: 12, color: "#667085", paddingLeft: 18, lineHeight: 1.8 }}>
                <li>{productCount} producto{productCount !== 1 ? "s" : ""} (con imágenes, variantes y opciones)</li>
                <li>{memberCount} membresía{memberCount !== 1 ? "s" : ""}</li>
                <li>Configuración, categorías y dominios</li>
                <li>Archivos de Storage del negocio</li>
              </ul>
              <p style={{ fontSize: 12, color: "#16a34a", marginTop: 8 }}>
                ✓ Sin suscripciones ni pedidos — eliminación definitiva disponible.
              </p>
            </div>

            <div className="field" style={{ marginBottom: 16 }}>
              <label style={{ fontWeight: 600, fontSize: 13, color: "#202337" }}>
                Escribe el slug del negocio para confirmar:
              </label>
              <code style={{
                display: "block", padding: "5px 10px", background: "#F6F7FB",
                borderRadius: 6, fontSize: 12, fontFamily: "monospace", margin: "6px 0 8px",
                color: "#202337",
              }}>
                {restaurantSlug}
              </code>
              <input
                ref={inputRef}
                type="text"
                value={confirmSlug}
                onChange={(e) => { setConfirmSlug(e.target.value); setError(null); }}
                placeholder={restaurantSlug}
                autoComplete="off"
              />
            </div>

            {error && <div className="auth-error" role="alert" style={{ marginBottom: 12 }}>{error}</div>}

            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                className="button"
                style={{
                  background: confirmSlug === restaurantSlug ? "#DC2626" : "#9CA3AF",
                  borderColor: "transparent", flex: 1, justifyContent: "center", minHeight: 44,
                }}
                onClick={handleDelete}
                disabled={pending || confirmSlug !== restaurantSlug}
              >
                {pending ? "Eliminando…" : "Eliminar definitivamente"}
              </button>
              <button
                type="button"
                className="button secondary small"
                style={{ flex: 1, justifyContent: "center", minHeight: 44 }}
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
