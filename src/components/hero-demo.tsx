// HeroShowcase: composite hero visual.
// Panel (desktop) → Demo Tech Store management view.
// Phone (mobile)  → Restaurante Alfa catalog with real food photo.
// Both labeled as demonstration. No animation — layout stability first.

import Image from "next/image";

const PANEL_PRODUCTS = [
  { name: "Hub USB‑C 7 en 1",    price: "$29", bg: "#dce8f8" },
  { name: "Soporte para laptop", price: "$45", bg: "#d8f0e4" },
  { name: "Auriculares NC Pro",  price: "$89", bg: "#e0dcf4" },
  { name: "Cable USB‑C 2 m",    price: "$12", bg: "#e4e8f0" },
];

function SearchIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
    </svg>
  );
}

export function HeroShowcase() {
  return (
    <div className="lp-showcase" aria-hidden="true">

      {/* ── Desktop: panel ── */}
      <div className="lp-sc-browser">
        <div className="lp-sc-titlebar">
          <div className="lp-sc-dots">
            <span style={{ background: "#ff5f57" }} />
            <span style={{ background: "#febc2e" }} />
            <span style={{ background: "#28c840" }} />
          </div>
          <span className="lp-sc-url">mesa.app/panel/menu</span>
        </div>

        <div className="lp-sc-panel">
          <aside className="lp-sc-sidebar">
            <div className="lp-sc-brand">
              <span className="lp-sc-brand-icon">m</span>
              <span className="lp-sc-brand-text">mesa.</span>
            </div>
            <div className="lp-sc-workspace">
              <span className="lp-sc-ws-av">DT</span>
              <div>
                <span className="lp-sc-ws-name">Demo Tech Store</span>
                <span className="lp-sc-ws-role">Propietario</span>
              </div>
            </div>
            <nav className="lp-sc-nav">
              {["Inicio", "Catálogo", "Pedidos", "Configuración"].map((item, i) => (
                <span key={item} className={`lp-sc-nav-item${i === 1 ? " lp-sc-nav-item--on" : ""}`}>
                  {item}
                </span>
              ))}
            </nav>
          </aside>

          <div className="lp-sc-main">
            <div className="lp-sc-page-hdr">
              <span className="lp-sc-page-title">Catálogo</span>
              <span className="lp-sc-add-btn">+ Añadir</span>
            </div>
            <div className="lp-sc-products">
              {PANEL_PRODUCTS.map((p) => (
                <div key={p.name} className="lp-sc-prod-row">
                  <div className="lp-sc-prod-thumb" style={{ background: p.bg }} />
                  <span className="lp-sc-prod-name">{p.name}</span>
                  <span className="lp-sc-prod-price">{p.price}</span>
                  <span className="lp-sc-prod-status">Publicado</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Mobile: catalog (Restaurante Alfa, foto real) ── */}
      <div className="lp-sc-phone">
        <div className="lp-sc-phone-screen">
          {/* Store cover */}
          <div className="lp-sc-cover">
            <div className="lp-sc-cover-logo">RA</div>
            <div>
              <div className="lp-sc-cover-name">Restaurante Alfa</div>
              <div className="lp-sc-cover-open">● Abierto</div>
            </div>
          </div>
          {/* Search */}
          <div className="lp-sc-search-bar">
            <SearchIcon />
            <span>¿Qué te provoca hoy?</span>
          </div>
          {/* Category tabs */}
          <div className="lp-sc-cat-tabs">
            <span className="lp-sc-cat-tab lp-sc-cat-tab--on">Todos</span>
            <span className="lp-sc-cat-tab">Burgers</span>
            <span className="lp-sc-cat-tab">Bebidas</span>
          </div>
          {/* Product grid */}
          <div className="lp-sc-cat-grid">
            {/* Card 1: real burger photo */}
            <div className="lp-sc-cat-card">
              <div className="lp-sc-cat-img lp-sc-cat-img--photo">
                <Image
                  src="/images/burger-smash.png"
                  alt="Hamburguesa Smash"
                  width={110}
                  height={80}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              </div>
              <div className="lp-sc-cat-body">
                <span className="lp-sc-cat-name">Hamburguesa Smash</span>
                <span className="lp-sc-cat-price">$12.50</span>
              </div>
            </div>
            {/* Card 2: real burger photo (variant) */}
            <div className="lp-sc-cat-card">
              <div className="lp-sc-cat-img lp-sc-cat-img--photo">
                <Image
                  src="/images/burger-smash.png"
                  alt="Smash Doble"
                  width={110}
                  height={80}
                  style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "60% center", display: "block" }}
                />
              </div>
              <div className="lp-sc-cat-body">
                <span className="lp-sc-cat-name">Smash Doble</span>
                <span className="lp-sc-cat-price">$16.00</span>
              </div>
            </div>
            {/* Card 3 & 4: neutral placeholder */}
            {[
              { name: "Papas fritas", price: "$4.50" },
              { name: "Refresco", price: "$3.00" },
            ].map((p) => (
              <div key={p.name} className="lp-sc-cat-card">
                <div className="lp-sc-cat-img" style={{ background: "#e8ecf0" }} />
                <div className="lp-sc-cat-body">
                  <span className="lp-sc-cat-name">{p.name}</span>
                  <span className="lp-sc-cat-price">{p.price}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <span className="lp-showcase-label">Vista de demostración · datos ficticios</span>
    </div>
  );
}
