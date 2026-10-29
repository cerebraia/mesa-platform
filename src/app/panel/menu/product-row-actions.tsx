"use client";

import { useRef, useState, useCallback } from "react";
import { setProductPublished } from "./actions";
import { PublishConfirmModal } from "@/components/publish-confirm-modal";

export function ProductRowActions({
  productId,
  productName,
  isPublished,
  catalogLabel = "catálogo",
}: {
  productId: string;
  productName: string;
  isPublished: boolean;
  catalogLabel?: "menú" | "catálogo";
}) {
  const [open, setOpen]       = useState(false);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);
  // Ref to the trigger button so we can restore focus on close
  const triggerRef = useRef<HTMLButtonElement>(null);

  function openModal() {
    setError(null);
    setOpen(true);
  }

  const closeModal = useCallback(() => {
    setOpen(false);
    setError(null);
    // Restore focus to the button that opened the dialog
    triggerRef.current?.focus();
  }, []);

  const handleConfirm = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    const result = await setProductPublished(productId, !isPublished);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      // Keep modal open so the user can retry
    } else {
      setOpen(false);
      // Focus returns to trigger automatically via closeModal, but since
      // the row re-renders after revalidation the ref may unmount briefly.
      // The browser will leave focus on body; this is acceptable.
    }
  }, [saving, productId, isPublished]);

  return (
    <>
      <button
        ref={triggerRef}
        onClick={openModal}
        className="button secondary small"
        style={{
          fontSize: 11,
          color: isPublished ? "#a72b38" : "var(--purple)",
        }}
        aria-label={isPublished ? `Despublicar ${productName}` : `Publicar ${productName}`}
      >
        {isPublished ? "Despublicar" : "Publicar"}
      </button>

      {open && (
        <PublishConfirmModal
          productName={productName}
          publishing={!isPublished}
          catalogLabel={catalogLabel}
          isSaving={saving}
          error={error}
          onConfirm={handleConfirm}
          onCancel={closeModal}
        />
      )}
    </>
  );
}
