"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp } from "lucide-react";
import { saveProduct } from "./actions";
import { saveProductControl, type FinanceState } from "@/app/panel/finanzas/actions";
import { useUnsavedChanges, UnsavedAwareLink } from "@/components/unsaved-changes";
import { CropTool } from "@/components/crop-tool";
import type {
  Category,
  Product,
  ProductImage,
  ProductVariant,
  OptionGroup,
  Option,
  VariantInput,
  OptionGroupInput,
  OptionInput,
} from "@/lib/catalog-types";

// ── Local state types ─────────────────────────────────────────

type LocalVariant = { name: string; price_cents: number; is_available: boolean };
type LocalOption = { name: string; price_delta_cents: number; is_available: boolean };
type LocalGroup = {
  name: string;
  min_selections: number;
  max_selections: number;
  options: LocalOption[];
};

function emptyVariant(): LocalVariant {
  return { name: "", price_cents: 0, is_available: true };
}
function emptyGroup(): LocalGroup {
  return { name: "", min_selections: 0, max_selections: 1, options: [] };
}
function emptyOption(): LocalOption {
  return { name: "", price_delta_cents: 0, is_available: true };
}

// ── Props ──────────────────────────────────────────────────────

interface ProductFormProps {
  mode: "new" | "edit";
  categories: Category[];
  defaultCategoryId?: string;
  product?: Product;
  existingImage?: ProductImage;
  existingVariants?: ProductVariant[];
  existingGroups?: (OptionGroup & { options: Option[] })[];
  restaurantId: string;
  stockEnabled?: boolean;
  existingControl?: { cost_cents: number | null; stock_quantity: number | null; stock_alert: number | null };
}

// ── Main component ─────────────────────────────────────────────

