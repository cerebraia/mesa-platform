"use client";

import { useActionState, useState, useCallback } from "react";
import { Globe, Search, Image as ImageIcon, X } from "lucide-react";
import { saveSeo, saveConfigImage, removeConfigImage } from "./actions";
import { useUnsavedChanges } from "@/components/unsaved-changes";
import type { RestaurantConfig } from "@/lib/catalog-types";

type Props = {
  restaurantName:  string;
  restaurantSlug:  string;
  config?:         RestaurantConfig;
  supabaseUrl:     string;
  restaurantId:    string;
  /** Canonical public URL — same source of truth as the rest of the panel. */
  catalogUrl:      string;
};

const ASSET_BASE = (url: string) => `${url}/storage/v1/object/public/restaurant-assets`;

function charCount(len: number, lo: number, hi: number) {
  let color = "#9CA3AF";
  if (len > 0 && len < lo) color = "#92400E";
  else if (len >= lo && len <= hi) color = "#065F46";
  else if (len > hi) color = "#a72b38";
  return (
    <span style={{ fontSize: 11, color }}>
      {len} / {lo}–{hi} recomendados
    </span>
  );
}

export function SeoForm({ restaurantName, restaurantSlug, config, supabaseUrl, restaurantId, catalogUrl }: Props) {
  const [state, action, pending] = useActionState(saveSeo, { error: null });
  const { setDirty } = useUnsavedChanges();

  const [title,        setTitle]        = useState(config?.seo_title       ?? "");
  const [desc,         setDesc]         = useState(config?.seo_description ?? "");
  const [indexing,     setIndexing]     = useState(config?.allow_indexing  ?? true);
  const [imgPath,      setImgPath]      = useState(config?.seo_image_path  ?? null);
  const [imgUploading, setImgUploading] = useState(false);
  const [imgError,     setImgError]     = useState<string | null>(null);
  const [imgSuccess,   setImgSuccess]   = useState<string | null>(null);

  // Use the canonical URL passed from the server — same priority logic as the rest of the panel.
  const previewUrl = catalogUrl || `/r/${restaurantSlug}`;
  const previewTitle = title.trim() || restaurantName;
  const previewDesc  = desc.trim()  || config?.description || "";

  const imgUrl = imgPath ? `${ASSET_BASE(supabaseUrl)}/${imgPath}` : null;

  const markDirty = useCallback(() => setDirty(true), [setDirty]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImgError(null); setImgSuccess(null); setImgUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("restaurant_id", restaurantId);
      fd.append("type", "seo_image");
      const res  = await fetch("/api/menu/upload", { method: "POST", body: fd });
      const json = await res.json() as { path?: string; error?: string };
      if (!res.ok || !json.path) { setImgError(json.error ?? "Error al subir la imagen."); return; }
      const result = await saveConfigImage("seo_image_path", json.path);
      if (result.error) { setImgError(result.error); return; }
      setImgPath(json.path);
      setImgSuccess("Imagen actualizada.");
    } catch { setImgError("Error de red al subir la imagen."); }
    finally   { setImgUploading(false); }
  }

  async function handleRemoveImg() {
    setImgError(null); setImgSuccess(null); setImgUploading(true);
    try {
      const result = await removeConfigImage("seo_image_path");
      if (result.error) { setImgError(result.error); return; }
      setImgPath(null);
      setImgSuccess("Imagen eliminada.");
    } catch { setImgError("Error al eliminar la imagen."); }
    finally   { setImgUploading(false); }
  }

  return (
    <form action={action} onChange={markDirty}>
      <input type="hidden" name="allow_indexing" value={indexing ? "true" : "false"} />

      <div className="dashboard-card" style={{ marginBottom: 16 }}>
        <div className="cfg-card-heading">
          <h3 className="cfg-card-title">Posicionamiento en buscadores</h3>
          <p className="cfg-card-desc">
            Cómo aparece tu catálogo en Google, Bing y otros buscadores.
            Son recomendaciones — los buscadores pueden ignorar o reescribir estos valores.
          </p>
        </div>

        {/* Title */}
        <div className="field">
          <label htmlFor="seo-title">
            Título <span className="cfg-field-hint" style={{ display: "inline" }}>(Meta Title)</span>
          </label>
          <input
            id="seo-title"
            name="seo_title"
            type="text"
            maxLength={120}
            placeholder={restaurantName}
            value={title}
            onChange={e => { setTitle(e.target.value); markDirty(); }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 2 }}>
            <span className="cfg-field-hint">Vacío usa el nombre del negocio.</span>
            {charCount(title.length, 50, 60)}
          </div>
        </div>

        {/* Description */}
        <div className="field">
          <label htmlFor="seo-desc">
            Descripción <span className="cfg-field-hint" style={{ display: "inline" }}>(Meta Description)</span>
          </label>
          <textarea
            id="seo-desc"
            name="seo_description"
            rows={3}
            maxLength={320}
            placeholder={config?.description ?? "Describe brevemente tu negocio para los resultados de búsqueda."}
            value={desc}
            onChange={e => { setDesc(e.target.value); markDirty(); }}
            style={{ resize: "vertical", width: "100%", padding: "8px 12px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 13, fontFamily: "inherit", lineHeight: 1.5 }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 2 }}>
            <span className="cfg-field-hint">Vacío usa la descripción del negocio si existe.</span>
            {charCount(desc.length, 140, 160)}
          </div>
        </div>

        {/* Search preview */}
        <div className="field">
          <label style={{ marginBottom: 8, display: "block" }}>
            Vista previa aproximada
          </label>
          <div className="seo-preview">
            <div className="seo-preview-url">
              <Search size={11} aria-hidden="true" style={{ flexShrink: 0 }} />
              <span>{previewUrl}</span>
            </div>
            <div className="seo-preview-title">{previewTitle}</div>
            {previewDesc ? (
              <div className="seo-preview-desc">{previewDesc}</div>
            ) : (
              <div className="seo-preview-desc" style={{ color: "#9CA3AF" }}>
                Añade una descripción para que aparezca aquí.
              </div>
            )}
          </div>
          <span className="cfg-field-hint" style={{ marginTop: 6, display: "block" }}>
            El aspecto real depende del buscador. Google puede reescribir títulos y descripciones.
          </span>
        </div>
      </div>

      {/* OG Image */}
      <div className="dashboard-card" style={{ marginBottom: 16 }}>
        <div className="cfg-card-heading">
          <h3 className="cfg-card-title">Imagen al compartir</h3>
          <p className="cfg-card-desc">
            Aparece al compartir el enlace en WhatsApp, Instagram, Twitter, etc. (Open Graph).
            Si no hay imagen se usa la portada del catálogo.
            Formato recomendado: 1 200 × 630 px. Máximo 5 MB, JPEG/PNG/WebP.
          </p>
        </div>

        {imgError   && <p role="alert" className="auth-error" style={{ marginBottom: 12 }}>{imgError}</p>}
        {imgSuccess && <p className="cfg-success" style={{ marginBottom: 12 }}>✓ {imgSuccess}</p>}

        {imgUrl && !imgUploading ? (
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imgUrl}
              alt="Imagen para compartir"
              style={{ width: 200, height: 105, objectFit: "cover", borderRadius: 8, border: "1px solid #E5E7EB", flexShrink: 0 }}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button type="button" className="cfg-image-btn cfg-image-btn--remove" onClick={handleRemoveImg} disabled={imgUploading}>
                <X size={12} aria-hidden="true" /> Quitar imagen
              </button>
              <label className="cfg-image-btn" style={{ cursor: "pointer" }}>
                <ImageIcon size={12} aria-hidden="true" /> Reemplazar
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleUpload} disabled={imgUploading} />
              </label>
            </div>
          </div>
        ) : (
          <label className="seo-upload-area" aria-label="Seleccionar imagen para compartir">
            <Globe size={22} strokeWidth={1.5} aria-hidden="true" style={{ color: "#9CA3AF" }} />
            <span>{imgUploading ? "Subiendo…" : "Seleccionar imagen para compartir"}</span>
            <span className="cfg-field-hint">JPEG, PNG o WebP hasta 5 MB</span>
            <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleUpload} disabled={imgUploading} />
          </label>
        )}
      </div>

      {/* Indexing */}
      <div className="dashboard-card" style={{ marginBottom: 16 }}>
        <div className="cfg-toggle-group">
          <div className="cfg-toggle-row">
            <div>
              <div className="cfg-toggle-label">Permitir indexación en buscadores</div>
              <div className="cfg-toggle-desc">
                Desactívalo para negocios de prueba o privados.
                Cuando está desactivado, los buscadores ven una instrucción de no indexar.
              </div>
            </div>
            <label className="seo-switch" aria-label={indexing ? "Indexación activada" : "Indexación desactivada"}>
              <input
                type="checkbox"
                checked={indexing}
                onChange={e => { setIndexing(e.target.checked); markDirty(); }}
              />
              <span className="seo-switch-track" />
            </label>
          </div>
        </div>
      </div>

      <div className="panel-info-notice" style={{ marginBottom: 20 }}>
        Los cambios en buscadores pueden tardar días o semanas.
        Para acelerar, envía la URL en{" "}
        <a href="https://search.google.com/search-console" target="_blank" rel="noopener noreferrer">
          Google Search Console
        </a>.
      </div>

      {state.error && <p role="alert" className="auth-error" style={{ marginBottom: 16 }}>{state.error}</p>}
      {!state.error && state.success && <p className="cfg-success" style={{ marginBottom: 16 }}>✓ Configuración SEO guardada.</p>}

      <button type="submit" className="button" disabled={pending} style={{ minWidth: 160 }}>
        {pending ? "Guardando…" : "Guardar SEO"}
      </button>
    </form>
  );
}
