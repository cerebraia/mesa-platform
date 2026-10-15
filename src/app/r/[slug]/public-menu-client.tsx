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

// ── Product Dialog ────────────────────────────────────────────

function ProductDialog({
  product,
  imgBase,
  primaryColor,
  onClose,
  onAdd,
}: {
  product: AnonProduct;
  imgBase: string;
  primaryColor: string;
  onClose: () => void;
  onAdd: (entry: CartEntry) => void;
}) {
  const hasVariants = product.product_variants.length > 0;
  const [variantId, setVariantId] = useState(
    hasVariants ? product.product_variants[0].id : null,
  );
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

  const optionTotal = Object.values(selected)
    .flat()
    .reduce((sum, optId) => {
      const delta = product.option_groups
        .flatMap((g) => g.options)
        .find((o) => o.id === optId)?.price_delta_cents ?? 0;
      return sum + delta;
    }, 0);

  const unitPrice = variantPrice + optionTotal;
  const total = unitPrice * qty;

  const imgUrl = product.product_images?.[0]
    ? `${imgBase}/${product.product_images[0].storage_path}`
    : null;

  function toggleOption(groupId: string, optId: string, maxSel: number) {
    setSelected((prev) => {
      const cur = prev[groupId] ?? [];
      if (cur.includes(optId)) {
        return { ...prev, [groupId]: cur.filter((id) => id !== optId) };
      }
      if (cur.length >= maxSel) {
        if (maxSel === 1) return { ...prev, [groupId]: [optId] };
        return prev; // at max
      }
      return { ...prev, [groupId]: [...cur, optId] };
    });
  }

  function handleAdd() {
    setValidationError(null);
    // Validate groups
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
          groupId: g.id,
          groupName: g.name,
          optionId: optId,
          optionName: opt.name,
          priceDeltaCents: opt.price_delta_cents,
        };
      }),
    );

    const key = cartKey(product.id, variantId, options);
    const variant = product.product_variants.find((v) => v.id === variantId) ?? null;

    onAdd({
      key,
      productId: product.id,
      productName: product.name,
      variantId: variantId,
      variantName: variant?.name ?? null,
      options,
      quantity: qty,
      unitPriceCents: unitPrice,
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
      {imgUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imgUrl} alt={product.name} style={{ width: "100%", height: 180, objectFit: "cover", borderRadius: 10, display: "block", marginBottom: 8 }} />
      )}
      <h2>{product.name}</h2>
      {product.description && <p>{product.description}</p>}

      {hasVariants && (
        <fieldset>
          <legend>Variante <span style={{ background: "#f0eaff", color: "#703BE6", borderRadius: 20, padding: "2px 8px", fontSize: 11 }}>Obligatorio</span></legend>
          {product.product_variants.map((v) => (
            <div key={v.id} className="option-row">
              <span>
                <input
                  type="radio" name="variant" value={v.id}
                  checked={variantId === v.id}
                  onChange={() => setVariantId(v.id)}
                  style={{ accentColor: primaryColor }}
                />
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
            <span style={{ background: g.min_selections > 0 ? "#f0eaff" : "#f5f5f5", color: g.min_selections > 0 ? "#703BE6" : "#777", borderRadius: 20, padding: "2px 8px", fontSize: 11 }}>
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
                {opt.price_delta_cents !== 0 && (
                  <span>+{money(opt.price_delta_cents)}</span>
                )}
              </div>
            );
          })}
        </fieldset>
      ))}

      <div className="quantity-label">
        <span>Cantidad</span>
        <input
          type="number" min={1} max={20} value={qty}
          onChange={(e) => setQty(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
          style={{ width: 70 }}
        />
      </div>

      {validationError && <p className="error">{validationError}</p>}

      <button
        type="button"
        className="button full"
        style={{ background: primaryColor, borderColor: primaryColor }}
        onClick={handleAdd}
      >
        Agregar · {money(total)}
      </button>
    </dialog>
  );
}

