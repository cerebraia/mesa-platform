"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import type {
  PublicCategory,
  PublicRestaurantConfig,
  PublicDeliveryZone,
  PublicPaymentMethod,
  CartEntry,
  CartOption,
  PlaceOrderRequest,
  PlaceOrderResponse,
  PriceChangedResponse,
} from "@/lib/catalog-types";

// ── Types ─────────────────────────────────────────────────────

interface Restaurant {
  id: string; name: string; slug: string; status: string; currency: string;
}

interface AnonProduct {
  id: string; restaurant_id: string; category_id: string;
  name: string; description: string | null;
  base_price_cents: number; promo_price_cents: number | null; position: number;
  // null → cover (default). 'contain' → show full product without cropping.
  image_fit: string | null;
  product_images: Array<{ id: string; storage_path: string; thumbnail_path?: string | null; alt_text: string | null; position: number }>;
  product_variants: Array<{ id: string; name: string; price_cents: number; position: number }>;
  option_groups: Array<{
    id: string; name: string; min_selections: number; max_selections: number; position: number;
    options: Array<{ id: string; name: string; price_delta_cents: number; position: number }>;
  }>;
}

interface Props {
  restaurant: Restaurant;
  config: PublicRestaurantConfig | null;
  isOpen: boolean;
  categories: PublicCategory[];
  deliveryZones: PublicDeliveryZone[];
  paymentMethods: PublicPaymentMethod[];
  supabaseUrl: string;
  ordersEnabled: boolean;
}

type Step = "menu" | "checkout";

// ── Helpers ───────────────────────────────────────────────────

function money(cents: number, currency = "USD") {
  return new Intl.NumberFormat("es-VE", { style: "currency", currency }).format(cents / 100);
}

function primaryTint(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  if (isNaN(r)) return "transparent";
  return `rgba(${r},${g},${b},${alpha})`;
}

function cartKey(productId: string, variantId: string | null, options: CartOption[]): string {
  const sorted = [...options]
    .sort((a, b) => a.groupId.localeCompare(b.groupId) || a.optionId.localeCompare(b.optionId))
    .map((o) => `${o.groupId}:${o.optionId}`)
    .join(",");
  return `${productId}:${variantId ?? ""}:${sorted}`;
}

function generateIdempotencyKey(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function darkenHex(hex: string, amount: number): string {
  const r = Math.round(parseInt(hex.slice(1, 3), 16) * (1 - amount));
  const g = Math.round(parseInt(hex.slice(3, 5), 16) * (1 - amount));
  const b = Math.round(parseInt(hex.slice(5, 7), 16) * (1 - amount));
  if (isNaN(r)) return hex;
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

// ── Icons ─────────────────────────────────────────────────────

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  );
}

function WaIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 448 512" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z"/>
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function ImgPlaceholder() {
  return (
    <div className="pd-img-placeholder" aria-hidden="true">
      <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    </div>
  );
}

function CardImgPlaceholder() {
  return (
    <div className="mc-card-img-ph" aria-hidden="true">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    </div>
  );
}

// ── Product Card — imagen cuadrada arriba, texto abajo ────────

