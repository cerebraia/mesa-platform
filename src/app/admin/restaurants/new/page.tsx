"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createRestaurant } from "../../actions";

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
  const [error, setError]           = useState<string | null>(null);
  const [name, setName]             = useState("");
  const [slug, setSlug]             = useState("");
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
    <>
      <div className="panel-page-header">
        <div>
          <div className="panel-breadcrumb">
            <Link href="/admin" className="panel-breadcrumb-link">
              <ArrowLeft size={13} />
              Restaurantes
            </Link>
          </div>
          <h1 className="panel-page-title">Nuevo restaurante</h1>
          <p className="panel-page-desc">Registra un nuevo negocio en la plataforma.</p>
        </div>
      </div>

      <div className="panel-content">
        <div style={{ maxWidth: 560 }}>
          <div className="dashboard-card">
            <h2 style={{ fontSize: 14, fontWeight: 600, color: "#667085", textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 20 }}>
              Datos del negocio
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="field" style={{ marginBottom: 16 }}>
                <label>Nombre del restaurante</label>
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
              </div>

              <div className="field" style={{ marginBottom: 16 }}>
                <label>Slug (URL pública)</label>
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
                  <span className="caption" style={{ marginTop: 6, display: "block" }}>
                    Menú en: /r/{slug}
                  </span>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
                <div className="field">
                  <label>Moneda</label>
                  <select name="currency" defaultValue="USD">
                    <option value="USD">USD</option>
                    <option value="VES">VES</option>
                    <option value="COP">COP</option>
                    <option value="MXN">MXN</option>
                    <option value="PEN">PEN</option>
                  </select>
                </div>
                <div className="field">
                  <label>Zona horaria</label>
                  <select name="timezone" defaultValue="America/Caracas">
                    {TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>{tz}</option>
                    ))}
                  </select>
                </div>
              </div>

              {error && (
                <div className="auth-error" role="alert" style={{ marginBottom: 16 }}>
                  {error}
                </div>
              )}

              <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
                <button type="submit" className="button small" disabled={pending}>
                  {pending ? "Creando…" : "Crear restaurante"}
                </button>
                <Link href="/admin" className="button secondary small">
                  Cancelar
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
