"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { adminUpdateCategory } from "../../../../actions";

export function AdminEditCategoryFormClient({
  restaurantId,
  category,
  returnPath,
}: {
  restaurantId: string;
  category: { id: string; name: string; is_active: boolean };
  returnPath: string;
}) {
  const [name, setName] = useState(category.name);
  const [isActive, setIsActive] = useState(category.is_active);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("El nombre es obligatorio."); return; }
    setError(null);
    start(async () => {
      const result = await adminUpdateCategory(restaurantId, category.id, { name: name.trim(), is_active: isActive });
      if (result.error) {
        setError(result.error);
      } else {
        router.push(returnPath);
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <label className="field-label" style={{ display: "block", marginBottom: 16 }}>
        Nombre de la categoría
        <input
          type="text"
          maxLength={100}
          required
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ display: "block", width: "100%", marginTop: 6 }}
        />
      </label>
      <label
        style={{
          display: "flex", alignItems: "center", gap: 8,
          fontSize: 13, marginBottom: 24, cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          style={{ width: 16, height: 16, flexShrink: 0 }}
        />
        Categoría activa (visible en el catálogo público)
      </label>
      {error && (
        <p className="auth-error" role="alert" style={{ marginBottom: 12 }}>
          {error}
        </p>
      )}
      <div style={{ display: "flex", gap: 10 }}>
        <button type="submit" disabled={pending} className="button">
          {pending ? "Guardando…" : "Guardar cambios"}
        </button>
        <Link href={returnPath} className="button secondary">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