function ProductCard({
  product, imgBase, primaryColor, currency, ordersEnabled, showDesc, onOpen,
}: {
  product: AnonProduct;
  imgBase: string;
  primaryColor: string;
  currency: string;
  ordersEnabled: boolean;
  showDesc: boolean;
  onOpen: () => void;
}) {
  const img = product.product_images?.[0];
  // Use thumbnail_path for the card (cropped 1:1); fall back to storage_path with CSS cover
  const cardImgPath = img?.thumbnail_path ?? img?.storage_path ?? null;
  const cardImgUrl  = cardImgPath ? `${imgBase}/${cardImgPath}` : null;
  const displayPrice = product.product_variants?.[0]?.price_cents ?? product.base_price_cents;
  const hasPromo = product.promo_price_cents != null;
  // If thumbnail_path exists the image is already 1:1; otherwise cover crops inline.
  // 'contain' override still available via image_fit field.
  const imgFit = product.image_fit === "contain" ? "contain" : "cover";

  return (
    <div className="mc-card">
      <button
        className="mc-card-btn"
        onClick={onOpen}
        aria-label={`Ver ${product.name}`}
      >
        <div className={`mc-card-img${imgFit === "contain" ? " mc-card-img--contain" : ""}`}>
          {cardImgUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cardImgUrl} alt={img?.alt_text ?? product.name} loading="lazy" decoding="async"
              style={{ objectFit: imgFit }} />
          ) : (
            <CardImgPlaceholder />
          )}
        </div>
        <div className="mc-card-body">
          <p className="mc-card-name">{product.name}</p>
          {showDesc && product.description && (
            <p className="mc-card-desc">{product.description}</p>
          )}
          <p className="mc-card-price" style={{ color: primaryColor }}>
            {hasPromo ? (
              <>
                <span className="mc-card-price-orig">{money(displayPrice, currency)}</span>
                {money(product.promo_price_cents!, currency)}
              </>
            ) : money(displayPrice, currency)}
          </p>
        </div>
      </button>

      {ordersEnabled && (
        <button
          className="mc-add-btn"
          aria-label={`Agregar ${product.name} al carrito`}
          onClick={onOpen}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="3" strokeLinecap="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ── Catalog Product Dialog (solo catálogo, sin carrito) ───────

function CatalogProductDialog({
  product, imgBase, primaryColor, currency, whatsapp, restaurantName, onClose,
}: {
  product: AnonProduct;
  imgBase: string;
  primaryColor: string;
  currency: string;
  whatsapp: string | null;
  restaurantName: string;
  onClose: () => void;
}) {
  const [variantId, setVariantId] = useState(
    product.product_variants.length > 0 ? product.product_variants[0].id : null,
  );
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [imgIdx, setImgIdx]     = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.showModal();
    return () => {
      document.body.style.overflow = prev;
      dialogRef.current?.close();
      trigger?.focus();
    };
  }, []);

  const images = product.product_images ?? [];
  const currentImg = images[imgIdx];
  const imgUrl = currentImg ? `${imgBase}/${currentImg.storage_path}` : null;
  const hasGallery = images.length > 1;

  function toggleOption(groupId: string, optId: string, maxSel: number) {
    setSelected((prev) => {
      const cur = prev[groupId] ?? [];
      if (cur.includes(optId)) return { ...prev, [groupId]: cur.filter((id) => id !== optId) };
      if (cur.length >= maxSel) {
        if (maxSel === 1) return { ...prev, [groupId]: [optId] };
        return prev;
      }
      return { ...prev, [groupId]: [...cur, optId] };
    });
  }

  function buildWhatsAppUrl() {
    if (!whatsapp) return null;
    const number = whatsapp.replace(/\D/g, "");
    const variant = product.product_variants.find((v) => v.id === variantId);
    const opts = product.option_groups.flatMap((g) =>
      (selected[g.id] ?? []).map((id) => g.options.find((o) => o.id === id)?.name ?? ""),
    ).filter(Boolean);
    const lines = [
      `Hola, me interesa este producto de *${restaurantName}*:`,
      "",
      `*${product.name}*`,
    ];
    if (variant) lines.push(`Variante: ${variant.name}`);
    if (opts.length) lines.push(`Opciones: ${opts.join(", ")}`);
    lines.push("", "¿Está disponible?");
    return `https://wa.me/${number}?text=${encodeURIComponent(lines.join("\n"))}`;
  }

  const waUrl = buildWhatsAppUrl();
  const displayPrice = product.product_variants.find((v) => v.id === variantId)?.price_cents
    ?? product.promo_price_cents
    ?? product.base_price_cents;

  return (
    <dialog
      ref={dialogRef}
      className="product-dialog"
      onClick={(e) => { if (e.target === dialogRef.current) onClose(); }}
      onCancel={onClose}
    >
      <div className="pd-close-zone">
        <button type="button" className="pd-close-btn" onClick={onClose} aria-label="Cerrar">
          <CloseIcon />
        </button>
      </div>

      <div className="pd-img-section">
        {imgUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="pd-img" src={imgUrl} alt={currentImg?.alt_text || product.name} />
        ) : (
          <ImgPlaceholder />
        )}
        {hasGallery && (
          <>
            <button type="button" className="pd-gallery-btn pd-gallery-prev"
              onClick={() => setImgIdx((i) => (i - 1 + images.length) % images.length)}
              aria-label="Imagen anterior">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><polyline points="15 18 9 12 15 6" /></svg>
            </button>
            <button type="button" className="pd-gallery-btn pd-gallery-next"
              onClick={() => setImgIdx((i) => (i + 1) % images.length)}
              aria-label="Imagen siguiente">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
            <div className="pd-thumbs" role="tablist" aria-label="Galería">
              {images.map((_, i) => (
                <button key={i} type="button"
                  className={`pd-thumb-dot${i === imgIdx ? " pd-thumb-dot--on" : ""}`}
                  onClick={() => setImgIdx(i)}
                  aria-label={`Imagen ${i + 1}`}
                  aria-current={i === imgIdx ? "true" : undefined}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="pd-body">
        <div className="pd-content">
          <h2 className="pd-name">{product.name}</h2>
          <p className="pd-price" style={{ color: primaryColor }}>{money(displayPrice, currency)}</p>
          {product.description && (
            <p className="pd-desc">{product.description}</p>
          )}
        </div>

        {product.product_variants.length > 0 && (
          <fieldset>
            <legend>
              Variante{" "}
              <span style={{ background: primaryTint(primaryColor, 0.12), color: primaryColor, borderRadius: 20, padding: "2px 8px", fontSize: 11 }}>
                Selecciona
              </span>
            </legend>
            {product.product_variants.map((v) => (
              <div key={v.id} className="option-row">
                <span>
                  <input type="radio" name="catalog-variant" value={v.id}
                    checked={variantId === v.id} onChange={() => setVariantId(v.id)}
                    style={{ accentColor: primaryColor }} />
                  {v.name}
                </span>
                <span>{money(v.price_cents, currency)}</span>
              </div>
            ))}
          </fieldset>
        )}

        {product.option_groups.map((g) => (
          <fieldset key={g.id}>
            <legend>
              {g.name}{" "}
              <span style={{ background: "#f5f5f5", color: "#777", borderRadius: 20, padding: "2px 8px", fontSize: 11 }}>
                Opcional
              </span>
            </legend>
            {g.options.map((opt) => {
              const isSel = (selected[g.id] ?? []).includes(opt.id);
              return (
                <div key={opt.id} className="option-row">
                  <span>
                    <input type={g.max_selections === 1 ? "radio" : "checkbox"}
                      name={`catalog-group-${g.id}`} checked={isSel}
                      onChange={() => toggleOption(g.id, opt.id, g.max_selections)}
                      style={{ accentColor: primaryColor }} />
                    {opt.name}
                  </span>
                  {opt.price_delta_cents !== 0 && <span>+{money(opt.price_delta_cents, currency)}</span>}
                </div>
              );
            })}
          </fieldset>
        ))}

        <div style={{ height: 8 }} />
      </div>

      <div className="pd-footer">
        {waUrl ? (
          <a href={waUrl} target="_blank" rel="noopener noreferrer"
            className="button full"
            style={{ background: "#25d366", borderColor: "#25d366", textDecoration: "none", gap: 10 }}>
            <WaIcon />
            Consultar por WhatsApp
          </a>
        ) : (
          <p style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", margin: 0 }}>
            Contacta al negocio para consultar disponibilidad.
          </p>
        )}
      </div>
    </dialog>
  );
}

// ── Product Dialog (pedidos) ──────────────────────────────────

function ProductDialog({
  product, imgBase, primaryColor, currency, onClose, onAdd,
}: {
  product: AnonProduct;
  imgBase: string;
  primaryColor: string;
  currency: string;
  onClose: () => void;
  onAdd: (entry: CartEntry) => void;
}) {
  const hasVariants = product.product_variants.length > 0;
  const [variantId, setVariantId] = useState(hasVariants ? product.product_variants[0].id : null);
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [qty, setQty] = useState(1);
  const [imgIdx, setImgIdx]     = useState(0);
  const [validationError, setValidationError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.showModal();
    return () => {
      document.body.style.overflow = prev;
      dialogRef.current?.close();
      trigger?.focus();
    };
  }, []);

  const variantPrice = hasVariants
    ? (product.product_variants.find((v) => v.id === variantId)?.price_cents ?? product.base_price_cents)
    : (product.promo_price_cents ?? product.base_price_cents);

  const optionTotal = Object.values(selected).flat().reduce((sum, optId) => {
    const delta = product.option_groups.flatMap((g) => g.options)
      .find((o) => o.id === optId)?.price_delta_cents ?? 0;
    return sum + delta;
  }, 0);

  const unitPrice = variantPrice + optionTotal;
  const total = unitPrice * qty;

  const images    = product.product_images ?? [];
  const currentImg = images[imgIdx];
  const imgUrl    = currentImg ? `${imgBase}/${currentImg.storage_path}` : null;
  const hasGallery = images.length > 1;

  function toggleOption(groupId: string, optId: string, maxSel: number) {
    setSelected((prev) => {
      const cur = prev[groupId] ?? [];
      if (cur.includes(optId)) return { ...prev, [groupId]: cur.filter((id) => id !== optId) };
      if (cur.length >= maxSel) {
        if (maxSel === 1) return { ...prev, [groupId]: [optId] };
        return prev;
      }
      return { ...prev, [groupId]: [...cur, optId] };
    });
  }

  function handleAdd() {
    setValidationError(null);
    for (const g of product.option_groups) {
      const sel = selected[g.id] ?? [];
      if (sel.length < g.min_selections) {
        setValidationError(`Selecciona al menos ${g.min_selections} opción(es) en "${g.name}".`);
        return;
      }
      if (sel.length > g.max_selections) {
        setValidationError(`Máximo ${g.max_selections} opción(es) en "${g.name}".`);
        return;
      }
    }
    const options: CartOption[] = product.option_groups.flatMap((g) =>
      (selected[g.id] ?? []).map((optId) => {
        const opt = g.options.find((o) => o.id === optId)!;
        return {
          groupId: g.id, groupName: g.name, optionId: optId,
          optionName: opt.name, priceDeltaCents: opt.price_delta_cents,
        };
      }),
    );
    const key = cartKey(product.id, variantId, options);
    const variant = product.product_variants.find((v) => v.id === variantId) ?? null;
    onAdd({
      key, productId: product.id, productName: product.name,
      variantId, variantName: variant?.name ?? null, options, quantity: qty, unitPriceCents: unitPrice,
    });
    onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      className="product-dialog"
      onClick={(e) => { if (e.target === dialogRef.current) onClose(); }}
      onCancel={onClose}
    >
      <div className="pd-close-zone">
        <button type="button" className="pd-close-btn" onClick={onClose} aria-label="Cerrar">
          <CloseIcon />
        </button>
      </div>

      <div className="pd-img-section">
        {imgUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="pd-img" src={imgUrl} alt={currentImg?.alt_text || product.name} />
        ) : (
          <ImgPlaceholder />
        )}
        {hasGallery && (
          <>
            <button type="button" className="pd-gallery-btn pd-gallery-prev"
              onClick={() => setImgIdx((i) => (i - 1 + images.length) % images.length)}
              aria-label="Imagen anterior">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><polyline points="15 18 9 12 15 6" /></svg>
            </button>
            <button type="button" className="pd-gallery-btn pd-gallery-next"
              onClick={() => setImgIdx((i) => (i + 1) % images.length)}
              aria-label="Imagen siguiente">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
            <div className="pd-thumbs" role="tablist" aria-label="Galería">
              {images.map((_, i) => (
                <button key={i} type="button"
                  className={`pd-thumb-dot${i === imgIdx ? " pd-thumb-dot--on" : ""}`}
                  onClick={() => setImgIdx(i)}
                  aria-label={`Imagen ${i + 1}`}
                  aria-current={i === imgIdx ? "true" : undefined}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="pd-body">
        <div className="pd-content">
          <h2 className="pd-name">{product.name}</h2>
          <p className="pd-price" style={{ color: primaryColor }}>{money(unitPrice, currency)}</p>
          {product.description && (
            <p className="pd-desc">{product.description}</p>
          )}
        </div>

        {hasVariants && (
          <fieldset>
            <legend>
              Variante{" "}
              <span style={{ background: primaryTint(primaryColor, 0.12), color: primaryColor, borderRadius: 20, padding: "2px 8px", fontSize: 11 }}>
                Obligatorio
              </span>
            </legend>
            {product.product_variants.map((v) => (
              <div key={v.id} className="option-row">
                <span>
                  <input type="radio" name="variant" value={v.id}
                    checked={variantId === v.id} onChange={() => setVariantId(v.id)}
                    style={{ accentColor: primaryColor }} />
                  {v.name}
                </span>
                <span>{money(v.price_cents, currency)}</span>
              </div>
            ))}
          </fieldset>
        )}

        {product.option_groups.map((g) => (
          <fieldset key={g.id}>
            <legend>
              {g.name}{" "}
              <span style={{
                background: g.min_selections > 0 ? primaryTint(primaryColor, 0.12) : "#f5f5f5",
                color: g.min_selections > 0 ? primaryColor : "#777",
                borderRadius: 20, padding: "2px 8px", fontSize: 11,
              }}>
                {g.min_selections > 0 ? "Obligatorio" : "Opcional"}
              </span>
              {g.max_selections > 1 && (
                <span style={{ fontSize: 11, color: "#777", marginLeft: 6 }}>Máx. {g.max_selections}</span>
              )}
            </legend>
            {g.options.map((opt) => {
              const isSel = (selected[g.id] ?? []).includes(opt.id);
              return (
                <div key={opt.id} className="option-row">
                  <span>
                    <input type={g.max_selections === 1 ? "radio" : "checkbox"}
                      name={`group-${g.id}`} checked={isSel}
                      onChange={() => toggleOption(g.id, opt.id, g.max_selections)}
                      style={{ accentColor: primaryColor }} />
                    {opt.name}
                  </span>
                  {opt.price_delta_cents !== 0 && <span>+{money(opt.price_delta_cents, currency)}</span>}
                </div>
              );
            })}
          </fieldset>
        ))}

        <div style={{ padding: "16px 24px 4px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>Cantidad</span>
          <div className="pd-qty-row">
            <button type="button" className="pd-qty-btn"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              aria-label="Reducir cantidad" disabled={qty <= 1}>
              −
            </button>
            <span className="pd-qty-val" aria-live="polite">{qty}</span>
            <button type="button" className="pd-qty-btn"
              onClick={() => setQty((q) => Math.min(20, q + 1))}
              aria-label="Aumentar cantidad" disabled={qty >= 20}>
              +
            </button>
          </div>
        </div>

        {validationError && (
          <p className="error" style={{ padding: "0 24px 8px", margin: 0 }}>{validationError}</p>
        )}

        <div style={{ height: 8 }} />
      </div>

      <div className="pd-footer">
        <button type="button" className="button full"
          style={{ background: primaryColor, borderColor: primaryColor }}
          onClick={handleAdd}>
          Agregar · {money(total, currency)}
        </button>
      </div>
    </dialog>
  );
}

// ── Checkout Form ─────────────────────────────────────────────

function CheckoutForm({
  restaurant, config, cart, deliveryZones, paymentMethods, onBack,
}: {
  restaurant: Restaurant;
  config: PublicRestaurantConfig | null;
  cart: CartEntry[];
  deliveryZones: PublicDeliveryZone[];
  paymentMethods: PublicPaymentMethod[];
  onBack: () => void;
}) {
  const router = useRouter();
  const cur = restaurant.currency;
  const pickupOk = config?.pickup_enabled ?? false;
  const deliveryOk = config?.delivery_enabled ?? false;
  const defaultModality = pickupOk ? "pickup" : "delivery";

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [modality, setModality] = useState<"pickup" | "delivery">(defaultModality as "pickup" | "delivery");
  const [zoneId, setZoneId] = useState(deliveryZones[0]?.id ?? "");
  const [address, setAddress] = useState("");
  const [paymentId, setPaymentId] = useState(paymentMethods[0]?.id ?? "");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [priceChanged, setPriceChanged] = useState<{ actual: number; sub: number; fee: number } | null>(null);
  const idempotencyKeyRef = useRef(generateIdempotencyKey());

  const subtotal = cart.reduce((s, it) => s + it.unitPriceCents * it.quantity, 0);
  const selectedZone = deliveryZones.find((z) => z.id === zoneId);
  const deliveryFee = modality === "delivery" ? (selectedZone?.fee_cents ?? 0) : 0;
  const total = subtotal + deliveryFee;

  async function handleSubmit(acknowledgedTotal: number) {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    setPriceChanged(null);

    const body: PlaceOrderRequest = {
      restaurantId: restaurant.id,
      idempotencyKey: idempotencyKeyRef.current,
      acknowledgedTotalCents: acknowledgedTotal,
      customerName: name.trim(),
      customerPhone: phone.trim(),
      modality,
      deliveryZoneId: modality === "delivery" ? zoneId : null,
      deliveryAddress: modality === "delivery" ? address.trim() : "",
      paymentMethodId: paymentId,
      notes: notes.trim(),
      items: cart.map((it) => ({
        productId: it.productId,
        variantId: it.variantId,
        options: it.options.map((o) => ({ optionGroupId: o.groupId, optionId: o.optionId })),
        quantity: it.quantity,
      })),
    };

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json() as PlaceOrderResponse | PriceChangedResponse | { error: string };
      if (res.ok) {
        router.push((json as PlaceOrderResponse).redirectTo);
        return;
      }
      if (res.status === 422 && "priceChanged" in json && json.priceChanged) {
        const pc = json as PriceChangedResponse;
        setPriceChanged({ actual: pc.actualTotalCents, sub: pc.actualSubtotalCents, fee: pc.actualDeliveryFeeCents });
        setIsSubmitting(false);
        return;
      }
      setError(("error" in json ? json.error : null) ?? "Error al crear el pedido.");
    } catch {
      setError("Error de red. Verifica tu conexión e intenta de nuevo.");
    }
    setIsSubmitting(false);
  }

  function onConfirmPriceChange() {
    if (!priceChanged) return;
    idempotencyKeyRef.current = generateIdempotencyKey();
    handleSubmit(priceChanged.actual);
  }

  const canSubmit = name.trim().length >= 1 && phone.trim().length >= 5 && paymentId &&
    (modality === "pickup" || (zoneId && address.trim().length >= 5));

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "24px 20px 64px" }}>
      <button type="button" onClick={onBack} className="text-link" style={{ marginBottom: 20, display: "block" }}>
        ← Volver al menú
      </button>
      <h1 style={{ fontSize: 22, letterSpacing: -0.5, marginBottom: 24 }}>Finalizar pedido</h1>

      <div className="dashboard-card" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, marginBottom: 16 }}>Datos de contacto</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="field">
            <label>Nombre *</label>
            <input type="text" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" />
          </div>
          <div className="field">
            <label>Teléfono *</label>
            <input type="tel" maxLength={30} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+58 412 000 0000" />
          </div>
        </div>
      </div>

      <div className="dashboard-card" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, marginBottom: 16 }}>Modalidad de entrega</h2>
        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          {pickupOk && (
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14 }}>
              <input type="radio" value="pickup" checked={modality === "pickup"} onChange={() => setModality("pickup")} style={{ accentColor: "var(--purple)" }} />
              Retiro en local
              {config?.pickup_address && <span style={{ color: "#777", fontSize: 12 }}>({config.pickup_address})</span>}
            </label>
          )}
          {deliveryOk && (
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14 }}>
              <input type="radio" value="delivery" checked={modality === "delivery"} onChange={() => setModality("delivery")} style={{ accentColor: "var(--purple)" }} />
              Delivery
            </label>
          )}
        </div>
        {modality === "delivery" && (
          <>
            {deliveryZones.length > 0 ? (
              <div className="field">
                <label>Zona de delivery *</label>
                <select value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
                  {deliveryZones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name} — {money(z.fee_cents, cur)}
                      {z.minimum_order_cents > 0 ? ` (mín. ${money(z.minimum_order_cents, cur)})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <p style={{ fontSize: 13, color: "#777" }}>No hay zonas de delivery disponibles.</p>
            )}
            <div className="field">
              <label>Dirección de entrega *</label>
              <input type="text" maxLength={300} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Av. Principal, Edificio X, Apto 3" />
            </div>
          </>
        )}
      </div>

      <div className="dashboard-card" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, marginBottom: 16 }}>Medio de pago</h2>
        {paymentMethods.length === 0 ? (
          <p style={{ fontSize: 13, color: "#777" }}>No hay medios de pago configurados.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {paymentMethods.map((pm) => (
              <label key={pm.id} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 14 }}>
                <input type="radio" value={pm.id} checked={paymentId === pm.id} onChange={() => setPaymentId(pm.id)} style={{ accentColor: "var(--purple)" }} />
                {pm.name}
              </label>
            ))}
          </div>
        )}
        <p style={{ fontSize: 11, color: "#888", marginTop: 10 }}>
          Las instrucciones de pago se mostrarán en la confirmación del pedido.
        </p>
      </div>

      <div className="dashboard-card" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, marginBottom: 12 }}>Observaciones</h2>
        <textarea maxLength={500} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="Alergias, instrucciones especiales…"
          style={{ width: "100%", resize: "vertical", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px", fontSize: 13, fontFamily: "inherit" }} />
      </div>

      <div className="dashboard-card" style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, marginBottom: 12 }}>Resumen</h2>
        {cart.map((it) => (
          <div key={it.key} style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 8, fontSize: 13 }}>
            <div>
              <span>{it.productName}</span>
              {it.variantName && <span style={{ color: "#777" }}> · {it.variantName}</span>}
              {it.options.map((o, oi) => (
                <span key={oi} style={{ color: "#777" }}> · {o.optionName}</span>
              ))}
              <span style={{ color: "#777" }}> × {it.quantity}</span>
            </div>
            <span style={{ flexShrink: 0 }}>{money(it.unitPriceCents * it.quantity, cur)}</span>
          </div>
        ))}
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, marginTop: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
            <span style={{ color: "#777" }}>Subtotal</span><span>{money(subtotal, cur)}</span>
          </div>
          {modality === "delivery" && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
              <span style={{ color: "#777" }}>Delivery</span><span>{money(deliveryFee, cur)}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 16, borderTop: "1px solid var(--border)", paddingTop: 8, marginTop: 4 }}>
            <span>Total</span><span>{money(total, cur)}</span>
          </div>
        </div>
      </div>

      {priceChanged && (
        <div style={{ background: "#fff3cd", border: "1px solid #ffc107", borderRadius: 10, padding: "14px 18px", marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Los precios cambiaron</div>
          <div style={{ fontSize: 13 }}>
            Subtotal: {money(priceChanged.sub, cur)} | Delivery: {money(priceChanged.fee, cur)} | <strong>Total: {money(priceChanged.actual, cur)}</strong>
          </div>
          <button type="button" className="button small" style={{ marginTop: 10 }} onClick={onConfirmPriceChange} disabled={isSubmitting}>
            Confirmar con el nuevo total
          </button>
        </div>
      )}

      {error && <p className="auth-error" role="alert">{error}</p>}

      <button type="button" className="button full" disabled={!canSubmit || isSubmitting}
        onClick={() => handleSubmit(total)} style={{ marginTop: 8 }}>
        {isSubmitting ? "Enviando pedido…" : `Confirmar pedido · ${money(total, cur)}`}
      </button>

      <p style={{ fontSize: 11, color: "#888", marginTop: 12, textAlign: "center" }}>
        Al confirmar, el restaurante recibirá tu pedido. La aceptación y el pago se verificarán por separado.
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────

export function PublicMenuClient({
  restaurant, config, isOpen, categories,
  deliveryZones, paymentMethods, supabaseUrl, ordersEnabled,
}: Props) {
  const [activeCategory, setActiveCategory] = useState("");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [dialogProduct, setDialogProduct] = useState<AnonProduct | null>(null);
  const [step, setStep] = useState<Step>("menu");

  const catalogOnly = !ordersEnabled;
  const cur = restaurant.currency;

  const imgBase = `${supabaseUrl}/storage/v1/object/public/product-images`;
  const assetBase = `${supabaseUrl}/storage/v1/object/public/restaurant-assets`;
  const primaryColor = config?.primary_color ?? "#703BE6";
  const logoUrl = config?.logo_path ? `${assetBase}/${config.logo_path}` : null;
  const coverUrl = config?.cover_path ? `${assetBase}/${config.cover_path}` : null;
  const initials = restaurant.name.slice(0, 2).toUpperCase();

  const menuVars: React.CSSProperties = {
    "--menu-primary":       primaryColor,
    "--menu-card-photo-bg": `linear-gradient(135deg,${primaryTint(primaryColor, 0.13)},${primaryTint(primaryColor, 0.25)})`,
    "--menu-muted-icon":    primaryTint(primaryColor, 0.55),
    ...(config?.background_color ? {
      "--menu-bg":     config.background_color,
      "--menu-bar-bg": config.background_color,
    } : {}),
  } as React.CSSProperties;

  const fontFamilyStyle = config?.font_family === "Nunito"
    ? { fontFamily: "var(--font-nunito,'Nunito',Arial,sans-serif)" }
    : {};

  // Cover background: image → gradient from secondary_color → nothing (compact id-bar only)
  const hasCoverImg = !!coverUrl;
  const hasCoverGradient = !hasCoverImg && !!config?.secondary_color;
  const coverStyle = hasCoverImg
    ? { backgroundImage: `url(${coverUrl})` }
    : hasCoverGradient
      ? { background: `linear-gradient(115deg,${darkenHex(config!.secondary_color!, 0.35)},${config!.secondary_color!})` }
      : undefined;
  const showHero = hasCoverImg || hasCoverGradient;

  const cartCount = cart.reduce((s, it) => s + it.quantity, 0);
  const cartTotal = cart.reduce((s, it) => s + it.unitPriceCents * it.quantity, 0);

  const totalCount = categories.reduce((s, c) => s + (c.products as AnonProduct[]).length, 0);

  // WA contact link for topbar (catalog mode only)
  const topbarWaUrl = catalogOnly && config?.whatsapp
    ? `https://wa.me/${config.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(`Hola, me interesa conocer más sobre ${restaurant.name}`)}`
    : null;

  const scrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function scrollToCategory(catId: string) {
    setActiveCategory(catId);
    scrollingRef.current = true;
    clearTimeout(scrollTimeoutRef.current);
    document.getElementById(`cat-${catId}`)?.scrollIntoView({ behavior: "smooth" });
    scrollTimeoutRef.current = setTimeout(() => { scrollingRef.current = false; }, 900);
  }

  function scrollToTop() {
    setActiveCategory("");
    scrollingRef.current = true;
    clearTimeout(scrollTimeoutRef.current);
    window.scrollTo({ top: 0, behavior: "smooth" });
    scrollTimeoutRef.current = setTimeout(() => { scrollingRef.current = false; }, 900);
  }

  // Track which section is visible via IntersectionObserver
  useEffect(() => {
    if (search) return;
    const ids = categories.map((c) => c.id);
    const visible = new Set<string>();

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = entry.target.id.replace("cat-", "");
          if (entry.isIntersecting) visible.add(id);
          else visible.delete(id);
        });
        if (!scrollingRef.current) {
          const first = ids.find((id) => visible.has(id));
          if (first) setActiveCategory(first);
        }
      },
      { rootMargin: "-116px 0px -45% 0px", threshold: 0 },
    );

    ids.forEach((id) => {
      const el = document.getElementById(`cat-${id}`);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [categories, search]);

  const addToCart = useCallback((entry: CartEntry) => {
    setCart((prev) => {
      const idx = prev.findIndex((e) => e.key === entry.key);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], quantity: updated[idx].quantity + entry.quantity };
        return updated;
      }
      return [...prev, entry];
    });
  }, []);

  const removeFromCart = useCallback((key: string) => {
    setCart((prev) => prev.filter((e) => e.key !== key));
  }, []);
  const changeQty = useCallback((key: string, delta: number) => {
    setCart((prev) =>
      prev.map((e) => e.key === key ? { ...e, quantity: e.quantity + delta } : e)
          .filter((e) => e.quantity > 0),
    );
  }, []);
  void removeFromCart;
  void changeQty;

  const filtered = categories
    .map((cat) => ({
      ...cat,
      products: (cat.products as AnonProduct[]).filter((p) =>
        search
          ? p.name.toLowerCase().includes(search.toLowerCase()) ||
            (p.description ?? "").toLowerCase().includes(search.toLowerCase())
          : true,
      ),
    }))
    .filter((cat) => cat.products.length > 0);

  const closedMessage = config?.is_temporarily_closed
    ? config.closed_message || "Cerrado temporalmente"
    : null;

  // "Todos" is active when no category ID is matched
  const todosActive = !categories.some((c) => c.id === activeCategory);

  if (step === "checkout") {
    return (
      <CheckoutForm
        restaurant={restaurant}
        config={config}
        cart={cart}
        deliveryZones={deliveryZones}
        paymentMethods={paymentMethods}
        onBack={() => setStep("menu")}
      />
    );
  }

  return (
    <div className="rm-catalog-root" style={{ ...menuVars, ...fontFamilyStyle }}>

      {/* Topbar — siempre visible */}
      <header className="rm-topbar">
        <div className="rm-topbar-inner container">
          <div className="rm-topbar-brand">
            <div className="rm-topbar-logo">
              {logoUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={logoUrl} alt="" aria-hidden="true" />
                : <span aria-hidden="true">{initials}</span>}
            </div>
            <span className="rm-topbar-name">{restaurant.name}</span>
          </div>

          <div className="rm-topbar-search">
            <SearchIcon className="rm-topbar-si" />
            <input
              className="rm-topbar-sinput"
              type="search"
              placeholder={catalogOnly ? "¿Qué estás buscando?" : "¿Qué te provoca hoy?"}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar en el catálogo"
            />
            {search && (
              <button className="rm-topbar-sclear" onClick={() => setSearch("")} aria-label="Limpiar búsqueda">
                ✕
              </button>
            )}
          </div>

          <div className="rm-topbar-actions">
            {topbarWaUrl && (
              <a href={topbarWaUrl} target="_blank" rel="noopener noreferrer" className="rm-topbar-wa"
                aria-label="Contactar por WhatsApp">
                <WaIcon />
                <span>Contactar</span>
              </a>
            )}
            {!catalogOnly && (
              <span className={`rm-status-pill ${isOpen ? "rm-status-open" : "rm-status-closed"}`}>
                <span className={`rm-status-dot ${isOpen ? "rm-status-dot-open" : "rm-status-dot-closed"}`} aria-hidden="true" />
                {isOpen ? "Abierto" : "Cerrado"}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Aviso de cierre temporal */}
      {closedMessage && (
        <div role="alert" className="rm-closed-notice">
          {closedMessage}
        </div>
      )}

      {/* Hero — con imagen o con degradado del color de marca */}
      {showHero && (
        <div className="rm-hero" style={coverStyle} role="banner">
          <div className="rm-hero-overlay" aria-hidden="true" />
          <div className="container rm-hero-content">
            <h1 className="rm-hero-title">{restaurant.name}</h1>
            {config?.description && (
              <p className="rm-hero-sub">{config.description}</p>
            )}
          </div>
        </div>
      )}

      {/* Barra identidad — sin portada ni degradado, descripción compacta */}
      {!showHero && config?.description && (
        <div className="rm-id-bar">
          <div className="container rm-id-bar-inner">
            <p className="rm-id-desc">{config.description}</p>
            {!catalogOnly && (
              <span className={`rm-status-pill ${isOpen ? "rm-status-open" : "rm-status-closed"}`}>
                <span className={`rm-status-dot ${isOpen ? "rm-status-dot-open" : "rm-status-dot-closed"}`} aria-hidden="true" />
                {isOpen ? "Abierto" : "Cerrado"}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Barra de categorías — sticky */}
      <nav className="rm-catbar" aria-label="Categorías">
        <div className="rm-catbar-inner container">
          <button
            className={`rm-cat-tab${todosActive ? " rm-cat-tab--on" : ""}`}
            onClick={scrollToTop}
            aria-label={`Todos, ${totalCount} productos`}
          >
            Todos
            <span className="rm-cat-count">{totalCount}</span>
          </button>
          {categories.map((cat) => {
            const count = (cat.products as AnonProduct[]).length;
            return (
              <button
                key={cat.id}
                className={`rm-cat-tab${activeCategory === cat.id ? " rm-cat-tab--on" : ""}`}
                onClick={() => scrollToCategory(cat.id)}
                aria-label={`${cat.name}, ${count} productos`}
              >
                {cat.name}
                <span className="rm-cat-count">{count}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Catálogo */}
      <main className="container mc-main">
        {filtered.length === 0 && (
          <div className="rm-empty" role="status" aria-live="polite">
            <span className="rm-empty-icon" aria-hidden="true">🔍</span>
            <p className="rm-empty-text">
              {search
                ? `No encontramos «${search}» en el catálogo.`
                : "Este catálogo no tiene productos publicados."}
            </p>
            {search && (
              <button className="rm-empty-clear" onClick={() => setSearch("")}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                Limpiar búsqueda
              </button>
            )}
          </div>
        )}
        {filtered.map((cat) => (
          <section key={cat.id} id={`cat-${cat.id}`} className="mc-section">
            <h2 className="mc-section-title">{cat.name}</h2>
            <div className="mc-grid">
              {(cat.products as AnonProduct[]).map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  imgBase={imgBase}
                  primaryColor={primaryColor}
                  currency={cur}
                  ordersEnabled={ordersEnabled}
                  showDesc={!catalogOnly}
                  onOpen={() => setDialogProduct(p)}
                />
              ))}
            </div>
          </section>
        ))}
      </main>

      <footer className="rm-footer">
        Creado con <strong style={{ color: "var(--menu-primary,var(--purple))", fontWeight: 600 }}>Mesa</strong>
      </footer>

      {/* FAB carrito — escritorio */}
      {!catalogOnly && cartCount > 0 && (
        <button
          className="cart-fab"
          onClick={() => setStep("checkout")}
          aria-label={`Ver pedido, ${cartCount} ${cartCount === 1 ? "producto" : "productos"}, total ${money(cartTotal, cur)}`}
        >
          <CartIcon />
          <span className="cart-fab-label">Ver pedido</span>
          <span className="cart-fab-total" aria-hidden="true">{money(cartTotal, cur)}</span>
          <span className="cart-fab-count" aria-hidden="true">{cartCount}</span>
        </button>
      )}

      {/* Barra carrito — móvil */}
      {!catalogOnly && cartCount > 0 && (
        <div className="cart-bar" role="complementary" aria-label="Resumen del pedido">
          <span className="cart-bar-qty">
            {cartCount} {cartCount === 1 ? "producto" : "productos"}
          </span>
          <button className="cart-bar-btn" onClick={() => setStep("checkout")}>
            Ver pedido · {money(cartTotal, cur)}
          </button>
        </div>
      )}

      {/* Diálogos */}
      {!catalogOnly && dialogProduct && (
        <ProductDialog
          product={dialogProduct}
          imgBase={imgBase}
          primaryColor={primaryColor}
          currency={cur}
          onClose={() => setDialogProduct(null)}
          onAdd={addToCart}
        />
      )}
      {catalogOnly && dialogProduct && (
        <CatalogProductDialog
          product={dialogProduct}
          imgBase={imgBase}
          primaryColor={primaryColor}
          currency={cur}
          whatsapp={config?.whatsapp ?? null}
          restaurantName={restaurant.name}
          onClose={() => setDialogProduct(null)}
        />
      )}
    </div>
  );
}
