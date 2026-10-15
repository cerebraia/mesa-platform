"use client";

import { useTransition } from "react";
import { setCategoryActive } from "./actions";

export function CategoryActions({
  categoryId,
  isActive,
}: {
  categoryId: string;
  isActive: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    const label = isActive ? "archivar" : "restaurar";
    if (!confirm(`¿Confirmas que deseas ${label} esta categoría?`)) return;

    startTransition(async () => {
      const result = await setCategoryActive(categoryId, !isActive);
      if (result.error) alert(`Error: ${result.error}`);
    });
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      className="button secondary small"
      style={{ fontSize: 11 }}
    >
      {isPending ? "…" : isActive ? "Archivar" : "Restaurar"}
    </button>
  );
}