export function ProductFormPage({
  mode,
  categories,
  defaultCategoryId,
  product,
  existingImage,
  existingVariants,
  existingGroups,
  restaurantId,
  stockEnabled = false,
  existingControl,
}: ProductFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const { setDirty } = useUnsavedChanges();

  // Basic fields
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [categoryId, setCategoryId] = useState(
    product?.category_id ?? defaultCategoryId ?? (categories[0]?.id ?? ""),
  );
  const [basePrice, setBasePrice] = useState(
    product ? String(product.base_price_cents / 100) : "",
  );
  const [promoPrice, setPromoPrice] = useState(
    product?.promo_price_cents != null
      ? String(product.promo_price_cents / 100)
      : "",
  );
  const [isAvailable, setIsAvailable] = useState(product?.is_available ?? true);
  const [isPublished, setIsPublished] = useState(product?.is_published ?? false);
  const [imageFit, setImageFit] = useState<string>(product?.image_fit ?? "cover");

  // Image upload + crop state
  const [imageFile, setImageFile]       = useState<File | null>(null);   // original to upload
  const [thumbFile, setThumbFile]       = useState<File | null>(null);   // cropped thumbnail
  const [imagePreview, setImagePreview] = useState<string | null>(null); // shown in form
  const [uploadError, setUploadError]   = useState<string | null>(null);
  // cropTarget: when set, CropTool modal is shown
  const [cropTarget, setCropTarget] = useState<{ file?: File; url?: string } | null>(null);

  // Variants — empty array = product uses base price only.
  // Never seed a blank row: the user adds variants explicitly.
  const [variants, setVariants] = useState<LocalVariant[]>(
    existingVariants?.length
      ? existingVariants.map((v) => ({
          name: v.name,
          price_cents: v.price_cents,
          is_available: v.is_available,
        }))
      : [],
  );

  // Option groups
  const [groups, setGroups] = useState<LocalGroup[]>(
    existingGroups?.length
      ? existingGroups.map((g) => ({
          name: g.name,
          min_selections: g.min_selections,
          max_selections: g.max_selections,
          options: g.options.map((o) => ({
            name: o.name,
            price_delta_cents: o.price_delta_cents,
            is_available: o.is_available,
          })),
        }))
      : [],
  );

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    // Open crop tool before committing the file
    setCropTarget({ file });
    // Reset input so the same file can be re-selected
    e.target.value = "";
  }

  function handleCropConfirm(thumb: File) {
    // thumb = cropped 1:1 WebP; imageFile = original (already set via cropTarget.file)
    setThumbFile(thumb);
    if (cropTarget?.file) setImageFile(cropTarget.file);
    setImagePreview(URL.createObjectURL(thumb));
    setCropTarget(null);
    setDirty(true);
  }

  function handleCropSkip() {
    // Use original without crop — card will rely on CSS cover
    if (cropTarget?.file) {
      setImageFile(cropTarget.file);
      setThumbFile(null);
      setImagePreview(URL.createObjectURL(cropTarget.file));
    }
    setCropTarget(null);
    setDirty(true);
  }

  function handleCropExisting() {
    if (!existingImgUrl) return;
    setCropTarget({ url: existingImgUrl });
  }

  function handleCropExistingConfirm(thumb: File) {
    setThumbFile(thumb);
    // No new original; only the thumbnail changes
    setImageFile(null);
    setImagePreview(URL.createObjectURL(thumb));
    setCropTarget(null);
    setDirty(true);
  }

  // ── Variants helpers ──────────────────────────────────────────
  function updateVariant<K extends keyof LocalVariant>(
    i: number,
    key: K,
    value: LocalVariant[K],
  ) {
    setVariants((vs) => vs.map((v, idx) => (idx === i ? { ...v, [key]: value } : v)));
  }
  function removeVariant(i: number) {
    setVariants((vs) => vs.filter((_, idx) => idx !== i));
  }

  // ── Groups helpers ────────────────────────────────────────────
  function updateGroup<K extends keyof LocalGroup>(
    gi: number,
    key: K,
    value: LocalGroup[K],
  ) {
    setGroups((gs) =>
      gs.map((g, idx) => (idx === gi ? { ...g, [key]: value } : g)),
    );
  }
  function updateOption<K extends keyof LocalOption>(
    gi: number,
    oi: number,
    key: K,
    value: LocalOption[K],
  ) {
    setGroups((gs) =>
      gs.map((g, idx) =>
        idx === gi
          ? {
              ...g,
              options: g.options.map((o, oidx) =>
                oidx === oi ? { ...o, [key]: value } : o,
              ),
            }
          : g,
      ),
    );
  }
  function addOptionToGroup(gi: number) {
    setGroups((gs) =>
      gs.map((g, idx) =>
        idx === gi ? { ...g, options: [...g.options, emptyOption()] } : g,
      ),
    );
  }
  function removeOption(gi: number, oi: number) {
    setGroups((gs) =>
      gs.map((g, idx) =>
        idx === gi
          ? { ...g, options: g.options.filter((_, oidx) => oidx !== oi) }
          : g,
      ),
    );
  }
  function removeGroup(gi: number) {
    setGroups((gs) => gs.filter((_, idx) => idx !== gi));
  }

  // ── Submit ────────────────────────────────────────────────────
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Guard against double-submit while transition is in progress.
    if (isPending) return;
    setError(null);
    setSuccess(false);

    const baseCents = Math.round(parseFloat(basePrice) * 100);
    const promoCents = promoPrice
      ? Math.round(parseFloat(promoPrice) * 100)
      : undefined;

    if (!name.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    if (isNaN(baseCents) || baseCents < 0) {
      setError("El precio base debe ser un número positivo.");
      return;
    }
    if (promoCents !== undefined && (isNaN(promoCents) || promoCents >= baseCents)) {
      setError("El precio promocional debe ser menor al precio base.");
      return;
    }
    if (!categoryId) {
      setError("Selecciona una categoría.");
      return;
    }
    // Discard completely blank rows (name="" and price=0) silently.
    // Rows that are partially filled (only name or only price) are errors.
    const filledVariants = variants.filter(
      (v) => v.name.trim() !== "" || v.price_cents !== 0,
    );
    for (let i = 0; i < filledVariants.length; i++) {
      const v = filledVariants[i];
      if (!v.name.trim()) {
        setError(
          filledVariants.length === 1
            ? "La variante debe tener nombre."
            : `La variante ${i + 1} debe tener nombre.`,
        );
        return;
      }
      if (isNaN(v.price_cents) || v.price_cents < 0) {
        setError(`El precio de la variante "${v.name}" debe ser un número válido.`);
        return;
      }
    }
    for (const g of groups) {
      if (!g.name.trim()) {
        setError("Todos los grupos deben tener nombre.");
        return;
      }
      if (g.max_selections < g.min_selections) {
        setError(`El máximo de "${g.name}" no puede ser menor al mínimo.`);
        return;
      }
      for (const o of g.options) {
        if (!o.name.trim()) {
          setError(`Todas las opciones de "${g.name}" deben tener nombre.`);
          return;
        }
      }
    }

    startTransition(async () => {
      let imagePath: string | undefined;
      let thumbPath: string | undefined;
      const productIdForPath = product?.id ?? "new";

      // Upload original image if selected
      if (imageFile) {
        const fd = new FormData();
        fd.append("file", imageFile);
        fd.append("restaurant_id", restaurantId);
        fd.append("product_id", productIdForPath);
        const res = await fetch("/api/menu/upload", { method: "POST", body: fd });
        const json = (await res.json()) as { path?: string; error?: string };
        if (!res.ok || json.error) { setError(json.error ?? "Error al subir la imagen."); return; }
        imagePath = json.path;
      }

      // Upload cropped thumbnail if available (either from new upload or existing image crop)
      if (thumbFile) {
        const fd = new FormData();
        fd.append("file", thumbFile);
        fd.append("restaurant_id", restaurantId);
        fd.append("product_id", productIdForPath);
        fd.append("type", "product_thumb");
        const res = await fetch("/api/menu/upload", { method: "POST", body: fd });
        const json = (await res.json()) as { path?: string; error?: string };
        if (!res.ok || json.error) { setError(json.error ?? "Error al subir miniatura."); return; }
        thumbPath = json.path;
      }

      const result = await saveProduct({
        id: product?.id,
        category_id: categoryId,
        name: name.trim(),
        description: description.trim() || undefined,
        base_price_cents: baseCents,
        promo_price_cents: promoCents,
        is_available: isAvailable,
        is_published: isPublished,
        image_fit: imageFit,
        variants: filledVariants,
        option_groups: groups,
        image_path: imagePath,
        thumb_path: thumbPath,
        old_image_path: imagePath ? existingImage?.storage_path : undefined,
        old_image_id: imagePath ? existingImage?.id : undefined,
        old_thumb_path: thumbPath && !imagePath ? existingImage?.thumbnail_path ?? undefined : undefined,
      });

      if (result.error) {
        setError(result.error);
        setDirty(true); // save failed — restore dirty protection
      } else {
        setSuccess(true);
        setDirty(false); // clear guard before navigating away
        router.push("/panel/menu");
      }
    });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const existingImgUrl = existingImage?.storage_path
    ? `${supabaseUrl}/storage/v1/object/public/product-images/${existingImage.storage_path}`
    : null;

  return (
    <div className="panel-content">
      <form
        onSubmit={handleSubmit}
        // Propagate changes to the shared guard. Image picker
        // calls setDirty(true) directly; other fields go through onChange.
        onChange={() => setDirty(true)}
      >
          {/* ── Datos básicos ── */}
          <div className="dashboard-card" style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, marginBottom: 20 }}>Información básica</h2>

            <div className="field">
              <label htmlFor="p-category">Categoría</label>
              <select
                id="p-category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="p-name">Nombre del producto</label>
              <input
                id="p-name"
                type="text"
                maxLength={150}
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Smash clásica"
              />
            </div>

            <div className="field">
              <label htmlFor="p-desc">Descripción (opcional)</label>
              <input
                id="p-desc"
                type="text"
                maxLength={500}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Breve descripción del producto"
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div className="field">
                <label htmlFor="p-base">Precio base ($)</label>
                <input
                  id="p-base"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={basePrice}
                  onChange={(e) => setBasePrice(e.target.value)}
                  placeholder="6.50"
                />
              </div>
              <div className="field">
                <label htmlFor="p-promo">Precio promo ($, opcional)</label>
                <input
                  id="p-promo"
                  type="number"
                  min="0"
                  step="0.01"
                  value={promoPrice}
                  onChange={(e) => setPromoPrice(e.target.value)}
                  placeholder="5.00"
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: 24, marginTop: 8 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={isAvailable}
                  onChange={(e) => setIsAvailable(e.target.checked)}
                />
                Disponible
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={isPublished}
                  onChange={(e) => setIsPublished(e.target.checked)}
                />
                Publicar en el menú
              </label>
            </div>
          </div>

          {/* ── Imagen ── */}
          <div className="dashboard-card" style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, marginBottom: 12 }}>Fotografía</h2>
            <p className="muted" style={{ fontSize: 12, marginBottom: 14 }}>
              Recomendado 1080 × 1080 px (1:1). JPEG, PNG o WebP · máx. 5 MB.
              Al seleccionar una imagen se abre el recortador para generar la miniatura del catálogo.
            </p>

            {/* Preview row */}
            <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
              {/* Current preview (thumbnail if cropped, else original/existing) */}
              {(imagePreview ?? existingImgUrl) && (
                <div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>
                    {imagePreview ? (thumbFile ? "Miniatura (recortada)" : "Original") : "Imagen actual"}
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagePreview ?? existingImgUrl!}
                    alt="Vista previa"
                    style={{ width: 108, height: 108, objectFit: "cover", borderRadius: 8,
                             display: "block", border: "1px solid var(--border)" }}
                  />
                </div>
              )}
              {/* Show original separately if a crop was made on an existing image */}
              {!imagePreview && existingImgUrl && existingImage?.thumbnail_path && (
                <div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>Original (galería)</div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={existingImgUrl}
                    alt="Original"
                    style={{ width: 108, height: 108, objectFit: "contain", borderRadius: 8,
                             display: "block", border: "1px solid var(--border)", background: "#f5f5f5" }}
                  />
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <label style={{ cursor: "pointer" }}>
                <span className="button secondary small">Seleccionar imagen…</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageChange}
                  style={{ display: "none" }}
                />
              </label>
              {/* Crop existing image (only when there's an image and no pending new one) */}
              {!imageFile && (existingImgUrl || imagePreview) && (
                <button
                  type="button"
                  className="button secondary small"
                  onClick={handleCropExisting}
                >
                  ✂ Recortar miniatura
                </button>
              )}
            </div>
            {uploadError && (
              <p className="auth-error" style={{ marginTop: 8 }}>
                {uploadError}
              </p>
            )}

            {/* Image fit selector — fallback when no crop is available */}
            <div style={{ marginTop: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6 }}>
                Encuadre en tarjeta (sin miniatura recortada)
              </label>
              <select
                value={imageFit}
                onChange={(e) => { setImageFit(e.target.value); setDirty(true); }}
                style={{ fontSize: 13, minWidth: 220 }}
              >
                <option value="cover">Rellenar — llena el cuadro (puede recortar bordes)</option>
                <option value="contain">Completa — muestra el producto sin recortar</option>
              </select>
              <p className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                Si hay miniatura recortada, este ajuste no tiene efecto.
                El modal siempre muestra la fotografía original completa.
              </p>
            </div>
          </div>

          {/* ── Crop tool modal ── */}
          {cropTarget && (
            <CropTool
              file={cropTarget.file}
              url={cropTarget.url}
              onConfirm={cropTarget.file ? handleCropConfirm : handleCropExistingConfirm}
              onSkip={cropTarget.file ? handleCropSkip : undefined}
              onCancel={() => setCropTarget(null)}
            />
          )}

          {/* ── Variantes de precio ── */}
          <div className="dashboard-card" style={{ marginBottom: 16 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <h2 style={{ fontSize: 16 }}>Variantes de precio</h2>
              <button
                type="button"
                className="button secondary small"
                style={{ fontSize: 11 }}
                onClick={() => setVariants((vs) => [...vs, emptyVariant()])}
              >
                + Variante
              </button>
            </div>

            {variants.length === 0 ? (
              <p className="muted" style={{ fontSize: 12, margin: 0 }}>
                Este producto utiliza un único precio (el precio base).
                Añade variantes si ofreces opciones con precios distintos, como Sencilla / Doble.
              </p>
            ) : (
              <>
                <p className="muted" style={{ fontSize: 12, marginBottom: 12 }}>
                  Ej: Sencilla $6.50 / Doble $9.50.
                </p>
                {variants.map((v, i) => (
                  <div
                    key={i}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto auto",
                      gap: 8,
                      marginBottom: 8,
                      alignItems: "center",
                    }}
                  >
                    <input
                      type="text"
                      placeholder="Nombre (ej: Doble)"
                      maxLength={100}
                      value={v.name}
                      onChange={(e) => updateVariant(i, "name", e.target.value)}
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Precio ($)"
                      style={{ width: 110 }}
                      value={v.price_cents ? v.price_cents / 100 : ""}
                      onChange={(e) =>
                        updateVariant(
                          i,
                          "price_cents",
                          Math.round(parseFloat(e.target.value || "0") * 100),
                        )
                      }
                    />
                    <button
                      type="button"
                      onClick={() => removeVariant(i)}
                      aria-label={`Eliminar variante ${v.name || i + 1}`}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--muted)",
                        fontSize: 16,
                        cursor: "pointer",
                        padding: "8px 10px",
                        minWidth: 36,
                        minHeight: 36,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* ── Grupos de opciones ── */}
          <div className="dashboard-card" style={{ marginBottom: 16 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <h2 style={{ fontSize: 16 }}>Grupos de opciones</h2>
              <button
                type="button"
                className="button secondary small"
                style={{ fontSize: 11 }}
                onClick={() => setGroups((gs) => [...gs, emptyGroup()])}
              >
                + Grupo
              </button>
            </div>
            <p className="muted" style={{ fontSize: 12, marginBottom: 16 }}>
              Ej: &ldquo;Elige tu pan&rdquo; (obligatorio), &ldquo;Extras&rdquo; (opcional).
            </p>

            {groups.map((g, gi) => (
              <div
                key={gi}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  padding: 16,
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto auto auto",
                    gap: 8,
                    marginBottom: 12,
                    alignItems: "start",
                  }}
                >
                  <input
                    type="text"
                    placeholder="Nombre del grupo"
                    maxLength={100}
                    value={g.name}
                    onChange={(e) => updateGroup(gi, "name", e.target.value)}
                  />
                  <div className="field" style={{ margin: 0 }}>
                    <label style={{ fontSize: 11 }}>Mín.</label>
                    <input
                      type="number"
                      min="0"
                      style={{ width: 56 }}
                      value={g.min_selections}
                      onChange={(e) =>
                        updateGroup(
                          gi,
                          "min_selections",
                          parseInt(e.target.value || "0"),
                        )
                      }
                    />
                  </div>
                  <div className="field" style={{ margin: 0 }}>
                    <label style={{ fontSize: 11 }}>Máx.</label>
                    <input
                      type="number"
                      min="1"
                      style={{ width: 56 }}
                      value={g.max_selections}
                      onChange={(e) =>
                        updateGroup(
                          gi,
                          "max_selections",
                          parseInt(e.target.value || "1"),
                        )
                      }
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeGroup(gi)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--muted)",
                      fontSize: 16,
                      cursor: "pointer",
                      padding: "18px 8px 8px",
                    }}
                  >
                    ✕
                  </button>
                </div>

                {/* Options */}
                <div style={{ marginLeft: 8 }}>
                  {g.options.map((o, oi) => (
                    <div
                      key={oi}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto auto",
                        gap: 8,
                        marginBottom: 6,
                        alignItems: "center",
                      }}
                    >
                      <input
                        type="text"
                        placeholder="Opción (ej: Brioche)"
                        maxLength={100}
                        value={o.name}
                        onChange={(e) =>
                          updateOption(gi, oi, "name", e.target.value)
                        }
                      />
                      <input
                        type="number"
                        step="0.01"
                        placeholder="+$ recargo"
                        style={{ width: 100 }}
                        value={
                          o.price_delta_cents ? o.price_delta_cents / 100 : ""
                        }
                        onChange={(e) =>
                          updateOption(
                            gi,
                            oi,
                            "price_delta_cents",
                            Math.round(
                              parseFloat(e.target.value || "0") * 100,
                            ),
                          )
                        }
                      />
                      <button
                        type="button"
                        onClick={() => removeOption(gi, oi)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--muted)",
                          fontSize: 14,
                          cursor: "pointer",
                          padding: "4px",
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="text-link"
                    style={{ fontSize: 12 }}
                    onClick={() => addOptionToGroup(gi)}
                  >
                    + Opción
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* ── Submit ── */}
          {error && (
            <p className="auth-error" role="alert" style={{ marginBottom: 16 }}>
              {error}
            </p>
          )}
          {success && (
            <p
              style={{
                color: "#2e7d32",
                fontSize: 13,
                marginBottom: 16,
                padding: "10px 14px",
                background: "#e8f5e9",
                borderRadius: 8,
              }}
            >
              Producto guardado correctamente.
            </p>
          )}

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8 }}>
            <button type="submit" disabled={isPending} className="button">
              {isPending ? "Guardando…" : mode === "new" ? "Crear producto" : "Guardar cambios"}
            </button>
            <UnsavedAwareLink href="/panel/menu" className="button secondary">
              Cancelar
            </UnsavedAwareLink>
          </div>
        </form>

        {/* Stock control block — only in edit mode when stock tracking is enabled */}
        {stockEnabled && product?.id && (
          <ProductControlBlock
            productId={product.id}
            hasVariants={(existingVariants?.length ?? 0) > 0}
            existingControl={existingControl}
          />
        )}
    </div>
  );
}

