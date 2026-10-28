"use client";

import { useTransition, useState } from "react";
import { LayoutGrid, ClipboardList } from "lucide-react";
import { selectAndGo } from "./actions";
import type { MemberRole } from "@/lib/db-types";

const ROLE_LABEL: Record<MemberRole, string> = {
  owner:     "Propietario",
  attention: "Atención",
  kitchen:   "Cocina",
};

export type BusinessOption = {
  restaurantId:   string;
  restaurantName: string;
  role:           MemberRole;
  ordersEnabled:  boolean;
};

export function SelectorClient({
  options,
  currentRestaurantId,
}: {
  options: BusinessOption[];
  currentRestaurantId: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSelect(id: string) {
    if (pending) return;
    setError(null);
    setSelectingId(id);

    startTransition(async () => {
      // selectAndGo returns { error } on real failures.
      // On success it calls redirect(), which navigates the router and never
      // returns to this code — so we only reach the lines below on failure.
      const result = await selectAndGo(id);

      // result is defined only when there was a validation / persistence error.
      // NEXT_REDIRECT is never returned; it propagates through the framework.
      setSelectingId(null);
      setError(result?.error ?? "No se pudo seleccionar el negocio. Inténtalo de nuevo.");
    });
  }

  return (
    <div>
      {error && (
        <div className="sbx-error" role="alert">
          {error}
          <button
            className="sbx-error-dismiss"
            onClick={() => setError(null)}
            aria-label="Cerrar error"
          >
            ✕
          </button>
        </div>
      )}

      <div className="sbx-grid">
        {options.map((opt) => {
          const isCurrent   = currentRestaurantId === opt.restaurantId;
          const isSelecting = selectingId === opt.restaurantId;
          const isDisabled  = pending && !isSelecting;
          const initials    = opt.restaurantName.slice(0, 2).toUpperCase();
          const typeLabel   = opt.ordersEnabled ? "Con pedidos" : "Solo catálogo";
          const TypeIcon    = opt.ordersEnabled ? ClipboardList : LayoutGrid;

          return (
            <button
              key={opt.restaurantId}
              className={`sbx-card${isSelecting ? " sbx-card--loading" : ""}${isCurrent ? " sbx-card--current" : ""}${isDisabled ? " sbx-card--disabled" : ""}`}
              onClick={() => handleSelect(opt.restaurantId)}
              disabled={isDisabled}
              aria-busy={isSelecting}
              aria-label={`Administrar ${opt.restaurantName}${isCurrent ? " (activo)" : ""}`}
              aria-pressed={isCurrent}
            >
              <div className="sbx-card-avatar" aria-hidden="true">
                {isSelecting ? (
                  <span className="sbx-spinner" aria-hidden="true" />
                ) : (
                  initials
                )}
              </div>
              <div className="sbx-card-info">
                <span className="sbx-card-name">{opt.restaurantName}</span>
                <span className="sbx-card-meta">
                  <TypeIcon size={11} aria-hidden="true" />
                  {typeLabel} · {ROLE_LABEL[opt.role]}
                </span>
              </div>
              {isSelecting && (
                <span className="sbx-card-status" aria-live="polite">
                  Abriendo negocio…
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
