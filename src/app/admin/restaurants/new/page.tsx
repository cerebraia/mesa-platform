"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createRestaurant } from "../../actions";
import { Brand } from "@/components/brand";
import { SignOutButton } from "@/components/sign-out-button";

const TIMEZONES = [
  "America/Caracas",
  "America/Bogota",
  "America/Lima",
  "America/Santiago",
  "America/Mexico_City",
  "America/New_York",
  "America/Los_Angeles",
  "UTC",
];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

export default function NewRestaurantPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);

  function handleNameChange(v: string) {
    setName(v);
    if (!slugEdited) setSlug(slugify(v));
  }

  function handleSlugChange(v: string) {
    setSlug(v.toLowerCase().replace(/[^a-z0-9-]/g, ""));
    setSlugEdited(true);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await createRestaurant(fd);
      if (result.error) {
        setError(result.error);
      } else {
        const id = (result.data as Record<string, string>).id;
        router.push(`/admin/restaurants/${id}`);
      }
    });
  }

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <Brand />
        <div className="workspace">
          <div className="avatar">AD</div>
          <div>
            <b style={{ fontSize: 12, display: "block" }}>Administración</b>
            <span className="muted" style={{ fontSize: 11 }}>Platform Admin</span>
          </div>
        </div>
        <nav aria-label="Admin">
          <Link
            href="/admin"
            style={{
              display: "flex", gap: 14, textAlign: "left", border: 0,
              background: "var(--soft)", color: "var(--purple)",
              padding: "12px 14px", borderRadius: 9, fontSize: 13,
              textDecoration: "none", fontWeight: 600,
            }}
          >
            Restaurantes
          </Link>
          <Link
            href="/admin/planes"
            style={{
              display: "flex", gap: 14, textAlign: "left", border: 0,
              background: "none", color: "var(--muted)",
              padding: "12px 14px", borderRadius: 9, fontSize: 13,
              textDecoration: "none",
            }}
          >
            Planes
          </Link>
        </nav>
        <div className="sidebar-bottom">
          <SignOutButton />
        </div>
      </aside>

      <main className="dashboard-main">
        <div className="dashboard-top">
          <span>ADMINISTRACIÓN DE PLATAFORMA</span>
          <Link href="/admin" className="muted" style={{ fontSize: 11, textDecoration: "none" }}>
            ← Volver
          </Link>
        </div>

        <div className="dashboard-content">
          <div className="dashboard-heading">
            <div>
              <h1>Nuevo restaurante</h1>
              <p>Crea un negocio en la plataforma.</p>
            </div>
          </div>

          <div className="settings-card">
            <form onSubmit={handleSubmit}>
              <label className="field-label">
                Nombre del restaurante
                <input
                  name="name"
                  type="text"
                  required
                  minLength={2}
                  maxLength={100}
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Ej. Restaurante Ejemplo"
                />
              </label>

              <label className="field-label" style={{ marginTop: 16 }}>
                Slug (URL pública)
                <input
                  name="slug"
                  type="text"
                  required
                  minLength={3}
                  maxLength={63}
                  value={slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder="restaurante-ejemplo"
                />
                {slug && (
                  <span className="caption" style={{ marginTop: 4 }}>
                    Menú en: /r/{slug}
                  </span>
                )}
              </label>

              <label className="field-label" style={{ marginTop: 16 }}>
                Moneda
                <select name="currency" defaultValue="USD">
                  <option value="USD">USD</option>
                  <option value="VES">VES</option>
                  <option value="COP">COP</option>
                  <option value="MXN">MXN</option>
                  <option value="PEN">PEN</option>
                </select>
              </label>

              <label className="field-label" style={{ marginTop: 16 }}>
                Zona horaria
                <select name="timezone" defaultValue="America/Caracas">
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
              </label>

              {error && (
                <div className="auth-error" role="alert" style={{ marginTop: 16 }}>
                  {error}
                </div>
              )}

              <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
                <button type="submit" className="button" disabled={pending}>
                  {pending ? "Creando…" : "Crear restaurante"}
                </button>
                <Link href="/admin" className="button secondary">
                  Cancelar
                </Link>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
