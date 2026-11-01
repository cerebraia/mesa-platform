"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
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
  BusinessOpenStatus,
} from "@/lib/catalog-types";

// ── Types ─────────────────────────────────────────────────────

interface Restaurant {
  id: string; name: string; slug: string; status: string; currency: string;
}

export interface SocialLinks {
  instagram: string | null;
  facebook:  string | null;
  twitter:   string | null;
  whatsapp:  string | null;
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
  openStatus: BusinessOpenStatus | null;
  categories: PublicCategory[];
  deliveryZones: PublicDeliveryZone[];
  paymentMethods: PublicPaymentMethod[];
  supabaseUrl: string;
  ordersEnabled: boolean;
  socialLinks: SocialLinks;
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

function InstagramIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  );
}

function TwitterXIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  );
}

// Renders social icon links; returns null when there are no configured links.
function SocialBar({
  links, hero = false,
}: {
  links: SocialLinks;
  hero?: boolean;
}) {
  const items: { href: string; label: string; icon: React.ReactNode }[] = [];
  if (links.instagram) items.push({ href: links.instagram, label: "Instagram",  icon: <InstagramIcon /> });
  if (links.facebook)  items.push({ href: links.facebook,  label: "Facebook",   icon: <FacebookIcon /> });
  if (links.twitter)   items.push({ href: links.twitter,   label: "X (Twitter)", icon: <TwitterXIcon /> });
  if (links.whatsapp)  items.push({ href: links.whatsapp,  label: "WhatsApp",   icon: <WaIcon /> });
  if (items.length === 0) return null;
  return (
    <div className={`rm-social-bar${hero ? " rm-social-bar--hero" : ""}`} aria-label="Redes sociales">
      {items.map(({ href, label, icon }) => (
        <a key={label} href={href} target="_blank" rel="noopener noreferrer"
          className="rm-social-btn" aria-label={label}>
          {icon}
        </a>
      ))}
    </div>
  );
}

// ── Business header ───────────────────────────────────────────
// Replaces the separate hero + id-bar blocks.
// Always rendered: cover photo → primary-color gradient fallback.

