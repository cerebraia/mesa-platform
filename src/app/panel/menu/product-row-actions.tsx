"use client";

import { useRef, useState, useCallback } from "react";
import { setProductPublished, softDeleteProduct } from "./actions";
import { PublishConfirmModal, BlockedNoPriceModal } from "@/components/publish-confirm-modal";
import { DeleteProductModal } from "@/components/delete-product-modal";

export function ProductRowActions({
  productId,
  productName,
  isPublished,
  isAvailable,
  hasPriceMissing,
  catalogLabel = "catálogo",
  onDeleted,
}: {
  productId: string;
  productName: string;
  isPublished: boolean;
  isAvailable: boolean;
  hasPriceMissing: boolean;
  catalogLabel?: "menú" | "catálogo";
  /** Called after a successful soft-delete so the parent can remove the row */
  onDeleted?: () => void;
}) {
  // ── Publish/unpublish state ──────────────────────────────────
  const [pubOpen,   setPubOpen]   = useState(false);
  const [pubSaving, setPubSaving] = useState(false);
  const [pubError,  setPubError]  = useState<string | null>(null);
  const pubTriggerRef = useRef<HTMLButtonElement>(null);

  function openPubModal() { setPubError(null); setPubOpen(true); }
  const closePubModal = useCallback(() => {
    setPubOpen(false); setPubError(null);
    pubTriggerRef.current?.focus();
  }, []);
  const handlePublishConfirm = useCallback(async () => {
    if (pubSaving) return;
    setPubSaving(true); setPubError(null);
    const result = await setProductPublished(productId, !isPublished);
    setPubSaving(false);
    if (result.error) setPubError(result.error);
    else setPubOpen(false);
  }, [pubSaving, productId, isPublished]);

  const blockPublish    = !isPublished && hasPriceMissing;
  const warnUnavailable = !isPublished && !isAvailable && !hasPriceMissing;

  // ── Delete state ─────────────────────────────────────────────
  const [delOpen,   setDelOpen]   = useState(false);
  const [delSaving, setDelSaving] = useState(false);
  const [delError,  setDelError]  = useState<string | null>(null);
  const delTriggerRef = useRef<HTMLButtonElement>(null);

  function openDelModal() { setDelError(null); setDelOpen(true); }
  const closeDelModal = useCallback(() => {
    setDelOpen(false); setDelError(null);
    delTriggerRef.current?.focus();
  }, []);
  const handleDeleteConfirm = useCallback(async () => {
    if (delSaving) return;
    setDelSaving(true); setDelError(null);
    const result = await softDeleteProduct(productId);
    setDelSaving(false);
    if (result.error) {
      setDelError(result.error);
    } else {
      setDelOpen(false);
      onDeleted?.();
    }
  }, [delSaving, productId, onDeleted]);

  return (
    <>
      {/* Publish / unpublish button */}
      <button
        ref={pubTriggerRef}
        onClick={openPubModal}
        className="button secondary small"
        style={{ fontSize: 11, color: isPublished ? "#a72b38" : "var(--purple)" }}
        aria-label={isPublished ? `Despublicar ${productName}` : `Publicar ${productName}`}
      >
        {isPublished ? "Despublicar" : "Publicar"}
      </button>

      {/* Delete button — × with tooltip, 44×44 touch area */}
      <button
        ref={delTriggerRef}
        type="button"
        onClick={openDelModal}
        aria-label={`Eliminar producto ${productName}`}
        title="Eliminar producto"
        style={{
          background: "none", border: "none", cursor: "pointer",
          color: "#9CA3AF", padding: 0,
          width: 44, height: 44,
          display: "flex", alignItems: "center", justifyContent: "center",
          borderRadius: 8, flexShrink: 0,
          transition: "color 0.12s, background 0.12s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = "#a72b38";
          (e.currentTarget as HTMLButtonElement).style.background = "#FEF2F2";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = "#9CA3AF";
          (e.currentTarget as HTMLButtonElement).style.background = "none";
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          <path d="M10 11v6"/><path d="M14 11v6"/>
          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
        </svg>
      </button>

      {/* Publish modals */}
      {pubOpen && blockPublish && (
        <BlockedNoPriceModal
          productId={productId}
          productName={productName}
          onCancel={closePubModal}
        />
      )}
      {pubOpen && !blockPublish && (
        <PublishConfirmModal
          productName={productName}
          publishing={!isPublished}
          catalogLabel={catalogLabel}
          isSaving={pubSaving}
          error={pubError}
          warnUnavailable={warnUnavailable}
          onConfirm={handlePublishConfirm}
          onCancel={closePubModal}
        />
      )}

      {/* Delete modal */}
      {delOpen && (
        <DeleteProductModal
          productName={productName}
          isSaving={delSaving}
          error={delError}
          onConfirm={handleDeleteConfirm}
          onCancel={closeDelModal}
        />
      )}
    </>
  );
}
