import Link from "next/link";
import Image from "next/image";
import { Brand } from "@/components/brand";
import { SiteHeader } from "@/components/site-header";

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
            <p className="caption">Mesa está en desarrollo. Explora una demostración del producto.</p>
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
        <section id="planes" className="section container plan-section">
          <div>
            <span className="eyebrow">CONSTRUYAMOS LA PRIMERA VERSIÓN</span>
            <h2>Un piloto con<br/>acompañamiento.</h2>
            <p className="section-description">Estamos definiendo los planes para los primeros restaurantes. La implementación, mensualidad y servicios adicionales se cotizarán por separado.</p>
          </div>
          <div className="pilot-card">
            <span className="tag">Próximamente</span>
            <h3>Programa de restaurantes piloto</h3>
            <ul>
              <li>Menú con tu marca y personalizaciones</li>
              <li>Panel de operación y vista de cocina</li>
              <li>Configuración y capacitación inicial</li>
              <li>Validación del flujo con tu equipo</li>
            </ul>
            <Link className="button" href="/demo/menu">Explorar la demostración →</Link>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="section container faq">
          <h2>Antes de empezar.</h2>
          {[
            ["¿Necesita el cliente descargar una aplicación?",
             "La experiencia está pensada para abrir el menú desde un enlace en su navegador."],
            ["¿Puedo usar el dominio de mi restaurante?",
             "El proyecto contempla subdominios y conexión de dominios propios. Esa integración se desarrollará y verificará antes del lanzamiento."],
            ["¿Mesa ya recibe pedidos reales?",
             "No. Esta primera entrega es una base de desarrollo con una demostración local. Todavía no tiene autenticación, base de datos ni cobros reales."],
            ["¿Puedo configurar extras y variaciones?",
             "Sí. Puedes explorar la selección de variantes, pan y extras en el menú de ejemplo."],
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
