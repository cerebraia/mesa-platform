"use client";

import { useState, useTransition } from "react";
import { setCategoryActive, deleteCategory, transferAndDeleteCategory } from "./actions";

type CategoryOption = { id: string; name: string };

export function CategoryActions({
  categoryId,
  categoryName,
  isActive,
  productCount,
  otherCategories,
}: {
  categoryId:       string;
  categoryName:     string;
  isActive:         boolean;
  productCount:     number;
  otherCategories:  CategoryOption[];
}) {
  const [isPending, startTransition] = useTransition();
  const [showTransfer, setShowTransfer] = useState(false);
  const [targetId, setTargetId]         = useState(otherCategories[0]?.id ?? "");
  const [transferError, setTransferError] = useState<string | null>(null);

  function handleToggle() {
    const label = isActive ? "archivar" : "restaurar";
    if (!confirm(`¿Confirmas que deseas ${label} la categoría "${categoryName}"?`)) return;
    startTransition(async () => {
      const result = await setCategoryActive(categoryId, !isActive);
      if (result.error) alert(`Error: ${result.error}`);
    });
  }

  function handleDeleteClick() {
    if (productCount > 0) {
      setShowTransfer(true);
      setTransferError(null);
      return;
    }
    if (!confirm(`¿Eliminar definitivamente la categoría "${categoryName}"? Esta acción no se puede deshacer.`)) return;
    startTransition(async () => {
      const result = await deleteCategory(categoryId);
      if (result.error) alert(`Error: ${result.error}`);
    });
  }

  function handleTransferConfirm() {
    if (!targetId) { setTransferError("Selecciona una categoría destino."); return; }
    if (!confirm(
      `¿Mover los ${productCount} producto(s) a "${otherCategories.find(c => c.id === targetId)?.name ?? targetId}" y eliminar la categoría "${categoryName}"? No se borrará ningún producto.`
    )) return;
    setTransferError(null);
    startTransition(async () => {
      const result = await transferAndDeleteCategory(categoryId, targetId);
      if (result.error) {
        setTransferError(result.error);
      } else {
        setShowTransfer(false);
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
      <div style={{ display: "flex", gap: 6 }}>
        <button
          onClick={handleToggle}
          disabled={isPending}
          className="button secondary small"
          style={{ fontSize: 11 }}
        >
          {isPending ? "…" : isActive ? "Archivar" : "Restaurar"}
        </button>
        <button
          onClick={handleDeleteClick}
          disabled={isPending}
          className="button secondary small"
          title={productCount > 0
            ? `Tiene ${productCount} producto${productCount === 1 ? "" : "s"} — traslada primero`
            : "Eliminar categoría definitivamente"}
          aria-label={`Eliminar categoría ${categoryName}`}
          style={{ fontSize: 11, color: "#a72b38" }}
        >
          Eliminar
        </button>
      </div>

      {/* Transfer dialog — shown inline when category has products */}
      {showTransfer && (
        <div
          role="dialog"
          aria-label="Trasladar productos antes de eliminar"
          style={{
            background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 8,
            padding: "10px 12px", fontSize: 12, maxWidth: 320,
          }}
        >
          <p style={{ color: "#92400E", marginBottom: 8, fontWeight: 600 }}>
            Esta categoría tiene {productCount} producto{productCount === 1 ? "" : "s"} (incluidos en papelera).
            Elige dónde trasladarlos antes de eliminarla.
          </p>
          {otherCategories.length === 0 ? (
            <p style={{ color: "#a72b38", fontSize: 11 }}>
              No hay otras categorías. Crea una primero.
            </p>
          ) : (
            <>
              <select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                style={{ width: "100%", marginBottom: 8, fontSize: 12 }}
                aria-label="Categoría destino"
              >
                {otherCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={handleTransferConfirm}
                  disabled={isPending || !targetId}
                  className="button small"
                  style={{ fontSize: 11 }}
                >
                  {isPending ? "Trasladando…" : "Trasladar y eliminar"}
                </button>
                <button
                  onClick={() => { setShowTransfer(false); setTransferError(null); }}
                  disabled={isPending}
                  className="button secondary small"
                  style={{ fontSize: 11 }}
                >
                  Cancelar
                </button>
              </div>
            </>
          )}
          {transferError && (
            <p role="alert" style={{ color: "#a72b38", fontSize: 11, marginTop: 6 }}>{transferError}</p>
          )}
        </div>
      )}
    </div>
  );
}
