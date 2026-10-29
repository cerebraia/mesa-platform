"use client";

import { useRef, useState, useCallback } from "react";
import { setProductPublished } from "./actions";
import { PublishConfirmModal, BlockedNoPriceModal } from "@/components/publish-confirm-modal";

export function ProductRowActions({
  productId,
  productName,
  isPublished,
  isAvailable,
  hasPriceMissing,
  catalogLabel = "catálogo",
}: {
  productId: string;
  productName: string;
  isPublished: boolean;
  isAvailable: boolean;
  hasPriceMissing: boolean;
  catalogLabel?: "menú" | "catálogo";
}) {
  const [open, setOpen]     = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  function openModal() {
    setError(null);
    setOpen(true);
  }

  const closeModal = useCallback(() => {
    setOpen(false);
    setError(null);
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
    } else {
      setOpen(false);
    }
  }, [saving, productId, isPublished]);

  // When publishing: a product with no price cannot be published.
  // Show the blocked modal instead.
  const blockPublish = !isPublished && hasPriceMissing;

  // When publishing a product whose availability is off: it will land in
  // "Pausado" state, not visible in the public catalog. Warn the owner.
  const warnUnavailable = !isPublished && !isAvailable && !hasPriceMissing;

  const buttonLabel = isPublished ? "Despublicar" : "Publicar";
  const ariaLabel   = isPublished
    ? `Despublicar ${productName}`
    : `Publicar ${productName}`;

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
        aria-label={ariaLabel}
      >
        {buttonLabel}
      </button>

      {open && blockPublish && (
        <BlockedNoPriceModal
          productId={productId}
          productName={productName}
          onCancel={closeModal}
        />
      )}

      {open && !blockPublish && (
        <PublishConfirmModal
          productName={productName}
          publishing={!isPublished}
          catalogLabel={catalogLabel}
          isSaving={saving}
          error={error}
          warnUnavailable={warnUnavailable}
          onConfirm={handleConfirm}
          onCancel={closeModal}
        />
      )}
    </>
  );
}