function BizHeader({
  restaurantId,
  restaurantName,
  config,
  liveStatus,
  logoUrl,
  coverUrl,
  primaryColor,
  socialLinks,
  supabaseUrl,
  fontStyle,
}: {
  restaurantId: string;
  restaurantName: string;
  config: PublicRestaurantConfig | null;
  liveStatus: BusinessOpenStatus | null;
  logoUrl: string | null;
  coverUrl: string | null;
  primaryColor: string;
  socialLinks: SocialLinks;
  supabaseUrl: string;
  fontStyle: React.CSSProperties;
}) {
  void supabaseUrl; // passed for future use
  const initials = restaurantName.slice(0, 2).toUpperCase();
  const hasCover = !!coverUrl;
  const hasSocials = !!(socialLinks.instagram || socialLinks.facebook || socialLinks.twitter || socialLinks.whatsapp);

  const bgStyle: React.CSSProperties = hasCover
    ? { backgroundImage: `url(${coverUrl})` }
    : { background: `linear-gradient(135deg,${darkenHex(primaryColor, 0.20)} 0%,${primaryColor} 100%)` };

  let statusEl: React.ReactNode = null;
  if (liveStatus && liveStatus.status !== "temporarily_closed") {
    if (liveStatus.status === "open") {
      statusEl = (
        <span className="rm-bh-status rm-bh-status--open">
          <span className="rm-bh-dot rm-bh-dot--open" aria-hidden="true" />
          Abierto{liveStatus.closes_at ? ` · Cierra a las ${liveStatus.closes_at}` : ""}
        </span>
      );
    } else {
      statusEl = (
        <span className="rm-bh-status rm-bh-status--closed">
          <span className="rm-bh-dot rm-bh-dot--closed" aria-hidden="true" />
          Cerrado{liveStatus.opens_at ? ` · Abre a las ${liveStatus.opens_at}` : ""}
        </span>
      );
    }
  }

  const hasMeta = statusEl || hasSocials;

  void restaurantId; // used for live-status updates in parent

  return (
    <div
      className={`rm-bh${hasCover ? " rm-bh--photo" : " rm-bh--color"}`}
      style={bgStyle}
    >
      <div className="rm-bh-overlay" aria-hidden="true" />
      <div className="rm-bh-inner container">
        {/* Logo / initials */}
        <div className="rm-bh-logo-box" aria-hidden="true">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="rm-bh-logo-img" />
          ) : (
            <span className="rm-bh-initials">{initials}</span>
          )}
        </div>

        {/* Name, description, status, socials */}
        <div className="rm-bh-info" style={fontStyle}>
          <h1 className="rm-bh-name">{restaurantName}</h1>
          {config?.description && (
            <p className="rm-bh-desc">{config.description}</p>
          )}
          {hasMeta && (
            <div className="rm-bh-meta">
              {statusEl}
              {hasSocials && <SocialBar links={socialLinks} hero />}
            </div>
          )}
        </div>
      </div>
    </div>
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
  const dialogRef    = useRef<HTMLDialogElement>(null);
  const touchStartX  = useRef(0);

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

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!hasGallery) return;
    if (e.key === "ArrowLeft")  { e.preventDefault(); setImgIdx((i) => (i - 1 + images.length) % images.length); }
    if (e.key === "ArrowRight") { e.preventDefault(); setImgIdx((i) => (i + 1) % images.length); }
  }

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
      onKeyDown={handleKeyDown}
    >
      <div className="pd-close-zone">
        <button type="button" className="pd-close-btn" onClick={onClose} aria-label="Cerrar">
          <CloseIcon />
        </button>
      </div>

      <div
        className="pd-img-section"
        onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          const delta = e.changedTouches[0].clientX - touchStartX.current;
          if (!hasGallery) return;
          if (delta > 40)  setImgIdx((i) => (i - 1 + images.length) % images.length);
          if (delta < -40) setImgIdx((i) => (i + 1) % images.length);
        }}
      >
        {imgUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="pd-img" src={imgUrl} alt={currentImg?.alt_text || product.name} />
        ) : (
          <ImgPlaceholder />
        )}
        {hasGallery && (
          <>
            <span className="pd-gallery-counter" aria-live="polite" aria-atomic="true">
              {imgIdx + 1} / {images.length}
            </span>
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
            <div className="pd-thumbs" role="tablist" aria-label="Galería de imágenes">
              {images.map((img, i) => {
                const tSrc = `${imgBase}/${img.thumbnail_path ?? img.storage_path}`;
                return (
                  <button key={img.id} type="button" role="tab"
                    className={`pd-thumb${i === imgIdx ? " pd-thumb--on" : ""}`}
                    onClick={() => setImgIdx(i)}
                    aria-label={`Imagen ${i + 1} de ${images.length}`}
                    aria-selected={i === imgIdx}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={tSrc} alt="" loading="lazy" />
                  </button>
                );
              })}
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
  const dialogRef   = useRef<HTMLDialogElement>(null);
  const touchStartX = useRef(0);

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

  const images     = product.product_images ?? [];
  const currentImg = images[imgIdx];
  const imgUrl     = currentImg ? `${imgBase}/${currentImg.storage_path}` : null;
  const hasGallery = images.length > 1;

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!hasGallery) return;
    if (e.key === "ArrowLeft")  { e.preventDefault(); setImgIdx((i) => (i - 1 + images.length) % images.length); }
    if (e.key === "ArrowRight") { e.preventDefault(); setImgIdx((i) => (i + 1) % images.length); }
  }

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
      onKeyDown={handleKeyDown}
    >
      <div className="pd-close-zone">
        <button type="button" className="pd-close-btn" onClick={onClose} aria-label="Cerrar">
          <CloseIcon />
        </button>
      </div>

      <div
        className="pd-img-section"
        onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          const delta = e.changedTouches[0].clientX - touchStartX.current;
          if (!hasGallery) return;
          if (delta > 40)  setImgIdx((i) => (i - 1 + images.length) % images.length);
          if (delta < -40) setImgIdx((i) => (i + 1) % images.length);
        }}
      >
        {imgUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="pd-img" src={imgUrl} alt={currentImg?.alt_text || product.name} />
        ) : (
          <ImgPlaceholder />
        )}
        {hasGallery && (
          <>
            <span className="pd-gallery-counter" aria-live="polite" aria-atomic="true">
              {imgIdx + 1} / {images.length}
            </span>
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
            <div className="pd-thumbs" role="tablist" aria-label="Galería de imágenes">
              {images.map((img, i) => {
                const tSrc = `${imgBase}/${img.thumbnail_path ?? img.storage_path}`;
                return (
                  <button key={img.id} type="button" role="tab"
                    className={`pd-thumb${i === imgIdx ? " pd-thumb--on" : ""}`}
                    onClick={() => setImgIdx(i)}
                    aria-label={`Imagen ${i + 1} de ${images.length}`}
                    aria-selected={i === imgIdx}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={tSrc} alt="" loading="lazy" />
                  </button>
                );
              })}
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

// ── Side cart panel ───────────────────────────────────────────

function CartPanel({
  cart,
  imgBase,
  categories,
  primaryColor,
  currency,
  onClose,
  onChangeQty,
  onRemove,
  onClear,
  onCheckout,
}: {
  cart: CartEntry[];
  imgBase: string;
  categories: PublicCategory[];
  primaryColor: string;
  currency: string;
  onClose: () => void;
  onChangeQty: (key: string, delta: number) => void;
  onRemove: (key: string) => void;
  onClear: () => void;
  onCheckout: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Scroll lock + initial focus
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Escape closes (unless clear-confirm is open)
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (showClearConfirm) { setShowClearConfirm(false); return; }
        onClose();
      }
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose, showClearConfirm]);

  // Focus trap within panel
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key !== "Tab" || showClearConfirm) return;
      const el = panelRef.current;
      if (!el) return;
      const nodes = el.querySelectorAll<HTMLElement>('button:not([disabled]),[href],[tabindex]:not([tabindex="-1"])');
      if (!nodes.length) return;
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
      else            { if (document.activeElement === last)  { e.preventDefault(); first.focus(); } }
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [showClearConfirm]);

  // Build product-image lookup from categories (uses thumbnail when available)
  const imageMap = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const cat of categories) {
      for (const p of (cat.products as AnonProduct[])) {
        const img = p.product_images?.[0];
        m.set(p.id, img?.thumbnail_path ?? img?.storage_path ?? null);
      }
    }
    return m;
  }, [categories]);

  const subtotal  = cart.reduce((s, it) => s + it.unitPriceCents * it.quantity, 0);
  const itemCount = cart.reduce((s, it) => s + it.quantity, 0);

  if (typeof document === "undefined") return null;
  return createPortal(
    <>
      {/* Overlay */}
      <div className="sc-overlay" onClick={onClose} aria-hidden="true" />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Tu pedido"
        className="sc-panel"
        tabIndex={-1}
      >
        {/* ── Header ── */}
        <div className="sc-header">
          <h2 className="sc-title">Tu pedido</h2>
          <div className="sc-header-actions">
            {cart.length > 0 && (
              <button
                className="sc-clear-btn"
                onClick={() => setShowClearConfirm(true)}
                aria-label="Vaciar carrito"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  aria-hidden="true">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  <path d="M10 11v6"/><path d="M14 11v6"/>
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                </svg>
                Vaciar
              </button>
            )}
            <button
              ref={closeRef}
              className="sc-close-btn"
              onClick={onClose}
              aria-label="Cerrar carrito"
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        {/* ── Body (scrollable) ── */}
        <div className="sc-body">
          {cart.length === 0 ? (
            <div className="sc-empty">
              <svg width="52" height="52" viewBox="0 0 24 24" fill="none"
                stroke="#D1D5DB" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"
                aria-hidden="true">
                <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
              </svg>
              <p className="sc-empty-title">Tu carrito está vacío</p>
              <p className="sc-empty-sub">Agrega productos para comenzar tu pedido.</p>
              <button
                className="sc-explore-btn"
                style={{ color: primaryColor, borderColor: primaryColor }}
                onClick={onClose}
              >
                Explorar productos
              </button>
            </div>
          ) : (
            cart.map((entry) => {
              const imgPath = imageMap.get(entry.productId);
              const imgSrc  = imgPath ? `${imgBase}/${imgPath}` : null;
              const lineTotal = entry.unitPriceCents * entry.quantity;
              return (
                <div key={entry.key} className="sc-item">
                  {/* Thumbnail */}
                  <div className="sc-item-img" aria-hidden="true">
                    {imgSrc
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={imgSrc} alt="" />
                      : <div className="sc-item-ph" />}
                  </div>

                  {/* Info */}
                  <div className="sc-item-body">
                    <p className="sc-item-name">{entry.productName}</p>
                    {(entry.variantName || entry.options.length > 0) && (
                      <p className="sc-item-extras">
                        {[
                          entry.variantName,
                          ...entry.options.map((o) =>
                            o.priceDeltaCents > 0
                              ? `${o.optionName} +${money(o.priceDeltaCents, currency)}`
                              : o.optionName
                          ),
                        ].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    <div className="sc-item-row">
                      {/* Qty controls */}
                      <div className="sc-qty-ctrl" role="group"
                        aria-label={`Cantidad de ${entry.productName}`}>
                        <button
                          className="sc-qty-btn"
                          onClick={() => onChangeQty(entry.key, -1)}
                          aria-label="Reducir cantidad"
                        >−</button>
                        <span className="sc-qty-val" aria-live="polite" aria-atomic="true">
                          {entry.quantity}
                        </span>
                        <button
                          className="sc-qty-btn"
                          onClick={() => onChangeQty(entry.key, 1)}
                          aria-label="Aumentar cantidad"
                        >+</button>
                      </div>
                      <span className="sc-item-price">{money(lineTotal, currency)}</span>
                    </div>
                  </div>

                  {/* Remove */}
                  <button
                    className="sc-item-del"
                    onClick={() => onRemove(entry.key)}
                    aria-label={`Quitar ${entry.productName}`}
                  >×</button>
                </div>
              );
            })
          )}
        </div>

        {/* ── Footer ── */}
        {cart.length > 0 && (
          <div className="sc-footer">
            <div className="sc-subtotal-row">
              <span className="sc-subtotal-label">
                Subtotal
                <span className="sc-subtotal-count">
                  ({itemCount} {itemCount === 1 ? "producto" : "productos"})
                </span>
              </span>
              <span className="sc-subtotal-val">{money(subtotal, currency)}</span>
            </div>
            <p className="sc-subtotal-note">
              El costo de entrega y otros cargos se calculan al finalizar.
            </p>
            <button
              className="sc-checkout-btn"
              style={{ background: primaryColor }}
              onClick={onCheckout}
            >
              Continuar con el pedido
            </button>
          </div>
        )}
      </div>

      {/* ── Clear confirmation modal ── */}
      {showClearConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirmar vaciar carrito"
          className="sc-confirm-wrap"
        >
          <div className="sc-confirm">
            <p className="sc-confirm-title">¿Vaciar el carrito?</p>
            <p className="sc-confirm-desc">Se eliminarán todos los productos.</p>
            <div className="sc-confirm-actions">
              <button
                className="sc-confirm-cancel"
                onClick={() => setShowClearConfirm(false)}
              >
                Cancelar
              </button>
              <button
                className="sc-confirm-ok"
                onClick={() => { onClear(); setShowClearConfirm(false); }}
              >
                Vaciar
              </button>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body
  );
}

// ── Main component ────────────────────────────────────────────

export function PublicMenuClient({
  restaurant, config, isOpen, openStatus, categories,
  deliveryZones, paymentMethods, supabaseUrl, ordersEnabled, socialLinks,
}: Props) {
  const [activeCategory, setActiveCategory] = useState("");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [dialogProduct, setDialogProduct] = useState<AnonProduct | null>(null);
  const [step, setStep] = useState<Step>("menu");
  const [cartOpen, setCartOpen] = useState(false);
  // Set to true inside addToCart when cart transitions from empty → non-empty.
  // Cleared by the auto-open effect once the product dialog has closed.
  const shouldAutoOpenRef = useRef(false);

  // Live status — refreshed every 60 s without full-page reload.
  const [liveStatus, setLiveStatus] = useState<BusinessOpenStatus | null>(openStatus ?? null);
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!key) return;
    const refresh = async () => {
      try {
        const res = await fetch(`${supabaseUrl}/rest/v1/rpc/get_business_open_status`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: key,
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({ p_restaurant_id: restaurant.id }),
        });
        if (res.ok) setLiveStatus((await res.json()) as BusinessOpenStatus | null);
      } catch { /* silent — keep last known status */ }
    };
    const t = setInterval(refresh, 60_000);
    return () => clearInterval(t);
  }, [supabaseUrl, restaurant.id]);

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

  // hasCoverImg kept for any remaining internal logic (not used in render).
  const hasCoverImg = !!coverUrl;

  const cartCount = cart.reduce((s, it) => s + it.quantity, 0);
  const cartTotal = cart.reduce((s, it) => s + it.unitPriceCents * it.quantity, 0);

  const totalCount = categories.reduce((s, c) => s + (c.products as AnonProduct[]).length, 0);

  // WA contact link for topbar (catalog mode only)
  // Use the server-validated WhatsApp URL for the topbar contact button (catalog mode).
  const topbarWaUrl = catalogOnly ? socialLinks.whatsapp : null;
  const hasSocial = !!(socialLinks.instagram || socialLinks.facebook || socialLinks.twitter || socialLinks.whatsapp);

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
      // Schedule cart auto-open when going from empty → non-empty.
      // The effect below waits until dialogProduct is null before opening.
      if (prev.length === 0) shouldAutoOpenRef.current = true;
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

  const clearCart = useCallback(() => setCart([]), []);

  // Auto-open the cart after the first product is added, but only once the
  // product modal has closed (requirement: don't open over an open modal).
  useEffect(() => {
    if (shouldAutoOpenRef.current && !dialogProduct && !cartOpen) {
      shouldAutoOpenRef.current = false;
      setCartOpen(true);
    }
  }, [dialogProduct, cartOpen]);

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

      {/* Topbar — búsqueda sticky; logo/nombre viven en el banner */}
      <header className="rm-topbar">
        <div className="rm-topbar-inner container">
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

          {topbarWaUrl && (
            <div className="rm-topbar-actions">
              <a href={topbarWaUrl} target="_blank" rel="noopener noreferrer" className="rm-topbar-wa"
                aria-label="Contactar por WhatsApp">
                <WaIcon />
                <span>Contactar</span>
              </a>
            </div>
          )}
        </div>
      </header>

      {/* Business header — siempre visible; reemplaza hero + id-bar */}
      <BizHeader
        restaurantId={restaurant.id}
        restaurantName={restaurant.name}
        config={config}
        liveStatus={liveStatus}
        logoUrl={logoUrl}
        coverUrl={coverUrl}
        primaryColor={primaryColor}
        socialLinks={socialLinks}
        supabaseUrl={supabaseUrl}
        fontStyle={fontFamilyStyle}
      />

      {/* Aviso de cierre temporal */}
      {closedMessage && (
        <div role="alert" className="rm-closed-notice">
          {closedMessage}
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
        {hasSocial && (
          <div className="rm-footer-social">
            <SocialBar links={socialLinks} />
          </div>
        )}
        <span>Creado con <strong style={{ color: "var(--menu-primary,var(--purple))", fontWeight: 600 }}>Wacatalog</strong></span>
      </footer>

      {/* FAB carrito — escritorio (opens side panel) */}
      {!catalogOnly && cartCount > 0 && (
        <button
          className="cart-fab"
          onClick={() => setCartOpen(true)}
          aria-label={`Ver pedido, ${cartCount} ${cartCount === 1 ? "producto" : "productos"}, subtotal ${money(cartTotal, cur)}`}
        >
          <CartIcon />
          <span className="cart-fab-label">Ver pedido</span>
          <span className="cart-fab-total" aria-hidden="true">{money(cartTotal, cur)}</span>
          <span className="cart-fab-count" aria-hidden="true">{cartCount}</span>
        </button>
      )}

      {/* Barra carrito — móvil (opens side panel) */}
      {!catalogOnly && cartCount > 0 && (
        <div className="cart-bar" role="complementary" aria-label="Resumen del pedido">
          <span className="cart-bar-qty">
            {cartCount} {cartCount === 1 ? "producto" : "productos"}
          </span>
          <button className="cart-bar-btn" onClick={() => setCartOpen(true)}>
            Ver pedido · {money(cartTotal, cur)}
          </button>
        </div>
      )}

      {/* Diálogos de producto */}
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

      {/* Panel de carrito lateral — solo en modo pedidos */}
      {!catalogOnly && cartOpen && (
        <CartPanel
          cart={cart}
          imgBase={imgBase}
          categories={categories}
          primaryColor={primaryColor}
          currency={cur}
          onClose={() => setCartOpen(false)}
          onChangeQty={changeQty}
          onRemove={removeFromCart}
          onClear={clearCart}
          onCheckout={() => { setCartOpen(false); setStep("checkout"); }}
        />
      )}
    </div>
  );
}
