"use client";

import { useState, useCallback } from "react";
import { Copy, Check, Share2, QrCode, X } from "lucide-react";
import { createPortal } from "react-dom";

// ── QR via Google Charts API (no client-side lib needed) ──────────
// The same URL goes to all four: display, copy, WhatsApp, QR code.

interface Props {
  /** Absolute canonical URL — must be the same string shown, copied, shared and QR-encoded. */
  catalogUrl:      string;
  /** WhatsApp number in international format without +, e.g. "584141234567". Optional. */
  whatsappNumber?: string | null;
  footnote?:       string;
  footnoteAction?: React.ReactNode;
}

function QrModal({ url, onClose }: { url: string; onClose: () => void }) {
  // Build the QR image URL using Google Charts (no external package needed, always available).
  const encoded = encodeURIComponent(url);
  const qrSrc   = `https://chart.googleapis.com/chart?chs=300x300&cht=qr&chl=${encoded}&choe=UTF-8`;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Código QR del catálogo"
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
    >
      {/* Backdrop */}
      <div
        style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.55)" }}
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        style={{
          position: "relative", background: "#fff", borderRadius: 16,
          padding: "28px 24px", maxWidth: 380, width: "100%",
          boxShadow: "0 20px 60px rgba(0,0,0,.25)",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
        }}
      >
        <button
          aria-label="Cerrar"
          onClick={onClose}
          style={{
            position: "absolute", top: 12, right: 12,
            background: "none", border: "none", cursor: "pointer",
            padding: 6, color: "#667085", borderRadius: 6,
            display: "flex", alignItems: "center",
          }}
        >
          <X size={18} />
        </button>

        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#202337", margin: 0 }}>
          Código QR de tu catálogo
        </h2>

        {/* QR image — points to the same canonical URL */}
        <img
          src={qrSrc}
          alt="Código QR del catálogo"
          width={240}
          height={240}
          style={{ borderRadius: 8, border: "1px solid #E5E7EB" }}
        />

        {/* URL underneath the QR */}
        <p
          style={{
            fontSize: 11, color: "#667085", textAlign: "center",
            wordBreak: "break-all", margin: 0, lineHeight: 1.5,
            maxWidth: 280,
          }}
        >
          {url}
        </p>

        <p style={{ fontSize: 12, color: "#9CA3AF", margin: 0, textAlign: "center" }}>
          Escanea con la cámara del teléfono para abrir el catálogo.
        </p>
      </div>
    </div>,
    document.body,
  );
}

export function CatalogShareCard({
  catalogUrl, whatsappNumber, footnote, footnoteAction,
}: Props) {
  const [copied,  setCopied]  = useState(false);
  const [showQr,  setShowQr]  = useState(false);

  const handleCopy = useCallback(() => {
    if (!catalogUrl) return;
    navigator.clipboard.writeText(catalogUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // Fallback for older browsers / insecure contexts
      try {
        const ta = document.createElement("textarea");
        ta.value = catalogUrl;
        ta.style.cssText = "position:fixed;opacity:0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        /* ignore */
      }
    });
  }, [catalogUrl]);

  // WhatsApp share URL — encodes the catalog link into a pre-filled message.
  const waText    = encodeURIComponent(`¡Explora nuestro catálogo! ${catalogUrl}`);
  const waUrl     = whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=${waText}`
    : `https://wa.me/?text=${waText}`;

  return (
    <>
      <div className="dashboard-card">
        <h2 style={{ fontSize: 15, fontWeight: 600, color: "#202337", marginBottom: 4 }}>
          Comparte tu catálogo
        </h2>
        <p style={{ fontSize: 13, color: "#667085", marginBottom: 14 }}>
          Copia el enlace o comparte por WhatsApp. El QR apunta a la misma dirección.
        </p>

        {/* URL display — same string shown, copied, shared and QR-encoded */}
        <div
          style={{
            display: "flex", alignItems: "stretch", gap: 0,
            border: "1px solid #E5E7EB", borderRadius: 8, overflow: "hidden",
            marginBottom: 12,
          }}
        >
          <code
            style={{
              flex: "1 1 0", fontSize: 12, background: "#F6F7FB",
              padding: "10px 14px", color: "#202337",
              wordBreak: "break-all", overflowWrap: "anywhere",
              lineHeight: 1.5, minWidth: 0,
              /* Prevent the URL from making the card overflow on mobile */
              overflow: "hidden",
            }}
          >
            {catalogUrl}
          </code>
          <button
            onClick={handleCopy}
            aria-label={copied ? "Copiado" : "Copiar enlace"}
            title={copied ? "Copiado" : "Copiar enlace"}
            style={{
              flexShrink: 0, border: "none", borderLeft: "1px solid #E5E7EB",
              background: copied ? "#F0FDF4" : "#fff",
              padding: "0 14px", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: copied ? "#166534" : "#667085",
              transition: "background .15s, color .15s",
              minWidth: 44, minHeight: 44,
            }}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={handleCopy}
            className="button secondary small"
            style={{ fontSize: 12, minHeight: 44 }}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? "Copiado" : "Copiar enlace"}
          </button>

          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="button secondary small"
            style={{ fontSize: 12, minHeight: 44, textDecoration: "none" }}
          >
            <Share2 size={13} />
            Compartir por WhatsApp
          </a>

          <button
            onClick={() => setShowQr(true)}
            className="button secondary small"
            style={{ fontSize: 12, minHeight: 44 }}
          >
            <QrCode size={13} />
            Ver QR
          </button>

          <a
            href={catalogUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="panel-quick-action"
            style={{ fontSize: 12, minHeight: 44, textDecoration: "none" }}
          >
            Abrir catálogo ↗
          </a>
        </div>

        {footnote && (
          <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 12, lineHeight: 1.5 }}>
            {footnote}
          </p>
        )}
        {footnoteAction}
      </div>

      {showQr && <QrModal url={catalogUrl} onClose={() => setShowQr(false)} />}
    </>
  );
}
