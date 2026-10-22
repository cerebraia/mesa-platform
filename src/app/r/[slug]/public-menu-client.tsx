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
  product_images: Array<{ id: string; storage_path: string; alt_text: string | null; position: number }>;
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
  // orders_enabled from restaurant_config (migration 024). DEFAULT true for existing businesses.
  ordersEnabled: boolean;
}

type Step = "menu" | "checkout";

// ── Helpers ───────────────────────────────────────────────────

function money(cents: number) {
  return new Intl.NumberFormat("es-VE", { style: "currency", currency: "USD" }).format(cents / 100);
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

function CupIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
      <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
      <line x1="6" y1="1" x2="6" y2="4" /><line x1="10" y1="1" x2="10" y2="4" /><line x1="14" y1="1" x2="14" y2="4" />
    </svg>
  );
}

// ── Product Card ───────────────────────────────────────────────

function ProductCard({
  product,
  imgBase,
  primaryColor,
  ordersEnabled,
  onOpen,
}: {
  product: AnonProduct;
  imgBase: string;
  primaryColor: string;
  ordersEnabled: boolean;
  onOpen: () => void;
}) {
  const img = product.product_images?.[0];
  const imgUrl = img ? `${imgBase}/${img.storage_path}` : null;
  const displayPrice = product.product_variants?.[0]?.price_cents ?? product.base_price_cents;
  const hasPromo = product.promo_price_cents != null;

  return (
    <div className="menu-card">
      <div
        className="menu-card-inner"
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
        aria-label={`Ver ${product.name}`}
      >
        <div className="menu-card-info">
          <span className="menu-card-name">{product.name}</span>
          {product.description && (
            <span className="menu-card-desc">{product.description}</span>
          )}
          <span className="menu-card-price" style={{ color: primaryColor }}>
            {hasPromo ? (
              <>
                <span className="menu-card-price-orig">{money(displayPrice)}</span>
                {money(product.promo_price_cents!)}
              </>
            ) : money(displayPrice)}
          </span>
        </div>
        <div className="menu-card-photo">
          {imgUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imgUrl}
              alt={img?.alt_text ?? product.name}
              loading="lazy"
              decoding="async"
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          ) : (
            <div className="menu-card-placeholder">
              <CupIcon />
            </div>
          )}
        </div>
      </div>

      {/* Botón "+" — solo cuando los pedidos están habilitados */}
      {ordersEnabled && (
        <button
          className="menu-add-btn"
          aria-label={`Agregar ${product.name} al carrito`}
          style={{ background: primaryColor }}
          onClick={onOpen}
          tabIndex={-1}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="3" strokeLinecap="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ── Catalog Product Dialog (solo catálogo, sin carrito) ───────
// Muestra detalles del producto. Si existe WhatsApp, ofrece consulta.

function CatalogProductDialog({
  product,
  imgBase,
  primaryColor,
  whatsapp,
  restaurantName,
  onClose,
}: {
  product: AnonProduct;
  imgBase: string;
  primaryColor: string;
  whatsapp: string | null;
  restaurantName: string;
  onClose: () => void;
}) {
  const [variantId, setVariantId] = useState(
    product.product_variants.length > 0 ? product.product_variants[0].id : null,
  );
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
    return () => dialogRef.current?.close();
  }, []);

  const imgUrl = product.product_images?.[0]
    ? `${imgBase}/${product.product_images[0].storage_path}` : null;

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

  return (
    <dialog
      ref={dialogRef}
      className="product-dialog"
      onClick={(e) => { if (e.target === dialogRef.current) onClose(); }}
      onCancel={onClose}
    >
      {imgUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imgUrl} alt={product.name}
          style={{ width: "100%", height: 240, objectFit: "cover", display: "block",
            borderRadius: "18px 18px 0 0" }} />
      )}

      <div style={{ padding: imgUrl ? "20px 24px 0" : "24px 24px 0" }}>
        <h2 style={{ fontSize: 22, letterSpacing: "-.5px", fontWeight: 700, lineHeight: 1.2 }}>
          {product.name}
        </h2>
        {product.description && (
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 6, lineHeight: 1.6 }}>
            {product.description}
          </p>
        )}
        <p style={{ fontSize: 15, fontWeight: 700, color: primaryColor, marginTop: 10 }}>
          {money(product.promo_price_cents ?? (product.product_variants[0]?.price_cents ?? product.base_price_cents))}
        </p>
      </div>

      {/* Variantes — modo informativo para contextualizar la consulta WA */}
      {product.product_variants.length > 0 && (
        <fieldset>
          <legend>Variante <span style={{ background: "#f0eaff", color: "#703BE6", borderRadius: 20, padding: "2px 8px", fontSize: 11 }}>Selecciona</span></legend>
          {product.product_variants.map((v) => (
            <div key={v.id} className="option-row">
              <span>
                <input type="radio" name="catalog-variant" value={v.id}
                  checked={variantId === v.id} onChange={() => setVariantId(v.id)}
                  style={{ accentColor: primaryColor }} />
                {v.name}
              </span>
              <span>{money(v.price_cents)}</span>
            </div>
          ))}
        </fieldset>
      )}

      {/* Opciones — informativas */}
      {product.option_groups.map((g) => (
        <fieldset key={g.id}>
          <legend>{g.name} <span style={{ background: "#f5f5f5", color: "#777", borderRadius: 20, padding: "2px 8px", fontSize: 11 }}>Opcional</span></legend>
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
                {opt.price_delta_cents !== 0 && <span>+{money(opt.price_delta_cents)}</span>}
              </div>
            );
          })}
        </fieldset>
      ))}

      <div style={{ padding: "16px 24px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
        {waUrl ? (
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="button full"
            style={{ background: "#25d366", borderColor: "#25d366", textDecoration: "none" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
            </svg>
            Consultar por WhatsApp
          </a>
        ) : (
          <p style={{ fontSize: 12, color: "var(--muted)", textAlign: "center" }}>
            Contacta al negocio para consultar disponibilidad.
          </p>
        )}
        <button type="button" onClick={onClose}
          style={{ background: "none", border: "1px solid var(--border)", borderRadius: 10,
            padding: "10px", fontSize: 13, cursor: "pointer", color: "var(--muted)" }}>
          Cerrar
        </button>
      </div>
    </dialog>
  );
}

// ── Product Dialog ────────────────────────────────────────────

function ProductDialog({
  product, imgBase, primaryColor, onClose, onAdd,
}: {
  product: AnonProduct;
  imgBase: string;
  primaryColor: string;
  onClose: () => void;
  onAdd: (entry: CartEntry) => void;
}) {
  const hasVariants = product.product_variants.length > 0;
  const [variantId, setVariantId] = useState(hasVariants ? product.product_variants[0].id : null);
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [qty, setQty] = useState(1);
  const [validationError, setValidationError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
    return () => dialogRef.current?.close();
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

  const imgUrl = product.product_images?.[0]
    ? `${imgBase}/${product.product_images[0].storage_path}` : null;

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
      {/* Imagen al borde — sin padding para que llegue al radio del dialog */}
      {imgUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imgUrl} alt={product.name}
          style={{ width: "100%", height: 240, objectFit: "cover", display: "block",
            borderRadius: "18px 18px 0 0" }} />
      )}

      {/* Contenido con padding lateral */}
      <div style={{ padding: imgUrl ? "20px 24px 0" : "24px 24px 0" }}>
        <h2 style={{ fontSize: 22, letterSpacing: "-.5px", fontWeight: 700, lineHeight: 1.2 }}>{product.name}</h2>
        {product.description && (
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 6, lineHeight: 1.6 }}>{product.description}</p>
        )}
      </div>

      {hasVariants && (
        <fieldset>
          <legend>
            Variante{" "}
            <span style={{ background: "#f0eaff", color: "#703BE6", borderRadius: 20, padding: "2px 8px", fontSize: 11 }}>
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
              <span>{money(v.price_cents)}</span>
            </div>
          ))}
        </fieldset>
      )}

      {product.option_groups.map((g) => (
        <fieldset key={g.id}>
          <legend>
            {g.name}{" "}
            <span style={{
              background: g.min_selections > 0 ? "#f0eaff" : "#f5f5f5",
              color: g.min_selections > 0 ? "#703BE6" : "#777",
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
                  <input
                    type={g.max_selections === 1 ? "radio" : "checkbox"}
                    name={`group-${g.id}`}
                    checked={isSel}
                    onChange={() => toggleOption(g.id, opt.id, g.max_selections)}
                    style={{ accentColor: primaryColor }}
                  />
                  {opt.name}
                </span>
                {opt.price_delta_cents !== 0 && <span>+{money(opt.price_delta_cents)}</span>}
              </div>
            );
          })}
        </fieldset>
      ))}

      <div className="quantity-label">
        <span>Cantidad</span>
        <input type="number" min={1} max={20} value={qty}
          onChange={(e) => setQty(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
          style={{ width: 70 }} />
      </div>

      {validationError && <p className="error" style={{ padding: "0 24px 8px" }}>{validationError}</p>}

      <div style={{ padding: "0 24px 24px" }}>
        <button type="button" className="button full"
          style={{ background: primaryColor, borderColor: primaryColor }}
          onClick={handleAdd}>
          Agregar · {money(total)}
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
                      {z.name} — {money(z.fee_cents)}
                      {z.minimum_order_cents > 0 ? ` (mín. ${money(z.minimum_order_cents)})` : ""}
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
            <span style={{ flexShrink: 0 }}>{money(it.unitPriceCents * it.quantity)}</span>
          </div>
        ))}
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, marginTop: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
            <span style={{ color: "#777" }}>Subtotal</span><span>{money(subtotal)}</span>
          </div>
          {modality === "delivery" && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
              <span style={{ color: "#777" }}>Delivery</span><span>{money(deliveryFee)}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 16, borderTop: "1px solid var(--border)", paddingTop: 8, marginTop: 4 }}>
            <span>Total</span><span>{money(total)}</span>
          </div>
        </div>
      </div>

      {priceChanged && (
        <div style={{ background: "#fff3cd", border: "1px solid #ffc107", borderRadius: 10, padding: "14px 18px", marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Los precios cambiaron</div>
          <div style={{ fontSize: 13 }}>
            Subtotal: {money(priceChanged.sub)} | Delivery: {money(priceChanged.fee)} | <strong>Total: {money(priceChanged.actual)}</strong>
          </div>
          <button type="button" className="button small" style={{ marginTop: 10 }} onClick={onConfirmPriceChange} disabled={isSubmitting}>
            Confirmar con el nuevo total
          </button>
        </div>
      )}

      {error && <p className="auth-error" role="alert">{error}</p>}

      <button type="button" className="button full" disabled={!canSubmit || isSubmitting}
        onClick={() => handleSubmit(total)} style={{ marginTop: 8 }}>
        {isSubmitting ? "Enviando pedido…" : `Confirmar pedido · ${money(total)}`}
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
  const [activeCategory, setActiveCategory] = useState(categories[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [dialogProduct, setDialogProduct] = useState<AnonProduct | null>(null);
  const [step, setStep] = useState<Step>("menu");

  // Catalog mode: orders are disabled for this business
  const catalogOnly = !ordersEnabled;

  const imgBase = `${supabaseUrl}/storage/v1/object/public/product-images`;
  const assetBase = `${supabaseUrl}/storage/v1/object/public/restaurant-assets`;
  const primaryColor = config?.primary_color ?? "#703BE6";
  const logoUrl = config?.logo_path ? `${assetBase}/${config.logo_path}` : null;
  const coverUrl = config?.cover_path ? `${assetBase}/${config.cover_path}` : null;
  const initials = restaurant.name.slice(0, 2).toUpperCase();

  const cartCount = cart.reduce((s, it) => s + it.quantity, 0);
  const cartTotal = cart.reduce((s, it) => s + it.unitPriceCents * it.quantity, 0);

  // Prevent IntersectionObserver from fighting with programmatic scroll
  const scrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function scrollToCategory(catId: string) {
    setActiveCategory(catId);
    scrollingRef.current = true;
    clearTimeout(scrollTimeoutRef.current);
    document.getElementById(`cat-${catId}`)?.scrollIntoView({ behavior: "smooth" });
    scrollTimeoutRef.current = setTimeout(() => { scrollingRef.current = false; }, 900);
  }

  // Update active category based on scroll position
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
      { rootMargin: "-108px 0px -45% 0px", threshold: 0 },
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

  // Needed to avoid TS unused-variable errors on removeFromCart/changeQty
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
    <div style={{ "--menu-primary": primaryColor } as React.CSSProperties}>

      {/* Temporarily-closed notice */}
      {closedMessage && (
        <div role="alert" style={{
          background: "#fff3cd", color: "#856404", textAlign: "center",
          padding: "10px 16px", fontSize: 13, borderBottom: "1px solid #ffc107",
        }}>
          {closedMessage}
        </div>
      )}

      {/* Cover / portada panorámica */}
      <div
        className="rm-cover"
        style={coverUrl ? { backgroundImage: `url(${coverUrl})` } : undefined}
        role="banner"
      >
        <div className="rm-cover-overlay" aria-hidden="true" />
        <div className="container">
          <div className="rm-cover-row">
            <div className="rm-logo">
              {logoUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={logoUrl} alt={`Logo de ${restaurant.name}`} />
                : <span aria-hidden="true">{initials}</span>}
            </div>
            <div className="rm-info">
              <h1 className="rm-restaurant-name">{restaurant.name}</h1>
              {config?.description && (
                <p className="rm-restaurant-desc">{config.description}</p>
              )}
            </div>
            <div className="rm-status-area">
              <span className={`rm-pill ${isOpen ? "rm-pill-open" : "rm-pill-closed"}`}>
                <span
                  className={`rm-pill-dot ${isOpen ? "rm-pill-dot-open" : "rm-pill-dot-closed"}`}
                  aria-hidden="true"
                />
                {isOpen ? "Abierto" : "Cerrado"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky nav: search + category tabs */}
      <div className="menu-bar">
        <div className="menu-bar-inner container">
          <div className="rm-search-wrap">
            <SearchIcon className="rm-search-icon" />
            <input
              className="rm-search-input"
              type="search"
              placeholder={catalogOnly ? "¿Qué estás buscando?" : "¿Qué te provoca hoy?"}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar en el catálogo"
            />
            {search && (
              <button
                className="rm-search-clear"
                onClick={() => setSearch("")}
                aria-label="Limpiar búsqueda"
              >
                ✕
              </button>
            )}
          </div>
          <div className="menu-tabs" role="tablist" aria-label="Categorías del menú">
            {categories.map((cat) => (
              <button
                key={cat.id}
                role="tab"
                aria-selected={activeCategory === cat.id}
                className={`menu-tab${activeCategory === cat.id ? " menu-tab--on" : ""}`}
                style={activeCategory === cat.id ? { color: primaryColor, borderBottomColor: primaryColor } : undefined}
                onClick={() => scrollToCategory(cat.id)}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Catalog */}
      <main className="container menu-main">
        {filtered.length === 0 && (
          <div className="rm-empty" role="status" aria-live="polite">
            <span className="rm-empty-icon" aria-hidden="true">🔍</span>
            <p className="rm-empty-text">No encontramos «{search}» en el menú.</p>
            <button className="rm-empty-clear" onClick={() => setSearch("")}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              Limpiar búsqueda
            </button>
          </div>
        )}
        {filtered.map((cat) => (
          <section key={cat.id} id={`cat-${cat.id}`} className="menu-section">
            <h2 className="menu-section-title">{cat.name}</h2>
            <div className="menu-grid">
              {(cat.products as AnonProduct[]).map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  imgBase={imgBase}
                  primaryColor={primaryColor}
                  ordersEnabled={ordersEnabled}
                  onOpen={() => setDialogProduct(p)}
                />
              ))}
            </div>
          </section>
        ))}
      </main>

      {/* Footer */}
      <footer className="rm-footer">
        Creado con <strong style={{ color: "var(--purple)", fontWeight: 600 }}>Mesa</strong>
      </footer>

      {/* Cart FAB — desktop/tablet (orders mode only) */}
      {!catalogOnly && cartCount > 0 && (
        <button
          className="cart-fab"
          style={{ background: primaryColor }}
          onClick={() => setStep("checkout")}
          aria-label={`Ver pedido, ${cartCount} ${cartCount === 1 ? "producto" : "productos"}, total ${money(cartTotal)}`}
        >
          <CartIcon />
          <span className="cart-fab-label">Ver pedido</span>
          <span className="cart-fab-total" aria-hidden="true">{money(cartTotal)}</span>
          <span className="cart-fab-count" aria-hidden="true">{cartCount}</span>
        </button>
      )}

      {/* Cart bar — mobile (orders mode only) */}
      {!catalogOnly && cartCount > 0 && (
        <div
          className="cart-bar"
          style={{ background: primaryColor }}
          role="complementary"
          aria-label="Resumen del pedido"
        >
          <span className="cart-bar-qty">
            {cartCount} {cartCount === 1 ? "producto" : "productos"}
          </span>
          <button
            className="cart-bar-btn"
            onClick={() => setStep("checkout")}
          >
            Ver pedido · {money(cartTotal)}
          </button>
        </div>
      )}

      {/* Product dialog — orders mode */}
      {!catalogOnly && dialogProduct && (
        <ProductDialog
          product={dialogProduct}
          imgBase={imgBase}
          primaryColor={primaryColor}
          onClose={() => setDialogProduct(null)}
          onAdd={addToCart}
        />
      )}

      {/* Catalog dialog — catalog-only mode */}
      {catalogOnly && dialogProduct && (
        <CatalogProductDialog
          product={dialogProduct}
          imgBase={imgBase}
          primaryColor={primaryColor}
          whatsapp={config?.whatsapp ?? null}
          restaurantName={restaurant.name}
          onClose={() => setDialogProduct(null)}
        />
      )}
    </div>
  );
}
