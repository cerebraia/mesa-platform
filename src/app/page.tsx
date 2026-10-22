import Link from "next/link";
import Image from "next/image";
import { Brand } from "@/components/brand";
import { SiteHeader } from "@/components/site-header";
import { PLAN_CATALOG } from "@/lib/plan-catalog";

// ── Helpers ───────────────────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// Solicitud por correo electrónico — el flujo de alta real.
const REQUEST_EMAIL = "contacto@mesa.app";
function requestHref(subject: string, body?: string) {
  const params = new URLSearchParams({ subject });
  if (body) params.set("body", body);
  return `mailto:${REQUEST_EMAIL}?${params.toString()}`;
}

export default function Home() {
  const defaultRequestHref = requestHref(
    "Solicitud de catálogo Mesa",
    "Hola,\n\nQuiero crear mi catálogo con Mesa.\n\nNombre del negocio: \nTipo de negocio: \nContacto: \n",
  );

  return (
    <>
      <SiteHeader />

      <main>
        {/* ── Hero ── */}
        <section className="hero container">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="status-dot" />
              TU VITRINA DIGITAL. TU MARCA.
            </div>
            <h1>
              Tus productos,<br />
              en una vitrina<br />
              <span>digital propia.</span>
            </h1>
            <p>
              Crea tu catálogo con fotos, precios y opciones. Personalízalo con tu marca
              y comparte un enlace para que tus clientes descubran lo que ofreces.
            </p>
            <div className="actions">
              <a className="button" href={defaultRequestHref}>
                Solicitar mi catálogo
              </a>
              <Link className="text-link" href="/demo/menu">
                Ver demostración →
              </Link>
            </div>
            <p className="caption">
              Mesa está en desarrollo activo. Solicitar no genera un cargo ni un compromiso.
            </p>
          </div>

          <div className="hero-device-art">
            <div className="hero-glow" aria-hidden="true" />
            <Image
              src="/images/mesa-hero.png"
              alt="Concepto de Mesa: catálogo digital con categorías, productos y opciones de personalización"
              width={1254}
              height={1254}
              priority
              sizes="(max-width: 760px) 90vw, 52vw"
            />
            <span className="hero-art-label">Vista conceptual del producto</span>
          </div>
        </section>

        {/* ── Benefit strip ── */}
        <section className="benefit-strip">
          <div className="container strip-grid">
            <span>Tu catálogo, con tu marca</span>
            <span>Fotos, precios y opciones</span>
            <span>Comparte un enlace</span>
            <span>Pedidos cuando lo necesites</span>
          </div>
        </section>

        {/* ── Funciones ── */}
        <section id="funciones" className="section container">
          <div className="section-heading">
            <span className="eyebrow">SENCILLO DE CREAR. FÁCIL DE COMPARTIR.</span>
            <h2>Un catálogo organizado<br />para cualquier tipo de negocio.</h2>
            <p>
              Tiendas de ropa, tecnología, accesorios, restaurantes y más.
              Mesa se adapta a lo que vendes.
            </p>
          </div>
          <div className="feature-grid">
            {[
              {
                n: "01",
                title: "Muestra lo que tienes",
                text: "Crea categorías, sube fotografías y define precios, variantes y opciones. Todo en un catálogo que se carga rápido en cualquier celular.",
              },
              {
                n: "02",
                title: "Tu marca, en primer plano",
                text: "Logo, portada y colores de tu negocio. Una experiencia que tus clientes reconocen como tuya, no como la de una plataforma.",
              },
              {
                n: "03",
                title: "Comparte en un clic",
                text: "Un enlace para WhatsApp, Instagram, TikTok o cualquier red. Sin descargas ni registro del cliente.",
              },
              {
                n: "04",
                title: "Pedidos cuando lo necesites",
                text: "Activa el carrito y recibe pedidos con variantes, extras, retiro y delivery. Una función adicional que puedes habilitar cuando tu negocio lo decida.",
              },
            ].map((f) => (
              <article className="feature" key={f.n}>
                <span className="feature-number">{f.n}</span>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ── Cómo funciona ── */}
        <section id="como-funciona" className="how-section">
          <div className="container section">
            <span className="eyebrow">DEL PRIMER PRODUCTO AL PRIMER CLIENTE</span>
            <h2>Todo empieza con tu catálogo.</h2>
            <div className="steps">
              {[
                [
                  "Añade tus productos",
                  "Crea categorías, sube fotos y define precios, variantes y opciones para cada artículo.",
                ],
                [
                  "Personaliza tu identidad",
                  "Logo, portada y colores de tu negocio. Configura también horarios, contacto y redes sociales.",
                ],
                [
                  "Comparte tu enlace",
                  "Tu catálogo listo para compartir. Activa el carrito y los pedidos cuando quieras empezar a recibirlos.",
                ],
              ].map(([title, desc], i) => (
                <article key={title}>
                  <span className="step-number">{i + 1}</span>
                  <h3>{title}</h3>
                  <p>{desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── Planes ── */}
        <section id="planes" className="section container">
          <div className="section-heading" style={{ marginBottom: 12 }}>
            <span className="eyebrow">PLANES Y PRECIOS</span>
            <h2>Elige el plan<br />de tu catálogo.</h2>
            <p className="section-description">
              Precios mensuales por negocio, en USD.
              Sin comisiones por producto ni por pedido.
            </p>
          </div>

          <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 40, maxWidth: 520 }}>
            Cada producto cuenta una vez, esté publicado o no.
            Sus variantes y opciones están incluidas sin costo adicional.
          </p>

          <div className="plan-grid">
            {PLAN_CATALOG.map((plan) => (
              <article
                key={plan.code}
                className={`plan-card${plan.badge ? " plan-card--featured" : ""}`}
                aria-label={`Plan ${plan.name}`}
              >
                {plan.badge && (
                  <div className="plan-card-badge">{plan.badge}</div>
                )}

                <div className="plan-card-header">
                  <h3 className="plan-card-name">{plan.name}</h3>
                  <p className="plan-card-desc">{plan.description_short}</p>
                </div>

                <div className="plan-card-price-block">
                  <span className="plan-card-price">{(plan.price_cents / 100).toFixed(0)}</span>
                  <span className="plan-card-currency">USD/mes</span>
                </div>
                <p className="plan-card-billing">por negocio · facturación mensual</p>

                <div className="plan-card-limits">
                  <span>
                    <strong>{plan.max_products}</strong> productos
                  </span>
                  <span>·</span>
                  <span>
                    <strong>{plan.max_members}</strong>{" "}
                    {plan.max_members === 1 ? "usuario" : "usuarios"}
                  </span>
                </div>

                <ul className="plan-card-features">
                  {plan.features.map((f) => (
                    <li key={f}>
                      <CheckIcon />
                      <span>{f}</span>
                    </li>
                  ))}
                  {plan.code === "acompanado" && (
                    <li className="plan-card-feature-note">
                      <span style={{ paddingLeft: 22 }}>
                        La capacidad de 400 productos no incluye la carga asistida de esos 400.
                        Un cambio asistido equivale a crear o actualizar un producto con la
                        información y archivos entregados por el cliente.
                        No incluye fotografía ni diseño.
                      </span>
                    </li>
                  )}
                </ul>

                <a
                  href={requestHref(
                    plan.contact_subject,
                    `Hola,\n\nQuiero solicitar el plan ${plan.name} para mi negocio.\n\nNombre del negocio: \nTipo de negocio: \nContacto: \n`,
                  )}
                  className={`plan-card-cta${plan.badge ? " plan-card-cta--primary" : ""}`}
                >
                  Solicitar {plan.name.replace("Mesa ", "")}
                </a>
                <p className="plan-card-cta-note">Solicitud por correo · sin cargo inmediato</p>
              </article>
            ))}
          </div>

          <p style={{ fontSize: 13, color: "var(--muted)", textAlign: "center", marginTop: 28, maxWidth: 560, margin: "28px auto 0" }}>
            El dominio propio se compra y renueva aparte, directamente con tu proveedor de DNS.
            Mesa configura la conexión una vez que el dominio esté activo.
          </p>
        </section>

        {/* ── FAQ ── */}
        <section className="section container faq">
          <h2>Antes de empezar.</h2>

          {[
            [
              "¿Qué tipos de negocio pueden usar Mesa?",
              "Cualquier negocio que venda productos: tiendas de ropa, tecnología, accesorios, restaurantes, panaderías y más. Mesa crea un catálogo digital; los pedidos en línea son una función adicional que cada negocio puede activar o no.",
            ],
            [
              "¿Qué cuenta como un producto?",
              'Cada artículo de tu catálogo cuenta una vez, esté publicado o en borrador. Sus variantes (por ejemplo "Talla S", "Talla M") y sus opciones o extras están incluidas sin consumir cupo adicional.',
            ],
            [
              "¿Puedo recibir pedidos a través del catálogo?",
              "Sí. Los pedidos son una función opcional que puedes activar o desactivar desde configuración. Cuando están activos, los clientes pueden añadir productos al carrito y enviarte un pedido con retiro o delivery. Cuando están desactivados, el catálogo funciona como vitrina y los clientes pueden consultar por WhatsApp.",
            ],
            [
              "¿Quiénes son los usuarios incluidos en el plan?",
              "Los usuarios corresponden a las membresías activas del negocio: propietario, atención y cocina (para restaurantes). El administrador de plataforma de Mesa no consume un cupo de tu negocio.",
            ],
            [
              "¿Qué incluye la ayuda de catálogo en Mesa Acompañado?",
              "Hasta 10 cambios al mes: crear o actualizar un producto con la información y los archivos que tú entregues. No incluye fotografía, diseño gráfico ni redacción extensa del contenido.",
            ],
            [
              "¿Cómo se compra y renueva el dominio propio?",
              "El dominio lo adquieres con tu proveedor de DNS. Mesa configura la conexión técnica. El costo del dominio no está incluido en ningún plan.",
            ],
            [
              "¿Cómo solicito un cambio de plan?",
              "Escríbenos indicando el plan actual, el plan al que quieres cambiar y el nombre de tu negocio. Los cambios no son automáticos y aplican a partir de la nueva suscripción.",
            ],
            [
              "¿Necesita el cliente instalar una aplicación?",
              "No. El cliente abre el catálogo desde un enlace en su navegador, sin instalar nada.",
            ],
          ].map(([q, a]) => (
            <details key={q}>
              <summary>{q}<span>+</span></summary>
              <p>{a}</p>
            </details>
          ))}
        </section>
      </main>

      <footer className="container site-footer">
        <Brand />
        <span>© 2026 Mesa · Nombre provisional</span>
        <Link href="/demo/admin">Administración de ejemplo</Link>
      </footer>
    </>
  );
}