// ── Checkout Form ─────────────────────────────────────────────

function CheckoutForm({
  restaurant,
  config,
  cart,
  deliveryZones,
  paymentMethods,
  onBack,
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
        options: it.options.map((o) => ({
          optionGroupId: o.groupId,
          optionId: o.optionId,
        })),
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
        const ok = json as PlaceOrderResponse;
        // Token was delivered via Set-Cookie — navigate to the clean confirmation URL.
        router.push(ok.redirectTo);
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
    // Generate a new idempotency key since the user confirmed a new total
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

      {/* Contact */}
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

      {/* Modality */}
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

      {/* Payment */}
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

      {/* Notes */}
      <div className="dashboard-card" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, marginBottom: 12 }}>Observaciones</h2>
        <textarea
          maxLength={500}
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Alergias, instrucciones especiales…"
          style={{ width: "100%", resize: "vertical", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px", fontSize: 13, fontFamily: "inherit" }}
        />
      </div>

      {/* Summary */}
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

      {/* Price changed alert */}
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

      <button
        type="button"
        className="button full"
        disabled={!canSubmit || isSubmitting}
        onClick={() => handleSubmit(total)}
        style={{ marginTop: 8 }}
      >
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
  deliveryZones, paymentMethods, supabaseUrl,
}: Props) {
  const [activeCategory, setActiveCategory] = useState(categories[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [dialogProduct, setDialogProduct] = useState<AnonProduct | null>(null);
  const [step, setStep] = useState<Step>("menu");

  const imgBase = `${supabaseUrl}/storage/v1/object/public/product-images`;
  const assetBase = `${supabaseUrl}/storage/v1/object/public/restaurant-assets`;
  const primaryColor = config?.primary_color ?? "#703BE6";
  const logoUrl = config?.logo_path ? `${assetBase}/${config.logo_path}` : null;
  const coverUrl = config?.cover_path ? `${assetBase}/${config.cover_path}` : null;
  const initials = restaurant.name.slice(0, 2).toUpperCase();

  const cartCount = cart.reduce((s, it) => s + it.quantity, 0);
  const cartTotal = cart.reduce((s, it) => s + it.unitPriceCents * it.quantity, 0);

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
    setCart((prev) => prev
      .map((e) => e.key === key ? { ...e, quantity: e.quantity + delta } : e)
      .filter((e) => e.quantity > 0),
    );
  }, []);

  const filtered = categories
    .map((cat) => ({
      ...cat,
      products: (cat.products as AnonProduct[]).filter((p) =>
        search ? p.name.toLowerCase().includes(search.toLowerCase()) || (p.description ?? "").toLowerCase().includes(search.toLowerCase()) : true,
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
    <div className="menu-container" style={{ "--menu-primary": primaryColor } as React.CSSProperties}>
      {closedMessage && (
        <div style={{ background: "#fff3cd", color: "#856404", textAlign: "center", padding: "10px 16px", fontSize: 13, borderBottom: "1px solid #ffc107" }}>
          {closedMessage}
        </div>
      )}

      {/* Header */}
      <div
        className="resto-banner"
        style={coverUrl ? {
          backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.45), rgba(0,0,0,0.55)), url(${coverUrl})`,
          backgroundSize: "cover", backgroundPosition: "center",
        } : undefined}
      >
        <div className="resto-cover" />
        <div className="container resto-meta">
          <div className="resto-avatar" style={logoUrl ? { background: "white", overflow: "hidden", padding: 0 } : undefined}>
            {logoUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={logoUrl} alt={`Logo de ${restaurant.name}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : initials}
          </div>
          <div className="resto-info">
            <div className="resto-name">{restaurant.name}</div>
            <div className="resto-tagline">{config?.description ?? "Menú en línea"}</div>
          </div>
          <div className="resto-status">
            <span className="resto-open-pill" style={isOpen
              ? { background: "rgba(74,222,128,0.25)", color: "#fff" }
              : { background: "rgba(255,255,255,0.15)", color: "#fff" }}
            >
              {isOpen ? "Abierto" : "Cerrado"}
            </span>
          </div>
        </div>
      </div>

      {/* Sticky nav */}
      <div className="menu-bar">
        <div className="menu-bar-inner container">
          <input
            type="search" className="menu-search" placeholder="Buscar…"
            value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Buscar"
          />
          <div className="menu-tabs" role="tablist">
            {categories.map((cat) => (
              <button
                key={cat.id} role="tab" aria-selected={activeCategory === cat.id}
                className={`menu-tab${activeCategory === cat.id ? " menu-tab--on" : ""}`}
                style={activeCategory === cat.id ? { color: primaryColor, borderBottomColor: primaryColor } : undefined}
                onClick={() => {
                  setActiveCategory(cat.id);
                  document.getElementById(`cat-${cat.id}`)?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Products */}
      <div className="menu-main container">
        {filtered.length === 0 && (
          <p className="menu-empty muted">No hay productos que coincidan.</p>
        )}
        {filtered.map((cat) => (
          <section key={cat.id} id={`cat-${cat.id}`} className="menu-section">
            <h2 className="menu-section-title">{cat.name}</h2>
            <div className="menu-grid">
              {(cat.products as AnonProduct[]).map((p) => {
                const img = p.product_images?.[0];
                const imgUrl = img ? `${imgBase}/${img.storage_path}` : null;
                const displayPrice = p.product_variants?.[0]?.price_cents ?? p.base_price_cents;
                return (
                  <button key={p.id} className="menu-card" style={{ all: "unset", cursor: "pointer", display: "block" }}
                    onClick={() => setDialogProduct(p)}
                  >
                    <div className="menu-card-inner">
                      <div className="menu-card-info">
                        <span className="menu-card-name">{p.name}</span>
                        {p.description && <span className="menu-card-desc">{p.description}</span>}
                        <span className="menu-card-price" style={{ color: primaryColor }}>
                          {p.promo_price_cents != null ? (
                            <>
                              <span style={{ textDecoration: "line-through", color: "var(--muted)", marginRight: 6, fontWeight: 400, fontSize: 11 }}>
                                {money(displayPrice)}
                              </span>
                              {money(p.promo_price_cents)}
                            </>
                          ) : money(displayPrice)}
                        </span>
                      </div>
                      <div className="menu-card-photo">
                        {imgUrl
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={imgUrl} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <div className="menu-card-placeholder"><span style={{ fontSize: 24 }}>🍽️</span></div>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {/* Cart — mobile bottom bar */}
      {cartCount > 0 && (
        <div className="mobile-cart" style={{ background: primaryColor, color: "white", borderRadius: 12, padding: "12px 20px" }}>
          <span style={{ fontWeight: 600 }}>{cartCount} {cartCount === 1 ? "producto" : "productos"}</span>
          <button
            type="button"
            style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "white", borderRadius: 8, padding: "8px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
            onClick={() => setStep("checkout")}
          >
            Ir al checkout · {money(cartTotal)}
          </button>
        </div>
      )}

      {/* Cart — desktop sidebar (simplified) */}
      {cartCount > 0 && (
        <div style={{ position: "fixed", right: 24, bottom: 24, display: "none" }}>
          {/* Desktop users use the mobile-cart bar which is always visible */}
        </div>
      )}

      <div className="container" style={{ textAlign: "center", padding: "24px 0 80px", fontSize: 11, color: "var(--muted)" }}>
        Menú en línea · {restaurant.name} · Desarrollado con Mesa
      </div>

      {/* Product dialog */}
      {dialogProduct && (
        <ProductDialog
          product={dialogProduct}
          imgBase={imgBase}
          primaryColor={primaryColor}
          onClose={() => setDialogProduct(null)}
          onAdd={addToCart}
        />
      )}
    </div>
  );
}
