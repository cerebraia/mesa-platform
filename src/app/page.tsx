import Link from "next/link";
import Image from "next/image";
import { Brand } from "@/components/brand";
import { SiteHeader } from "@/components/site-header";
import { PLAN_CATALOG } from "@/lib/plan-catalog";

// ── Pricing helpers ───────────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default function Home() {
  return (
    <>
      <SiteHeader />

      <main>
        {/* ── Hero ── */}
        <section className="hero container">
          <div className="hero-copy">
            <div className="eyebrow"><span className="status-dot"/> TU RESTAURANTE. TU PROPIO CANAL.</div>
            <h1>Tu restaurante.<br/>Tu menú.<br/><span>Más conectado.</span></h1>
            <p>Una experiencia sencilla para elegir, personalizar y pedir. Un espacio para que tu equipo mantenga todo en orden.</p>
            <div className="actions">
              <Link className="button" href="/demo/menu">Ver menú de ejemplo ↗</Link>
              <Link className="text-link" href="/demo/panel">Conocer la operación →</Link>
            </div>
            <p className="caption">Mesa está en desarrollo activo. Explora una demostración del producto.</p>
          </div>

          <div className="hero-device-art">
            <div className="hero-glow" aria-hidden="true"/>
            <Image
              src="/images/mesa-hero.png"
              alt="Concepto de Mesa en tres teléfonos: menú, opciones del producto y seguimiento del pedido"
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
            <span>Tu marca, al frente</span>
            <span>Opciones y extras claros</span>
            <span>Pedidos organizados</span>
            <span>Tu propio enlace</span>
          </div>
        </section>

        {/* ── Funciones ── */}
        <section id="funciones" className="section container">
          <div className="section-heading">
            <span className="eyebrow">SENCILLO POR FUERA. ORGANIZADO POR DENTRO.</span>
            <h2>Una mesa para todo<br/>lo que pasa en tu negocio.</h2>
            <p>Diseñamos cada paso alrededor del cliente y de quienes preparan su pedido.</p>
          </div>
          <div className="feature-grid">
            {[
              {n:"01", title:"Un menú que abre el apetito",    text:"Categorías, fotografías, precios y promociones. Una experiencia compacta que se adapta al celular."},
              {n:"02", title:"Cada pedido, a su gusto",        text:"Tamaños, variantes, extras y opciones obligatorias. El cliente ve su selección y el total."},
              {n:"03", title:"Un equipo en sintonía",          text:"Atención y cocina con vistas según su función. Estados claros desde la recepción hasta la entrega."},
              {n:"04", title:"Una dirección propia",           text:"Un subdominio para empezar y la opción de conectar el dominio del restaurante."},
            ].map(f => (
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
            <span className="eyebrow">DE LA CONFIGURACIÓN AL PRIMER PEDIDO</span>
            <h2>Todo empieza con tu menú.</h2>
            <div className="steps">
              {[
                ["Configura tu negocio",  "Logo, horarios, medios de pago y zonas de entrega."],
                ["Publica tu menú",       "Productos, fotos y opciones que reflejan tu oferta."],
                ["Organiza tus pedidos",  "Tu equipo recibe el detalle y actualiza cada estado."],
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
            <h2>Elige el plan<br/>de tu restaurante.</h2>
            <p className="section-description">
              Precios mensuales por restaurante, en USD.
              Sin comisiones por pedido.
            </p>
          </div>

          <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 40, maxWidth: 520 }}>
            Cada producto cuenta una vez, esté publicado o no. Sus variantes y extras están incluidos sin costo adicional.
          </p>

          {/* Pricing grid */}
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
                <p className="plan-card-billing">por restaurante · facturación mensual</p>

                <div className="plan-card-limits">
                  <span>
                    <strong>{plan.max_products}</strong> productos
                  </span>
                  <span>·</span>
                  <span>
                    <strong>{plan.max_members}</strong> {plan.max_members === 1 ? "usuario" : "usuarios"}
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
                        Un cambio asistido equivale a crear o actualizar un producto con información
                        entregada por el cliente. No incluye fotografía ni diseño.
                      </span>
                    </li>
                  )}
                </ul>

                <a
                  href={`mailto:contacto@mesa.app?subject=${encodeURIComponent(plan.contact_subject)}&body=${encodeURIComponent(`Hola,\n\nQuiero solicitar el plan ${plan.name} para mi restaurante.\n\nNombre del restaurante: \nContacto: \n`)}`}
                  className={`plan-card-cta${plan.badge ? " plan-card-cta--primary" : ""}`}
                >
                  Solicitar {plan.name.replace("Mesa ", "")}
                </a>
                <p className="plan-card-cta-note">Solicitud por correo · sin cargo inmediato</p>
              </article>
            ))}
          </div>

          {/* Domain note */}
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
              "¿Qué cuenta como un producto?",
              'Cada ítem del menú cuenta como un producto, esté publicado o en borrador. Sus variantes (por ejemplo "Simple" y "Doble") y sus extras (como "Pan brioche" o "Queso adicional") están incluidos y no consumen cupo adicional.',
            ],
            [
              "¿Quiénes son los usuarios incluidos en el plan?",
              "Los usuarios corresponden a las membresías activas del restaurante: propietario, atención y cocina. El administrador de plataforma de Mesa no consume un cupo de tu restaurante.",
            ],
            [
              "¿Qué incluye la ayuda de catálogo en Mesa Acompañado?",
              "Hasta 10 cambios al mes: crear o actualizar un producto con la información y los archivos que tú entregues. No incluye fotografía, diseño gráfico ni redacción extensa del contenido.",
            ],
            [
              "¿Cómo se compra y renueva el dominio propio?",
              "El dominio lo adquieres directamente con tu proveedor de DNS (como GoDaddy, Namecheap u otro). Mesa solo configura la conexión técnica y no participa en la compra ni en la renovación. El costo del dominio no está incluido en ningún plan.",
            ],
            [
              "¿Cómo solicito un cambio de plan?",
              "Los cambios de plan se gestionan directamente con el equipo de Mesa. Escríbenos indicando el plan actual, el plan al que deseas cambiar y el nombre de tu restaurante. Los cambios no son automáticos: un cambio de plan implica una nueva suscripción con las condiciones vigentes en ese momento.",
            ],
            [
              "¿Necesita el cliente descargar una aplicación?",
              "No. El cliente abre el menú desde un enlace en su navegador, sin instalar nada.",
            ],
            [
              "¿Mesa ya recibe pedidos reales?",
              "La plataforma está en desarrollo activo. La base técnica está construida y en pruebas. Escríbenos si quieres ser restaurante piloto.",
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
        <Brand/>
        <span>© 2026 Mesa · Nombre provisional</span>
        <Link href="/demo/admin">Administración de ejemplo</Link>
      </footer>
    </>
  );
}
