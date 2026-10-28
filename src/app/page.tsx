import Link from "next/link";
import Image from "next/image";
import { Brand } from "@/components/brand";
import { SiteHeader } from "@/components/site-header";
import { HeroShowcase } from "@/components/hero-demo";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { PLAN_CATALOG } from "@/lib/plan-catalog";
import { MESA_WA_CTA_HREF, mesaWaHref } from "@/lib/contact";

// CTA principal → WhatsApp centralizado
const defaultHref = MESA_WA_CTA_HREF;

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ArrowRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

// ── Editorial feature block visuals ──────────────────────────────────────────

// Detalle ampliado de producto con fotografía real
function EdProductDetail() {
  return (
    <div className="lp-ed-product-detail">
      <div className="lp-ed-product-photo">
        <Image
          src="/images/burger-smash.png"
          alt="Hamburguesa Smash — ejemplo de producto en catálogo Mesa"
          width={480}
          height={220}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      </div>
      <div className="lp-ed-product-info">
        <div className="lp-ed-product-name-row">
          <span className="lp-ed-product-name">Hamburguesa Smash</span>
          <span className="lp-ed-product-price">$12.50</span>
        </div>
        <div>
          <div className="lp-ed-product-opt-label">Tamaño</div>
          <div className="lp-ed-product-opts">
            <span className="lp-ed-product-opt">Sencilla</span>
            <span className="lp-ed-product-opt lp-ed-product-opt--on">Doble</span>
            <span className="lp-ed-product-opt">Triple</span>
          </div>
        </div>
        <div>
          <div className="lp-ed-product-opt-label">Extras</div>
          <div className="lp-ed-product-opts">
            <span className="lp-ed-product-opt lp-ed-product-opt--on">Queso extra</span>
            <span className="lp-ed-product-opt">Bacon</span>
            <span className="lp-ed-product-opt">Aguacate</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function EdPanelRows() {
  return (
    <div className="lp-ed-panel-rows">
      {[
        { name: "Auriculares NC Pro",  price: "$89", bg: "#e4d8f4", status: "Publicado" },
        { name: "Hub USB‑C 7 en 1",   price: "$29", bg: "#dce8f8", status: "Publicado" },
        { name: "Soporte para laptop", price: "$45", bg: "#d8f0e4", status: "Borrador"  },
      ].map((p) => (
        <div key={p.name} className="lp-ed-panel-row">
          <div className="lp-ed-panel-thumb" style={{ background: p.bg }} />
          <span className="lp-ed-panel-name">{p.name}</span>
          <span className="lp-ed-panel-price">{p.price}</span>
          <span className={`lp-ed-panel-tag${p.status === "Publicado" ? " lp-ed-panel-tag--pub" : ""}`}>
            {p.status}
          </span>
        </div>
      ))}
    </div>
  );
}

function EdBrandPreview() {
  return (
    <div className="lp-ed-brand">
      <div className="lp-ed-brand-cover" />
      <div className="lp-ed-brand-row">
        <div className="lp-ed-brand-av">DT</div>
        <div>
          <div className="lp-ed-brand-name">Demo Tech Store</div>
          <div className="lp-ed-brand-url">mesa.app/r/demo-tech</div>
        </div>
      </div>
      <div className="lp-ed-brand-colors">
        <div className="lp-ed-brand-swatch" style={{ background: "#0f4c81" }} />
        <div className="lp-ed-brand-swatch" style={{ background: "#703be6" }} />
        <div className="lp-ed-brand-swatch" style={{ background: "#1a7d4c" }} />
        <div className="lp-ed-brand-swatch" style={{ background: "#c84b2f" }} />
        <span className="lp-ed-brand-color-label">Elige tu color</span>
      </div>
    </div>
  );
}

function EdShareBlock() {
  return (
    <div className="lp-ed-share">
      <div className="lp-ed-share-link">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
        <span className="lp-ed-share-url">mesa.app/r/demo-tech</span>
        <span className="lp-ed-share-copy">Copiar</span>
      </div>
      <div className="lp-ed-share-channels">
        {["WhatsApp", "Instagram", "TikTok", "Enlace en bio"].map((ch) => (
          <span key={ch} className="lp-ed-share-chip">{ch}</span>
        ))}
      </div>
    </div>
  );
}

// ── Dark discovery section cards ──────────────────────────────────────────────

function DiscoveryCards() {
  return (
    <div className="lp-disc-steps">
      {/* Step 1: Browse */}
      <div className="lp-disc-card">
        <div className="lp-disc-card-vis">
          <div className="lp-disc-mini-card" style={{ background: "#e4d8f4" }}>
            <span className="lp-disc-mini-name">Auriculares NC Pro</span>
            <span className="lp-disc-mini-price">$89</span>
          </div>
          <div className="lp-disc-mini-card lp-disc-mini-card--dim" style={{ background: "#dce8f8" }}>
            <span className="lp-disc-mini-name">Hub USB‑C</span>
            <span className="lp-disc-mini-price">$29</span>
          </div>
        </div>
        <div className="lp-disc-card-text">
          <span className="lp-disc-step-n">1</span>
          <span>Descubre el catálogo</span>
        </div>
      </div>

      <div className="lp-disc-arrow" aria-hidden="true">→</div>

      {/* Step 2: Product dialog */}
      <div className="lp-disc-card">
        <div className="lp-disc-card-vis">
          <div className="lp-disc-dialog">
            <div className="lp-disc-dialog-img" style={{ background: "#e4d8f4" }} />
            <div className="lp-disc-dialog-body">
              <div className="lp-disc-dialog-name">Auriculares NC Pro</div>
              <div className="lp-disc-dialog-price">$89</div>
              <div className="lp-disc-opts">
                <span>Negro</span>
                <span className="lp-disc-opt--on">Azul</span>
                <span>Blanco</span>
              </div>
            </div>
          </div>
        </div>
        <div className="lp-disc-card-text">
          <span className="lp-disc-step-n">2</span>
          <span>Revisa opciones</span>
        </div>
      </div>

      <div className="lp-disc-arrow" aria-hidden="true">→</div>

      {/* Step 3: WhatsApp ready */}
      <div className="lp-disc-card">
        <div className="lp-disc-card-vis">
          <div className="lp-disc-wa-preview">
            <div className="lp-disc-wa-bubble">
              Hola, me interesa el producto<br />
              <b>Auriculares NC Pro — Azul</b>
            </div>
            <div className="lp-disc-wa-btn">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="white" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 16.98c-.188.527-.91 1.01-1.51 1.143-.41.088-.942.158-2.738-.587-2.303-.944-3.787-3.29-3.902-3.443-.116-.152-.947-1.253-.947-2.39 0-1.138.595-1.698.806-1.93.211-.233.46-.29.614-.29l.443.008c.142.006.332-.054.518.396.19.458.646 1.578.702 1.693.056.116.093.252.018.406-.074.154-.112.25-.222.385-.11.134-.231.3-.33.403-.11.113-.224.235-.096.461.128.225.569.936 1.221 1.517.838.748 1.544.979 1.762 1.089.219.11.346.092.474-.056.129-.148.55-.641.697-.861.147-.22.293-.183.494-.11.2.073 1.27.598 1.488.708.219.11.364.164.418.256.054.091.054.527-.134 1.036z"/>
              </svg>
              Consultar por WhatsApp
            </div>
          </div>
        </div>
        <div className="lp-disc-card-text">
          <span className="lp-disc-step-n">3</span>
          <span>Consulta lista para enviar</span>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <>
      <SiteHeader requestHref={defaultHref} />

      <main>
        {/* ── 1. HERO OSCURO ─────────────────────────────────────────────── */}
        <section className="lp-hero-dark">
          <div className="container lp-hero-text">
            <h1 className="lp-hero-h1">
              Tus productos.<br />
              Tu catálogo.<br />
              Tu marca.
            </h1>
            <p className="lp-hero-desc">
              Muestra lo que vendes con fotos, precios y opciones.
              Comparte tu catálogo y facilita las consultas por WhatsApp.
            </p>
            <div className="lp-hero-ctas">
              <a className="lp-hero-cta-primary" href={defaultHref}>
                Solicitar mi catálogo
              </a>
              <Link className="lp-hero-cta-ghost" href="/r/demo-tech" target="_blank" rel="noopener">
                Explorar un catálogo <ArrowRight />
              </Link>
            </div>
          </div>
          <div className="container lp-showcase-container">
            <HeroShowcase />
          </div>
        </section>

        {/* ── 2. FRANJA DE INDUSTRIAS ─────────────────────────────────────── */}
        <div className="lp-ind-strip">
          <div className="container lp-ind-strip-inner">
            <span>Para tecnología, moda, accesorios, gastronomía y más.</span>
          </div>
        </div>

        {/* ── 3. CUADRÍCULA EDITORIAL ─────────────────────────────────────── */}
        <section id="funciones" className="lp-section container">
          <h2 className="lp-section-h2">Un catálogo que se adapta<br />a lo que vendes.</h2>

          <div className="lp-editorial">

            {/* Block grande: detalle de producto con foto real */}
            <div className="lp-ed-block lp-ed-big">
              <EdProductDetail />
              <div className="lp-ed-text">
                <span className="lp-ed-label">CATÁLOGO</span>
                <h3>Fotos, precios, variantes y opciones en cada producto.</h3>
                <p>El cliente ve todo antes de consultar o pedir. Sin instalación, desde cualquier navegador.</p>
              </div>
            </div>

            {/* Block: gestión */}
            <div className="lp-ed-block lp-ed-sm1">
              <div className="lp-ed-vis-wrap">
                <EdPanelRows />
              </div>
              <div className="lp-ed-text">
                <span className="lp-ed-label">GESTIÓN</span>
                <h3>Edita tu catálogo desde el panel.</h3>
                <p>Publica, actualiza precios y gestiona variantes desde cualquier dispositivo.</p>
              </div>
            </div>

            {/* Block: identidad */}
            <div className="lp-ed-block lp-ed-sm2">
              <div className="lp-ed-vis-wrap">
                <EdBrandPreview />
              </div>
              <div className="lp-ed-text">
                <span className="lp-ed-label">IDENTIDAD</span>
                <h3>Tu logo, portada y colores.</h3>
                <p>Una experiencia que tus clientes reconocen como tuya, no como la de una plataforma.</p>
              </div>
            </div>

            {/* Block ancho: compartir */}
            <div className="lp-ed-block lp-ed-wide">
              <div className="lp-ed-wide-inner">
                <div className="lp-ed-text">
                  <span className="lp-ed-label">DIFUSIÓN</span>
                  <h3>Un enlace para compartir en cualquier red.</h3>
                  <p>
                    WhatsApp, Instagram, TikTok o tu bio. Tus clientes acceden desde su
                    navegador, sin instalar nada ni registrarse.
                  </p>
                </div>
                <EdShareBlock />
              </div>
            </div>

          </div>
        </section>

        {/* ── 4. SECCIÓN OSCURA DE DESCUBRIMIENTO ────────────────────────── */}
        <section className="lp-dark-disc" id="como-funciona">
          <div className="container lp-dark-disc-inner">
            <div className="lp-dark-disc-text">
              <h2>Todo tu catálogo,<br />detrás de un solo enlace.</h2>
              <p>
                Tus clientes descubren tus productos, revisan opciones y te consultan
                por WhatsApp. Sin instalación ni registro.
              </p>
            </div>
            <DiscoveryCards />
          </div>
        </section>

        {/* ── 5. TRES PASOS ────────────────────────────────────────────────── */}
        <section className="lp-steps-section">
          <div className="container lp-steps-inner">
            <h2 className="lp-steps-h2">Tres pasos para empezar.</h2>
            <div className="lp-steps-grid">
              {[
                {
                  n: "01",
                  title: "Configura tu negocio",
                  desc: "Logo, portada, colores, horarios, dirección y contacto. Todo desde tu panel.",
                },
                {
                  n: "02",
                  title: "Añade tus productos",
                  desc: "Crea categorías, sube fotos y define precios, variantes y opciones para cada artículo.",
                },
                {
                  n: "03",
                  title: "Comparte tu enlace",
                  desc: "Tu catálogo listo para cualquier dispositivo. Activa el carrito cuando quieras empezar a recibir pedidos.",
                },
              ].map((s) => (
                <div key={s.n} className="lp-step-item">
                  <span className="lp-step-num" aria-hidden="true">{s.n}</span>
                  <h3 className="lp-step-title">{s.title}</h3>
                  <p className="lp-step-desc">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 6. DEMOSTRACIÓN EN VIVO ─────────────────────────────────────── */}
        <section id="demos" className="lp-section container">
          <div className="lp-live-demo">
            <div className="lp-live-demo-text">
              <span className="lp-live-eyebrow">EXPLORA EL PRODUCTO</span>
              <h2 className="lp-section-h2 lp-live-h2">
                Catálogos de ejemplo<br />para explorar en vivo.
              </h2>
              <p className="lp-live-desc">
                Navega dos demostraciones reales con datos ficticios: una tienda de
                tecnología en modo solo catálogo y un restaurante con pedidos activos.
              </p>
              <div className="lp-live-links">
                <Link href="/r/demo-tech" target="_blank" rel="noopener" className="button">
                  Demo Tech Store <ArrowRight />
                </Link>
                <Link href="/r/restaurante-alfa" target="_blank" rel="noopener" className="button secondary">
                  Restaurante Alfa <ArrowRight />
                </Link>
              </div>
              <p className="lp-live-note">
                Demostraciones con datos ficticios · Sin pedidos reales
              </p>
            </div>
            <div className="lp-live-demo-vis">
              <Image
                src="/images/mesa-hero.png"
                alt="Mesa — catálogo digital mostrado en tres teléfonos con menú, detalle de producto y estado del pedido"
                width={560}
                height={420}
                className="lp-live-hero-img"
                priority={false}
              />
            </div>
          </div>
        </section>

        {/* ── 7. PLANES ────────────────────────────────────────────────────── */}
        <section id="planes" className="lp-section container">
          <h2 className="lp-section-h2">Planes.</h2>
          <p className="lp-plans-sub">
            Precios mensuales por negocio, en USD. Sin comisiones por producto ni por pedido.
            Variantes y opciones incluidas en todos los planes.
          </p>

          <div className="lp-plan-grid">
            {PLAN_CATALOG.map((plan) => {
              const featured = !!plan.badge;
              return (
                <article
                  key={plan.code}
                  className={`lp-plan-card${featured ? " lp-plan-card--dark" : ""}`}
                  aria-label={`Plan ${plan.name}`}
                >
                  {featured && (
                    <div className="lp-plan-badge">{plan.badge}</div>
                  )}
                  <div className="lp-plan-hdr">
                    <h3 className="lp-plan-name">{plan.name}</h3>
                    <p className="lp-plan-desc">{plan.description_short}</p>
                  </div>
                  <div className="lp-plan-price-row">
                    <span className="lp-plan-price">{(plan.price_cents / 100).toFixed(0)}</span>
                    <span className="lp-plan-currency">USD/mes</span>
                  </div>
                  <p className="lp-plan-billing">por negocio · facturación mensual</p>
                  <div className="lp-plan-limits">
                    <span><strong>{plan.max_products}</strong> productos</span>
                    <span>·</span>
                    <span>
                      <strong>{plan.max_members}</strong>{" "}
                      {plan.max_members === 1 ? "usuario" : "usuarios"}
                    </span>
                  </div>
                  <ul className="lp-plan-feats">
                    {plan.features.slice(0, 6).map((f) => (
                      <li key={f}><CheckIcon /><span>{f}</span></li>
                    ))}
                    {plan.code === "acompanado" && (
                      <li className="lp-plan-feat-note">
                        <span>
                          Un cambio asistido = crear o actualizar un producto con los
                          archivos entregados. No incluye fotografía ni diseño.
                        </span>
                      </li>
                    )}
                  </ul>
                  <a
                    href={mesaWaHref(plan.wa_message)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`lp-plan-cta${featured ? " lp-plan-cta--featured" : ""}`}
                  >
                    Solicitar {plan.name.replace("Mesa ", "")}
                  </a>
                  <p className="lp-plan-cta-note">Consulta por WhatsApp · sin cargo inmediato</p>
                </article>
              );
            })}
          </div>

          <p className="lp-plans-domain">
            El dominio propio se compra y renueva aparte con tu proveedor de DNS.
            Mesa configura la conexión una vez que el dominio esté activo.
          </p>
        </section>

        {/* ── 8. FAQ ───────────────────────────────────────────────────────── */}
        <section className="lp-section container lp-faq-section">
          <h2 className="lp-section-h2">Preguntas frecuentes.</h2>

          {[
            ["¿Qué tipos de negocio pueden usar Mesa?",
              "Cualquier negocio que venda productos: tiendas de ropa, tecnología, accesorios, restaurantes, panaderías y más. Mesa crea un catálogo digital; los pedidos en línea son una función adicional que cada negocio puede activar o no."],
            ["¿Qué cuenta como un producto?",
              'Cada artículo de tu catálogo cuenta una vez, esté publicado o en borrador. Sus variantes (por ejemplo "Talla S", "Talla M") y sus opciones o extras están incluidas sin consumir cupo adicional.'],
            ["¿Puedo recibir pedidos a través del catálogo?",
              "Sí. Los pedidos son una función opcional que puedes activar o desactivar. Cuando están activos, los clientes pueden añadir productos al carrito y enviarte un pedido con retiro o delivery. Cuando están desactivados, el catálogo funciona como vitrina y los clientes pueden consultar por WhatsApp."],
            ["¿Necesita el cliente instalar una aplicación?",
              "No. El cliente abre el catálogo desde un enlace en su navegador. Sin instalación, sin registro."],
            ["¿Quiénes son los usuarios incluidos en el plan?",
              "Los usuarios corresponden a las membresías activas del negocio: propietario, atención y cocina. El administrador de plataforma de Mesa no consume un cupo de tu negocio."],
            ["¿Qué incluye la ayuda de catálogo en Mesa Acompañado?",
              "Hasta 10 cambios al mes: crear o actualizar un producto con la información y los archivos que tú entregues. No incluye fotografía, diseño gráfico ni redacción extensa del contenido."],
            ["¿Cómo se compra y renueva el dominio propio?",
              "El dominio lo adquieres con tu proveedor de DNS. Mesa configura la conexión técnica. El costo del dominio no está incluido en ningún plan."],
            ["¿Cómo solicito un cambio de plan?",
              "Escríbenos indicando el plan actual, el plan al que quieres cambiar y el nombre de tu negocio. Los cambios no son automáticos y aplican a partir de la nueva suscripción."],
          ].map(([q, a]) => (
            <details key={q} className="lp-faq-item">
              <summary className="lp-faq-summary">{q}<span aria-hidden="true">+</span></summary>
              <p className="lp-faq-answer">{a}</p>
            </details>
          ))}
        </section>

        {/* ── 9. CIERRE OSCURO ─────────────────────────────────────────────── */}
        <section className="lp-close-dark">
          <div className="container lp-close-inner">
            <h2 className="lp-close-h2">
              Tu catálogo,<br />listo para compartir.
            </h2>
            <p className="lp-close-desc">
              Empieza con tus productos y tu marca. Añade pedidos cuando los necesites.
            </p>
            <a href={defaultHref} className="lp-close-cta">
              Solicitar mi catálogo
            </a>
          </div>
        </section>

      </main>

      {/* ── FOOTER ─────────────────────────────────────────────────────────── */}
      <footer className="lp-close-dark lp-footer-dark">
        <div className="container lp-footer-inner">
          <div className="lp-footer-brand">
            <Brand />
            <span className="lp-footer-copy">© 2026 Mesa · Nombre provisional</span>
          </div>
          <nav className="lp-footer-nav" aria-label="Footer">
            <a href="#funciones">Funciones</a>
            <a href="#planes">Planes</a>
            <Link href="/r/demo-tech">Demo Tech</Link>
            <Link href="/r/restaurante-alfa">Demo Restaurante</Link>
            <Link href="/login">Ingresar</Link>
          </nav>
        </div>
      </footer>

      <WhatsAppButton />
    </>
  );
}
