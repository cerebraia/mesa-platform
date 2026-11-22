"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { adminCreateCategory } from "../../../actions";

export function AdminCategoryFormClient({
  restaurantId,
  returnPath,
}: {
  restaurantId: string;
  returnPath: string;
}) {
  const [name, setName] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("El nombre es obligatorio."); return; }
    setError(null);
    start(async () => {
      const result = await adminCreateCategory(restaurantId, { name: name.trim() });
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
      <label className="field-label" style={{ display: "block", marginBottom: 20 }}>
        Nombre de la categoría
        <input
          type="text"
          maxLength={100}
          required
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Hamburguesas"
          style={{ display: "block", width: "100%", marginTop: 6 }}
        />
      </label>
      {error && (
        <p className="auth-error" role="alert" style={{ marginBottom: 12 }}>
          {error}
        </p>
      )}
      <div style={{ display: "flex", gap: 10 }}>
        <button type="submit" disabled={pending} className="button">
          {pending ? "Guardando…" : "Crear categoría"}
        </button>
        <Link href={returnPath} className="button secondary">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
