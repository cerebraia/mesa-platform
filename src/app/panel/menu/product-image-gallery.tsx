"use client";

// Gallery editor for the product form (edit mode only).
// Each image operation (add / remove / reorder) is immediate — it hits the
// server without re-submitting the whole product form, so saving name, price
// or variants never touches the gallery.

import { useState, useCallback, useRef } from "react";
import { CropTool } from "@/components/crop-tool";
import { addProductImage, removeProductImage, reorderProductImages } from "./actions";
import type { ProductImage } from "@/lib/catalog-types";

interface Props {
  productId:    string;
  restaurantId: string;
  initialImages: ProductImage[];
  supabaseUrl:   string;
}

const IMG_BASE = (url: string) => `${url}/storage/v1/object/public/product-images`;

export function ProductImageGallery({ productId, restaurantId, initialImages, supabaseUrl }: Props) {
  const imgBase = IMG_BASE(supabaseUrl);

  const [images,      setImages]      = useState<ProductImage[]>(initialImages);
  const [cropFile,    setCropFile]    = useState<File | null>(null);
  const [adding,      setAdding]      = useState(false);
  const [addErr,      setAddErr]      = useState<string | null>(null);
  const [removingId,  setRemovingId]  = useState<string | null>(null);
  const [removeErrors, setRemoveErrors] = useState<Record<string, string>>({});
  const [reorderErr,  setReorderErr]  = useState<string | null>(null);

  // Pending files from the file picker → crop tool flow
  const pendingOriginal = useRef<File | null>(null);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setAddErr(null);
    pendingOriginal.current = file;
    setCropFile(file);
  }

  async function handleCropConfirm(thumb: File) {
    const original = pendingOriginal.current;
    setCropFile(null);
    pendingOriginal.current = null;
    if (!original) return;
    await doUploadAndAdd(original, thumb);
  }

  async function handleCropSkip() {
    const original = pendingOriginal.current;
    setCropFile(null);
    pendingOriginal.current = null;
    if (!original) return;
    await doUploadAndAdd(original, null);
  }

  async function doUploadAndAdd(originalFile: File, thumbFile: File | null) {
    setAdding(true);
    setAddErr(null);
    try {
      // Upload original
      const fd1 = new FormData();
      fd1.append("file", originalFile);
      fd1.append("restaurant_id", restaurantId);
      fd1.append("product_id", productId);
      const r1 = await fetch("/api/menu/upload", { method: "POST", body: fd1 });
      const j1 = await r1.json() as { path?: string; error?: string };
      if (!r1.ok || !j1.path) { setAddErr(j1.error ?? "Error al subir la imagen."); return; }

      // Upload thumbnail if we have one
      let thumbPath: string | null = null;
      if (thumbFile) {
        const fd2 = new FormData();
        fd2.append("file", thumbFile);
        fd2.append("restaurant_id", restaurantId);
        fd2.append("product_id", productId);
        fd2.append("type", "product_thumb");
        const r2 = await fetch("/api/menu/upload", { method: "POST", body: fd2 });
        const j2 = await r2.json() as { path?: string; error?: string };
        if (r2.ok && j2.path) thumbPath = j2.path;
        // Thumb failure is non-fatal — original still usable
      }

      const result = await addProductImage(productId, j1.path, thumbPath);
      if (result.error) { setAddErr(result.error); return; }
      if (result.image) setImages((imgs) => [...imgs, result.image!]);
    } catch {
      setAddErr("Error de red. Inténtalo de nuevo.");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(imageId: string) {
    if (removingId) return;
    setRemovingId(imageId);
    setRemoveErrors((e) => { const n = { ...e }; delete n[imageId]; return n; });
    const result = await removeProductImage(imageId);
    setRemovingId(null);
    if (result.error) {
      setRemoveErrors((e) => ({ ...e, [imageId]: result.error! }));
    } else {
      setImages((imgs) => imgs.filter((img) => img.id !== imageId));
    }
  }

  async function moveImage(idx: number, direction: -1 | 1) {
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= images.length) return;
    const reordered = [...images];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    setImages(reordered); // optimistic
    setReorderErr(null);
    const result = await reorderProductImages(productId, reordered.map((img) => img.id));
    if (result.error) {
      setImages(images); // revert
      setReorderErr(result.error);
    }
  }

  return (
    <>
      <div className="dashboard-card" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>Fotografías</h2>
        <p className="muted" style={{ fontSize: 12, marginBottom: 14 }}>
          La primera imagen es la principal del catálogo.
          JPEG, PNG o WebP · máx. 5 MB por foto.
        </p>

        {/* Gallery strip */}
        {images.length > 0 && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            {images.map((img, idx) => {
              const src = img.thumbnail_path
                ? `${imgBase}/${img.thumbnail_path}`
                : `${imgBase}/${img.storage_path}`;
              const err = removeErrors[img.id];
              return (
                <div key={img.id} style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  {/* Image thumbnail */}
                  <div style={{ position: "relative", width: 90, height: 90 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt={img.alt_text ?? `Foto ${idx + 1}`}
                      style={{
                        width: 90, height: 90,
                        objectFit: "cover",
                        borderRadius: 8,
                        border: idx === 0 ? "2px solid var(--purple, #703BE6)" : "1px solid var(--border)",
                        display: "block",
                      }}
                    />
                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={() => handleRemove(img.id)}
                      disabled={!!removingId}
                      aria-label={`Quitar foto ${idx + 1}`}
                      style={{
                        position: "absolute", top: -6, right: -6,
                        width: 20, height: 20, borderRadius: "50%",
                        background: "#a72b38", color: "#fff",
                        border: "none", cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, fontWeight: 700, lineHeight: 1,
                        opacity: removingId === img.id ? 0.6 : 1,
                      }}
                    >
                      ×
                    </button>
                  </div>

                  {/* Primary badge / reorder */}
                  <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                    {idx === 0 ? (
                      <span style={{ fontSize: 9, fontWeight: 700, color: "var(--purple, #703BE6)", textTransform: "uppercase", letterSpacing: 0.3 }}>
                        Principal
                      </span>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => moveImage(idx, -1)}
                          disabled={!!removingId}
                          aria-label={`Mover foto ${idx + 1} hacia la izquierda`}
                          style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 3px", fontSize: 11, color: "#667085" }}
                        >
                          ←
                        </button>
                        <span style={{ fontSize: 10, color: "#9CA3AF" }}>{idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => moveImage(idx, 1)}
                          disabled={!!removingId || idx === images.length - 1}
                          aria-label={`Mover foto ${idx + 1} hacia la derecha`}
                          style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 3px", fontSize: 11, color: "#667085" }}
                        >
                          →
                        </button>
                      </>
                    )}
                  </div>

                  {err && (
                    <p role="alert" style={{ fontSize: 10, color: "#a72b38", maxWidth: 90, textAlign: "center", margin: 0 }}>
                      {err}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Add photo */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ cursor: adding ? "not-allowed" : "pointer" }}>
            <span className="button secondary small" style={{ opacity: adding ? 0.6 : 1 }}>
              {adding ? "Subiendo…" : images.length === 0 ? "Seleccionar imagen…" : "+ Añadir foto"}
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileSelect}
              disabled={adding}
              style={{ display: "none" }}
            />
          </label>
          <span className="muted" style={{ fontSize: 11 }}>
            {images.length === 0
              ? "Aún no hay fotos."
              : images.length === 1
              ? "1 foto"
              : `${images.length} fotos`}
          </span>
        </div>

        {addErr && <p role="alert" className="auth-error" style={{ marginTop: 8 }}>{addErr}</p>}
        {reorderErr && <p role="alert" className="auth-error" style={{ marginTop: 8 }}>{reorderErr}</p>}
      </div>

      {/* Crop tool */}
      {cropFile && (
        <CropTool
          file={cropFile}
          onConfirm={handleCropConfirm}
          onSkip={handleCropSkip}
          onCancel={() => { setCropFile(null); pendingOriginal.current = null; }}
        />
      )}
    </>
  );
}
