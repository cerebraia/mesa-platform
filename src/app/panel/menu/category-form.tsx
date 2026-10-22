"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { createCategory, updateCategory, type CategoryState } from "./actions";
import { useUnsavedChanges, UnsavedAwareLink } from "@/components/unsaved-changes";
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

export function CategoryFormPage({
  mode,
  category,
}: {
  mode: "new" | "edit";
  category?: Category;
}) {
  const action = mode === "new" ? createCategory : updateCategory;
  const [state, formAction] = useActionState(action, initial);
  const { setDirty } = useUnsavedChanges();

  // On action error, restore dirty flag (save failed; user still has changes).
  // On success the Server Action calls redirect(), so this effect only fires
  // when the action returns with an error (no redirect).
  useEffect(() => {
    if (state.error) {
      setDirty(true);
    }
  }, [state.error, setDirty]);

  return (
    <div className="panel-content">
      <div className="settings-card">
        <form
          action={formAction}
          // Optimistically clear dirty on submit.
          // If the action returns an error, the useEffect above restores it.
          onSubmit={() => setDirty(false)}
          // Mark dirty on any field change.
          onChange={() => setDirty(true)}
        >
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
            <UnsavedAwareLink href="/panel/menu" className="button secondary">
              Cancelar
            </UnsavedAwareLink>
          </div>
        </form>
      </div>
    </div>
  );
}
