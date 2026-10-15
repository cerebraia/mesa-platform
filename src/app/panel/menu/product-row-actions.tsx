"use client";

import { useTransition } from "react";
import { setProductPublished } from "./actions";

export function ProductRowActions({
  productId,
  isPublished,
}: {
  productId: string;
  isPublished: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    const label = isPublished ? "despublicar" : "publicar";
    if (!confirm(`¿Confirmas que deseas ${label} este producto?`)) return;

    startTransition(async () => {
      const result = await setProductPublished(productId, !isPublished);
      if (result.error) alert(`Error: ${result.error}`);
    });
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      className="button secondary small"
      style={{
        fontSize: 11,
        color: isPublished ? "#a72b38" : "var(--purple)",
      }}
    >
      {isPending ? "…" : isPublished ? "Despublicar" : "Publicar"}
    </button>
  );
}
