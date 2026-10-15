"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Brand } from "@/components/brand";
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
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <header
        className="container"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          minHeight: 64,
          borderBottom: "1px solid var(--border)",
        }}
      >
        <Brand />
        <Link href="/panel/menu" className="text-link" style={{ fontSize: 13 }}>
          ← Volver al menú
        </Link>
      </header>

      <div className="container" style={{ maxWidth: 560, paddingTop: 48 }}>
        <h1 style={{ fontSize: 24, letterSpacing: -0.5, marginBottom: 32 }}>
          {mode === "new" ? "Nueva categoría" : "Editar categoría"}
        </h1>

        <form action={formAction} className="settings-card">
          {mode === "edit" && category && (
            <input type="hidden" name="id" value={category.id} />
          )}

          <div className="field">
            <label htmlFor="name">Nombre de la categoría</label>
            <input
              id="name"
              name="name"
              type="text"
              maxLength={100}
              required
              defaultValue={category?.name ?? ""}
              placeholder="Ej: Hamburguesas"
              autoFocus
            />
          </div>

          {state.error && (
            <p className="auth-error" role="alert">
              {state.error}
            </p>
          )}

          <SubmitButton
            label={mode === "new" ? "Crear categoría" : "Guardar cambios"}
          />
        </form>
      </div>
    </div>
  );
}
