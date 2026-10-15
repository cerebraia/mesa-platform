"use client";

import { useState, useTransition, useEffect } from "react";
import { saveProduct } from "./actions";
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
}: ProductFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [dirty, setDirty]   = useState(false);

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

  // Image
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Variants
  const [variants, setVariants] = useState<LocalVariant[]>(
    existingVariants?.length
      ? existingVariants.map((v) => ({
          name: v.name,
          price_cents: v.price_cents,
          is_available: v.is_available,
        }))
      : [emptyVariant()],
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

  // Warn on tab close / reload when there are unsaved changes
  useEffect(() => {
    if (!dirty || success) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty, success]);

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setImageFile(file);
    setUploadError(null);
    setDirty(true);
    if (file) {
      setImagePreview(URL.createObjectURL(file));
    } else {
      setImagePreview(null);
    }
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
    for (const v of variants) {
      if (!v.name.trim()) {
        setError("Todas las variantes deben tener nombre.");
        return;
      }
      if (isNaN(v.price_cents) || v.price_cents < 0) {
        setError("El precio de cada variante debe ser válido.");
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

      // Upload image if selected
      if (imageFile) {
        const productIdForPath = product?.id ?? "new";
        const fd = new FormData();
        fd.append("file", imageFile);
        fd.append("restaurant_id", restaurantId);
        fd.append("product_id", productIdForPath);

        const res = await fetch("/api/menu/upload", { method: "POST", body: fd });
        const json = (await res.json()) as { path?: string; error?: string };
        if (!res.ok || json.error) {
          setError(json.error ?? "Error al subir la imagen.");
          return;
        }
        imagePath = json.path;
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
        variants,
        option_groups: groups,
        image_path: imagePath,
        old_image_path: imagePath ? existingImage?.storage_path : undefined,
        old_image_id: imagePath ? existingImage?.id : undefined,
      });

      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        window.location.href = "/panel/menu";
      }
    });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const existingImgUrl = existingImage?.storage_path
    ? `${supabaseUrl}/storage/v1/object/public/product-images/${existingImage.storage_path}`
    : null;

  return (
    <div className="dashboard-content">
      <div className="dashboard-heading" style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28 }}>
          {mode === "new" ? "Nuevo producto" : "Editar producto"}
        </h1>
      </div>

      <form onSubmit={handleSubmit} onChange={() => setDirty(true)}>
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
            <h2 style={{ fontSize: 16, marginBottom: 20 }}>Fotografía</h2>
            <p
              className="muted"
              style={{ fontSize: 12, marginBottom: 16 }}
            >
              JPEG, PNG o WebP · máx. 5 MB. La imagen anterior se conserva hasta
              confirmar el guardado.
            </p>

            {(imagePreview ?? existingImgUrl) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imagePreview ?? existingImgUrl!}
                alt="Vista previa"
                style={{
                  width: 120,
                  height: 120,
                  objectFit: "cover",
                  borderRadius: 8,
                  marginBottom: 16,
                  display: "block",
                }}
              />
            )}

            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleImageChange}
              style={{ fontSize: 13 }}
            />
            {uploadError && (
              <p className="auth-error" style={{ marginTop: 8 }}>
                {uploadError}
              </p>
            )}
          </div>

          {/* ── Variantes de precio ── */}
          <div className="dashboard-card" style={{ marginBottom: 16 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
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
            <p className="muted" style={{ fontSize: 12, marginBottom: 16 }}>
              Ej: Sencilla $6.50 / Doble $9.50. Si hay solo una, será el precio
              base.
            </p>

            {variants.map((v, i) => (
              <div
                key={i}
                className="variant-row"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto auto",
                  gap: 8,
                  marginBottom: 8,
                  alignItems: "start",
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
                  disabled={variants.length === 1}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--muted)",
                    fontSize: 16,
                    cursor: "pointer",
                    padding: "10px 8px",
                  }}
                  title="Eliminar variante"
                >
                  ✕
                </button>
              </div>
            ))}
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
            <a href="/panel/menu" className="button secondary">
              Cancelar
            </a>
          </div>
        </form>
    </div>
  );
}