// ── ProductControlBlock ───────────────────────────────────────

function ProductControlBlock({
  productId,
  hasVariants,
  existingControl,
}: {
  productId: string;
  hasVariants: boolean;
  existingControl?: { cost_cents: number | null; stock_quantity: number | null; stock_alert: number | null };
}) {
  const [open, setOpen] = useState(false);
  const [costVal, setCostVal] = useState(
    existingControl?.cost_cents != null ? String(existingControl.cost_cents / 100) : "",
  );
  const [stockQty, setStockQty] = useState(
    existingControl?.stock_quantity != null ? String(existingControl.stock_quantity) : "",
  );
  const [stockAlert, setStockAlert] = useState(
    existingControl?.stock_alert != null ? String(existingControl.stock_alert) : "",
  );
  const [ctrlPending, startCtrlTransition] = useTransition();
  const [ctrlState, setCtrlState] = useState<FinanceState>({ error: null });

  function handleSaveControl() {
    const costCents = costVal ? Math.round(parseFloat(costVal) * 100) : null;
    const qty       = stockQty ? parseInt(stockQty, 10) : null;
    const alert     = stockAlert ? parseInt(stockAlert, 10) : null;
    startCtrlTransition(async () => {
      const result = await saveProductControl(productId, { cost_cents: costCents, stock_quantity: qty, stock_alert: alert });
      setCtrlState(result);
    });
  }

  return (
    <div className="ctrl-block">
      <button type="button" className="ctrl-block-header" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="ctrl-block-title">Control del producto</span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && (
        <div className="ctrl-block-body">
          {hasVariants ? (
            <p className="panel-info-notice" style={{ marginBottom: 0 }}>
              Este producto tiene variantes. El seguimiento de stock por variante estará disponible próximamente.
            </p>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                <div className="field">
                  <label htmlFor="ctrl-cost">Costo (por unidad)</label>
                  <input id="ctrl-cost" type="number" min="0" step="0.01"
                    value={costVal} onChange={(e) => setCostVal(e.target.value)} placeholder="0.00" />
                  <span className="cfg-field-hint">Costo de adquisición o producción.</span>
                </div>
                <div className="field">
                  <label htmlFor="ctrl-qty">Stock actual</label>
                  <input id="ctrl-qty" type="number" min="0" step="1"
                    value={stockQty} onChange={(e) => setStockQty(e.target.value)} placeholder="0" />
                  <span className="cfg-field-hint">Unidades disponibles.</span>
                </div>
                <div className="field">
                  <label htmlFor="ctrl-alert">Alerta de stock bajo</label>
                  <input id="ctrl-alert" type="number" min="0" step="1"
                    value={stockAlert} onChange={(e) => setStockAlert(e.target.value)} placeholder="5" />
                  <span className="cfg-field-hint">Avisa cuando el stock sea igual o menor.</span>
                </div>
              </div>
              <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 12 }}>
                <button type="button" className="button" disabled={ctrlPending} onClick={handleSaveControl}>
                  {ctrlPending ? "Guardando…" : "Guardar control"}
                </button>
                {ctrlState.error && <span style={{ color: "#dc2626", fontSize: 13 }}>{ctrlState.error}</span>}
                {ctrlState.success && <span style={{ color: "#059669", fontSize: 13 }}>✓ Guardado</span>}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
