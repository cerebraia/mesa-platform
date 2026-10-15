"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { DemoNotice } from "./brand";
import { catalog, money, type Product } from "@/lib/catalog";
import { calculateLine, selectionKey, type Selection } from "@/lib/pricing";

type Line = { key: string; product: Product; selection: Selection; quantity: number };

const CATS = ["Burgers", "Combos", "Bebidas"] as const;

export function MenuDemo() {
  const [query, setQuery]       = useState("");
  const [activeTab, setActiveTab] = useState("Todos");
  const [product, setProduct]   = useState<Product | null>(null);
  const [selection, setSelection] = useState<Selection>({ variantId: "", options: {} });
  const [quantity, setQuantity] = useState(1);
  const [cart, setCart]         = useState<Line[]>([]);
  const [error, setError]       = useState("");
  const [cartOpen, setCartOpen] = useState(false);

  const productDialog = useRef<HTMLDialogElement>(null);
  const cartDialog    = useRef<HTMLDialogElement>(null);
  const sectionRefs   = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    if (product) productDialog.current?.showModal();
    else productDialog.current?.close();
  }, [product]);

  useEffect(() => {
    if (cartOpen) cartDialog.current?.showModal();
    else cartDialog.current?.close();
  }, [cartOpen]);

  const subtotal = cart.reduce((s, l) => s + calculateLine(l.product, l.selection, l.quantity).total, 0);
  const count    = cart.reduce((s, l) => s + l.quantity, 0);

  function openProduct(p: Product) {
    setProduct(p);
    setQuantity(1);
    setError("");
    setSelection({ variantId: p.variants[0].id, options: Object.fromEntries(p.groups.map(g => [g.id, []])) });
  }

  // Productos sin opciones obligatorias ni variante múltiple → agregar directo.
  function needsConfig(p: Product) {
    return p.variants.length > 1 || p.groups.some(g => g.min > 0);
  }

  function addDirect(p: Product) {
    const sel: Selection = { variantId: p.variants[0].id, options: Object.fromEntries(p.groups.map(g => [g.id, []])) };
    try {
      calculateLine(p, sel, 1);
      const key = selectionKey(p.id, sel);
      setCart(prev => {
        const old = prev.find(l => l.key === key);
        return old
          ? prev.map(l => l.key === key ? { ...l, quantity: Math.min(l.quantity + 1, 20) } : l)
          : [...prev, { key, product: p, selection: sel, quantity: 1 }];
      });
    } catch { openProduct(p); }
  }

  function handleCardAdd(p: Product) {
    if (needsConfig(p)) openProduct(p);
    else addDirect(p);
  }

  function addToCart() {
    if (!product) return;
    try {
      calculateLine(product, selection, quantity);
      const key = selectionKey(product.id, selection);
      const existing = cart.find(l => l.key === key);
      if (existing && existing.quantity + quantity > 20) throw new Error("Máximo 20 unidades por configuración.");
      setCart(prev => {
        const old = prev.find(l => l.key === key);
        return old
          ? prev.map(l => l.key === key ? { ...l, quantity: l.quantity + quantity } : l)
          : [...prev, { key, product, selection, quantity }];
      });
      setProduct(null);
    } catch (e) { setError(e instanceof Error ? e.message : "Revisa tu selección."); }
  }

  function toggle(groupId: string, id: string, max: number) {
    setSelection(s => ({
      ...s,
      options: {
        ...s.options,
        [groupId]: max === 1
          ? [id]
          : (s.options[groupId] ?? []).includes(id)
            ? s.options[groupId].filter(x => x !== id)
            : [...(s.options[groupId] ?? []), id],
      },
    }));
    setError("");
  }

  function scrollToSection(tab: string) {
    setActiveTab(tab);
    if (tab === "Todos") { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    sectionRefs.current[tab]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  let dialogTotal = 0;
  if (product) {
    dialogTotal = (product.variants.find(v => v.id === selection.variantId)?.price ?? 0)
      + product.groups.reduce((s, g) =>
        s + g.options.filter(o => (selection.options[g.id] ?? []).includes(o.id)).reduce((a, o) => a + o.price, 0), 0);
  }

  function filtered(cat: string) {
    return catalog.filter(p => p.category === cat && p.name.toLowerCase().includes(query.toLowerCase()));
  }
  const hasResults = CATS.some(c => filtered(c).length > 0);

  return (
    <>
      <DemoNotice />

      {/* ── Cabecera del restaurante ─────────────────────────── */}
      <div className="resto-banner">
        <div className="resto-cover" aria-hidden="true" />
        <div className="container resto-meta">
          <span className="resto-avatar" aria-hidden="true">MB</span>
          <div className="resto-info">
            <h1 className="resto-name">Morado Burger</h1>
            <p className="resto-tagline">Buenos ingredientes. Mucho sabor.</p>
          </div>
          <div className="resto-status">
            <span className="resto-open-pill">● Abierto</span>
            <span className="resto-hours">Lun–Dom · 11:00–22:00 · Retiro y delivery</span>
          </div>
        </div>
      </div>

      {/* ── Barra fija: buscador + categorías ────────────────── */}
      <div className="menu-bar" role="search">
        <div className="container menu-bar-inner">
          <input
            className="menu-search"
            type="search"
            placeholder="¿Qué te provoca hoy?"
            value={query}
            onChange={e => { setQuery(e.target.value); setActiveTab("Todos"); }}
            aria-label="Buscar en el menú"
          />
          <nav className="menu-tabs" aria-label="Categorías del menú">
            {(["Todos", ...CATS] as const).map(c => (
              <button
                key={c}
                className={`menu-tab${activeTab === c ? " menu-tab--on" : ""}`}
                onClick={() => scrollToSection(c)}
                aria-pressed={activeTab === c}
              >
                {c}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* ── Productos por categoría ───────────────────────────── */}
      <main className="menu-main container">
        {query && !hasResults && (
          <p className="menu-empty">No encontramos productos con "{query}".</p>
        )}

        {CATS.map(cat => {
          const items = filtered(cat);
          if (!items.length) return null;
          return (
            <section
              key={cat}
              ref={el => { sectionRefs.current[cat] = el; }}
              className="menu-section"
              aria-labelledby={`heading-${cat}`}
            >
              <h2 id={`heading-${cat}`} className="menu-section-title">{cat}</h2>
              <div className="menu-grid">
                {items.map(p => (
                  <div key={p.id} className="menu-card">
                    {/* Botón principal: abre diálogo de personalización */}
                    <button
                      className="menu-card-inner"
                      onClick={() => openProduct(p)}
                      aria-label={`${p.name}${p.variants.length > 1 ? ", desde " : ", "}${money(p.variants[0].price)}`}
                    >
                      <div className="menu-card-info">
                        <b className="menu-card-name">{p.name}</b>
                        <p className="menu-card-desc">{p.description}</p>
                        <span className="menu-card-price">
                          {p.variants.length > 1 ? "Desde " : ""}{money(p.variants[0].price)}
                        </span>
                      </div>
                      <div className="menu-card-photo">
                        {p.image ? (
                          <Image
                            src={p.image}
                            alt={p.name}
                            fill
                            sizes="(max-width: 460px) 90px, 110px"
                            style={{ objectFit: "cover" }}
                          />
                        ) : (
                          <span className="menu-card-placeholder" aria-hidden="true">Foto</span>
                        )}
                      </div>
                    </button>

                    {/* Botón de agregar — fuera del botón principal, sin anidamiento */}
                    <button
                      className="menu-add-btn"
                      onClick={() => handleCardAdd(p)}
                      aria-label={`Agregar ${p.name} al pedido`}
                    >
                      <span aria-hidden="true">+</span>
                    </button>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </main>

      {/* ── Botón flotante del carrito (escritorio/tablet) ────── */}
      {count > 0 && (
        <button
          className="cart-fab"
          onClick={() => setCartOpen(true)}
          aria-label={`Ver pedido, ${count} ${count === 1 ? "producto" : "productos"}, subtotal ${money(subtotal)}`}
        >
          <span className="cart-fab-label" aria-hidden="true">Tu pedido</span>
          <span className="cart-fab-total" aria-hidden="true">{money(subtotal)}</span>
          <span className="cart-fab-count">{count}</span>
        </button>
      )}

      {/* ── Barra inferior de carrito (móvil) ────────────────── */}
      {count > 0 && (
        <div className="cart-bar" role="complementary" aria-label="Resumen del pedido">
          <span className="cart-bar-qty">{count} {count === 1 ? "producto" : "productos"}</span>
          <button className="cart-bar-btn" onClick={() => setCartOpen(true)}>
            Ver pedido · <b>{money(subtotal)}</b>
          </button>
        </div>
      )}

      {/* ── Diálogo del carrito ───────────────────────────────── */}
      <dialog
        ref={cartDialog}
        className="product-dialog"
        onCancel={() => setCartOpen(false)}
        onClose={() => setCartOpen(false)}
        aria-label="Tu pedido"
      >
        <div className="card-heading">
          <h2>Tu pedido</h2>
          <button className="icon-button" onClick={() => setCartOpen(false)} aria-label="Cerrar pedido">×</button>
        </div>
        {cart.length ? (
          cart.map(l => (
            <article className="cart-line" key={l.key}>
              <b>{l.product.name}</b>
              <span className="caption block">{calculateLine(l.product, l.selection, l.quantity).labels.join(" · ")}</span>
              <div className="cart-line-actions">
                <span>{l.quantity} × {money(calculateLine(l.product, l.selection, 1).unitPrice)}</span>
                <button className="text-link" onClick={() => setCart(c => c.filter(x => x.key !== l.key))}>Quitar</button>
              </div>
            </article>
          ))
        ) : (
          <p className="empty">Agrega algo rico para empezar.</p>
        )}
        <div className="cart-total">
          <b>Subtotal</b>
          <b>{money(subtotal)}</b>
        </div>
        <p className="caption">Entrega y pago se conectarán en la fase de pedidos.</p>
        <button className="button full" disabled>Compra real próximamente</button>
        <p className="caption">Este carrito es temporal y no envía pedidos.</p>
      </dialog>

      {/* ── Diálogo de personalización del producto ───────────── */}
      <dialog
        ref={productDialog}
        className="product-dialog"
        onCancel={() => setProduct(null)}
        onClose={() => setProduct(null)}
      >
        {product && (
          <>
            <div className="card-heading">
              <span className="eyebrow">PERSONALIZA TU PEDIDO</span>
              <button className="icon-button" aria-label="Cerrar" onClick={() => setProduct(null)}>×</button>
            </div>
            <h2>{product.name}</h2>
            <p className="muted">{product.description}</p>

            <fieldset>
              <legend>Elige tu presentación <span className="tag">Obligatorio</span></legend>
              {product.variants.map(v => (
                <label className="option-row" key={v.id}>
                  <span>
                    <input
                      type="radio"
                      name="variant"
                      checked={selection.variantId === v.id}
                      onChange={() => setSelection(s => ({ ...s, variantId: v.id }))}
                    />
                    {v.name}
                  </span>
                  <b>{money(v.price)}</b>
                </label>
              ))}
            </fieldset>

            {product.groups.map(g => (
              <fieldset key={g.id}>
                <legend>
                  {g.name}
                  <span className="tag">{g.min > 0 ? "Obligatorio" : "Opcional"} · Máx. {g.max}</span>
                </legend>
                {g.options.map(o => (
                  <label className="option-row" key={o.id}>
                    <span>
                      <input
                        type={g.max === 1 ? "radio" : "checkbox"}
                        name={g.id}
                        checked={(selection.options[g.id] ?? []).includes(o.id)}
                        onChange={() => toggle(g.id, o.id, g.max)}
                      />
                      {o.name}
                    </span>
                    <span>{o.price ? "+" + money(o.price) : "Incluido"}</span>
                  </label>
                ))}
              </fieldset>
            ))}

            <label className="quantity-label">
              Cantidad
              <input
                type="number"
                min={1}
                max={20}
                value={quantity}
                onChange={e => setQuantity(Number(e.target.value))}
              />
            </label>

            {error && <p className="error" role="alert">{error}</p>}

            <button className="button full" onClick={addToCart}>
              Agregar al pedido · {money(dialogTotal * quantity)}
            </button>
          </>
        )}
      </dialog>
    </>
  );
}
