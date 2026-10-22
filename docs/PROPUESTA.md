# Propuesta de desarrollo: Mesa — vitrina digital para negocios

**Responsable del producto:** Luis Fernando Flores  
**Nombre de trabajo:** Mesa (provisional; pendiente de comprobar disponibilidad de marca y dominio)  
**Desarrollo:** Claude Code, con revisión y pruebas por cada fase  

---

## 1. Definición del producto

Mesa es una plataforma digital para mostrar productos mediante un catálogo propio, organizado y fácil de compartir.

Sirve para tiendas de tecnología, ropa, accesorios, restaurantes y otros negocios de productos.

La función principal es crear, personalizar y compartir un catálogo. El carrito y la gestión de pedidos son funciones adicionales que cada negocio puede activar.

## 2. Modelo de funcionamiento

Una aplicación compartida en Railway y un proyecto de Supabase por entorno. Cada negocio es una entidad independiente dentro de la plataforma.

- Dirección inicial: `negocio.mesa.app` o subdominio de la plataforma.
- Dominio opcional: `tienda.com` o `pedidos.restaurante.com` (el dominio se compra y renueva aparte).
- Panel del negocio: `app.mesa.app` centralizado para simplificar autenticación.
- Administración general: sección protegida del panel central, con permisos exclusivos de plataforma.

El alta la realiza el equipo de Mesa desde el panel de administración. El negocio recibe una invitación para configurar su cuenta y su catálogo.

## 3. Modalidades del catálogo

**A. Solo catálogo (predeterminado para negocios nuevos)**  
Los clientes exploran categorías, ven productos con fotos, precios y opciones, y pueden consultar por WhatsApp cuando el negocio tiene número configurado. Sin carrito ni pedidos en línea. No se crean pedidos internos.

**B. Catálogo con pedidos**  
Los clientes pueden añadir al carrito, elegir variantes y extras, y enviar un pedido con retiro en local o delivery. El negocio gestiona el estado de cada pedido desde el panel.

El propietario elige la modalidad desde configuración. El cambio no borra el historial de pedidos.

La modalidad se valida en base de datos: cuando pedidos están desactivados, el trigger `trg_guard_orders_enabled` bloquea cualquier INSERT en la tabla `orders`, independientemente de la capa de aplicación.

## 4. Lenguaje

- **"Negocio"** como término general en administración y configuración.
- **"Catálogo"** y **"Productos"** como términos predeterminados en el panel.
- **"Ver catálogo"** para abrir la página pública.
- **"¿Qué estás buscando?"** como placeholder del buscador en modo solo catálogo.

Para restaurantes:
- Pueden conservar la terminología de menú, extras y cocina cuando los pedidos están activos.
- El tipo de negocio y la modalidad son configuraciones independientes.

## 5. Planes comerciales

Fuente única: `src/lib/plan-catalog.ts`. Los valores de la one-page, el panel y el admin provienen siempre de este archivo.

| Plan | Precio | Productos | Usuarios | Roles |
|---|---|---|---|---|
| Mesa Inicio | 19 USD/mes | 50 | 1 | owner |
| Mesa Negocio | 39 USD/mes | 200 | 5 | owner, attention, kitchen |
| Mesa Acompañado | 69 USD/mes | 400 | 10 | owner, attention, kitchen |

**Reglas comerciales:**
- Las variantes y extras no consumen cupo de productos adicional.
- Cada producto cuenta una vez, publicado o en borrador.
- Los límites de usuarios son membresías activas del negocio; el admin de plataforma no ocupa cupo.
- El dominio se compra y renueva aparte.
- La capacidad de 400 productos en Acompañado no incluye la carga asistida de esos 400.
- Un cambio asistido = crear o actualizar un producto con información y archivos entregados por el cliente. No incluye fotografía, diseño ni redacción extensa.
- Los pedidos no tienen comisión por unidad.
- Sin cobros automáticos; el pago se confirma manualmente por el equipo de Mesa.
- Sin descuentos anuales publicados (no acordados aún).

## 6. Arquitectura técnica

- Next.js 16 + React + TypeScript en Railway.
- Supabase (PostgreSQL + Auth + Storage + RLS).
- Un despliegue único para toda la plataforma.
- Multiempresa: cada tabla lleva `restaurant_id` (nombre técnico conservado por compatibilidad).
- RLS + SECURITY DEFINER en todas las operaciones sensibles.
- Dinero en centavos (integer). Sin floats.

## 7. Rutas

| Ruta | Tipo | Descripción |
|---|---|---|
| `/` | Pública | One-page comercial con el nuevo posicionamiento |
| `/r/[slug]` | Pública | Catálogo del negocio (modo catálogo u órdenes según config) |
| `/panel` | Autenticada | Dashboard (catálogo-only o pedidos según config) |
| `/panel/menu` | Owner | Gestión de catálogo |
| `/panel/configuracion` | Owner | Identidad, horarios, modalidad, pedidos, dominio |
| `/panel/pedidos` | Autenticada | Pedidos — visible siempre (historial), nueva recepción solo cuando activo |
| `/admin` | Platform admin | Gestión de negocios, planes, suscripciones |

## 8. Funciones pendientes y sin anunciar

- Configuración asistida a 79 USD: propuesta sin confirmar, no publicada.
- Estadísticas de visitas al catálogo: no implementadas, no mostrar.
- Registro autónomo y contratación automática: fase futura.
- Notificaciones en tiempo real de pedidos: Supabase Realtime pendiente de implementar.
- Registro por invitación del propietario a su equipo: pendiente.
- SMTP para invitaciones de cuenta nueva: pendiente de configurar en Supabase.

## 9. Lo que NO prometemos

- Inventario en tiempo real.
- Cobros automáticos ni integración bancaria.
- Fotografía, diseño o redacción de contenido del catálogo.
- Pedidos ilimitados como prestación.
- Descuentos anuales (no acordados).
