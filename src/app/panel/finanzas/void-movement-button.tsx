"use client";

import { useTransition } from "react";
import { voidMovement } from "./actions";

export function VoidMovementButton({ movementId, concept }: { movementId: string; concept: string }) {
  const [isPending, startTransition] = useTransition();

  function handleVoid() {
    if (!confirm(`¿Anular el movimiento "${concept}"? Quedará excluido de los totales. Esta acción no se puede deshacer.`)) return;
    startTransition(async () => {
      const result = await voidMovement(movementId);
      if (result.error) alert(`Error: ${result.error}`);
    });
  }

  return (
    <button
      type="button"
      onClick={handleVoid}
      disabled={isPending}
      className="button secondary small"
      style={{ fontSize: 11, color: "#92400E", minHeight: 32, padding: "0 10px" }}
      aria-label={`Anular movimiento: ${concept}`}
    >
      {isPending ? "Anulando…" : "Anular"}
    </button>
  );
}
