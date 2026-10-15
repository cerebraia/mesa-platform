"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createCategory, updateCategory, type CategoryState } from "./actions";
import type { Category } from "@/lib/catalog-types";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="button">
      {pending ? "Guardando…" : label}
    </button>
  );
}

const initial: CategoryState = { error: null };

// Renders inside PanelShell — no outer layout wrapper.
// The parent page provides the dashboard-top bar with the back link.
export function CategoryFormPage({
  mode,
  category,
}: {
  mode: "new" | "edit";
  category?: Category;
}) {
  const action = mode === "new" ? createCategory : updateCategory;
  const [state, formAction] = useActionState(action, initial);

  return (
    <div className="dashboard-content">
      <div className="dashboard-heading" style={{ marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28 }}>
            {mode === "new" ? "Nueva categoría" : "Editar categoría"}
          </h1>
        </div>
      </div>

      <div className="settings-card">
        <form action={formAction}>
          {mode === "edit" && category && (
            <input type="hidden" name="id" value={category.id} />
          )}

          <label className="field-label">
            Nombre de la categoría
            <input
              name="name"
              type="text"
              maxLength={100}
              required
              defaultValue={category?.name ?? ""}
              placeholder="Ej: Hamburguesas"
              autoFocus
            />
          </label>

          {state.error && (
            <p className="auth-error" role="alert" style={{ marginTop: 12 }}>
              {state.error}
            </p>
          )}

          <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
            <SubmitButton
              label={mode === "new" ? "Crear categoría" : "Guardar cambios"}
            />
            <Link href="/panel/menu" className="button secondary">
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
