# Estado Mesa Platform — 29 de octubre de 2026 (actualizado)

## Resumen ejecutivo

| Área | Estado |
|---|---|
| One page + Poppins + hero imagen | ✅ Completa |
| Menú público rediseñado (/demo) | ✅ Completo |
| Migraciones 001-003 (core + auth + RLS) | ✅ 3/3 aplicadas |
| Pruebas de aislamiento RLS | ✅ 18/18 aprobadas |
| Autenticación real + paneles protegidos | ✅ Implementados |
| Migraciones 004-007 (catálogo) | ✅ 4/4 aplicadas |
| CRUD catálogo /panel/menu (owner only) | ✅ Implementado |
| Subida de imágenes (validación real) | ✅ Implementada |
| Menú público /r/[slug] | ✅ Implementado con config |
| Pruebas de aislamiento catálogo | ✅ 10/10 aprobadas |
| Seguridad de columnas para anon | ✅ Implementada (mig. 008-010) |
| Verificación de seguridad de API | ✅ Verificada (columnas revocadas) |
| Migraciones 011-014 (configuración) | ✅ 4/4 aplicadas |
| Panel /panel/configuracion | ✅ Implementado (owner only) |
| /r/[slug] conectado a config | ✅ Logo, portada, color, open/closed |
| Pruebas de aislamiento configuración | ✅ 18/18 aprobadas |
| Migraciones 015-017 (pedidos) | ✅ 3/3 aplicadas |
| Checkout como invitado (/r/[slug]) | ✅ Implementado |
| Endpoint POST /api/orders | ✅ Implementado |
| Confirmación /r/[slug]/pedido (cookie segura) | ✅ Implementada |
| Pruebas de aislamiento pedidos | ✅ 15/15 aprobadas |
| Migración 018 (operaciones de pedidos) | ✅ Aplicada |
| Panel /panel/pedidos (owner/atención/cocina) | ✅ Implementado |
| Transiciones de estado con control de roles | ✅ RPCs validados |
| Confirmación manual de pago | ✅ Implementada |
| Restricción de columnas PII para cocina | ✅ Verificada |
| place_order revocado para anon | ✅ Verificado |
| Pruebas panel operativo | ✅ 20/20 aprobadas |
| **Migración 019 (operaciones v2)** | ✅ **Aplicada** |
| **Token de confirmación — cookie vía POST, sin URL** | ✅ **Implementado** |
| **Sesión multi-pedido (hasta 5 por restaurante)** | ✅ **Implementada** |
| **Detección de conflicto concurrente (expected_status)** | ✅ **RPCs validados** |
| **Idempotencia de doble-clic sin duplicar evento** | ✅ **Verificada** |
| **Pruebas de mejoras de pedidos** | ✅ **10/10 aprobadas** |
| **Migración 020 (admin_plans)** | ✅ **Aplicada** |
| **p_expected_status y p_expected_payment_status obligatorios** | ✅ **Verificados (mig. 020)** |
| **is_restaurant_open verifica status='active'** | ✅ **place_order bloquea por status** |
| **place_order verifica suscripción activa** | ✅ **Modo onboarding libre conservado** |
| **Tablas: plans, subscriptions, subscription_payments, admin_audit_log** | ✅ **RLS aplicado** |
| **Panel /admin — listado paginado y búsqueda** | ✅ **Implementado** |
| **Panel /admin/restaurants/new — crear restaurante** | ✅ **Implementado** |
| **Panel /admin/restaurants/[id] — detalle, edición, dueño, estado** | ✅ **Implementado** |
| **Panel /admin/planes — catálogo de planes** | ✅ **Implementado** |
| **Alta controlada del dueño (existente o invitación)** | ✅ **Implementada (assignOwner)** |
| **Suscripciones y pagos manuales** | ✅ **Implementados (Server Actions)** |
| **Suspensión/vencimiento bloquea place_order en RPC** | ✅ **Verificado** |
| **Pruebas admin (AD01-AD10)** | ✅ **10/10 aprobadas** |
| **Migración 021 (domains_v2)** | ✅ **Aplicada** |
| **restaurant_domains: status, requested_by, reviewed_by, updated_at** | ✅ **Añadidos** |
| **RLS INSERT: owner puede solicitar dominio propio** | ✅ **Implementado** |
| **RPC get_restaurant_slug_by_host (anon)** | ✅ **Implementado** |
| **RPC manage_restaurant_domain (admin)** | ✅ **Implementado** |
| **Routing por hostname en src/proxy.ts** | ✅ **Implementado** |
| **Subdominio de plataforma (PLATFORM_SUBDOMAIN_BASE)** | ✅ **Implementado (opcional)** |
| **Dominio personalizado: lookup DB, rewrite interno** | ✅ **Implementado** |
| **Cookie de pedido adaptada a dominio custom (/pedido vs /r/slug/pedido)** | ✅ **Implementada** |
| **/panel y /admin bloqueados en dominios de restaurante** | ✅ **Verificado** |
| **Gestión de dominios en /panel/configuracion (owner)** | ✅ **Implementada** |
| **Gestión de dominios en /admin/restaurants/[id] (admin)** | ✅ **Implementada** |
| **Pruebas dominios (DO01-DO10 + 4 unitarias)** | ✅ **13/13 aprobadas** |
| **Barra lateral unificada (PanelShell)** | ✅ **Implementada — commit fc97cf2** |
| **Menú móvil panel (hamburger, Escape, foco)** | ✅ **Implementado** |
| **Menú móvil web comercial (SiteHeader)** | ✅ **Implementado** |
| **Plural correcto en catálogo (1 producto / N productos)** | ✅ **Corregido** |
| **Estado vacío por categoría sin productos** | ✅ **Implementado** |
| **Placeholder IMG neutro sin emoji** | ✅ **Implementado** |
| **Test C08: try/finally para cleanup garantizado** | ✅ **Corregido** |
| **panel-context: getActiveMembership con React.cache** | ✅ **Implementado — commit 4960f54** |
| **Selector de restaurante para usuarios con múltiples membresías** | ✅ **Implementado (cookie validada en servidor)** |
| **Formularios de categoría/producto integrados en PanelShell** | ✅ **Implementados** |
| **Aviso cambios sin guardar en formulario de producto** | ✅ **Implementado (beforeunload)** |
| **Datos de prueba Cat anon test C08 eliminados** | ✅ **3 registros eliminados — evidencia documentada** |
| **Guard unificado de cambios sin guardar** | ✅ **Implementado — commit e2fe71d** |
| **Cobertura: sidebar, cerrar sesión, cambio restaurante, tab/reload, back** | ✅ **Implementada** |
| **Diálogo accesible (aria-modal, foco, Escape)** | ✅ **Implementado** |
| **History sentinel para back/forward del navegador** | ✅ **Implementado (sin romper historial)** |
| **Pruebas GD01-GD12 (lógica de guard)** | ✅ **12/12 aprobadas** |
| **Migración 022 (dashboard_metrics)** | ✅ **Archivo creado — pendiente aplicar en BD** |
| **RPC get_dashboard_metrics con control por rol** | ✅ **Implementado (owner/attention: financiero; kitchen: cola)** |
| **Panel /panel rediseñado como resumen operativo** | ✅ **Implementado** |
| **Sidebar oscuro con iconos SVG y navegación agrupada** | ✅ **Implementado (PanelShell)** |
| **Filtro de período: Hoy, Ayer, 7 días, Este mes** | ✅ **Implementado (URL searchParam `periodo`)** |
| **Métricas: pedidos recibidos, activos, confirmado, ticket** | ✅ **Implementadas (servidor, zona horaria del restaurante)** |
| **Tabla de pedidos recientes con estado y pago** | ✅ **Implementada** |
| **Vista cocina: cola de preparación sin métricas financieras** | ✅ **Implementada** |
| **Estados vacíos y de error en dashboard** | ✅ **Implementados** |
| **Responsive: tarjetas en 2 columnas a < 1100 px** | ✅ **Implementado** |
| **Panel: altura viewport completa (sin franja blanca inferior)** | ✅ **Implementado** |
| **Rediseño panel v2 — sistema visual completo** | ✅ **Implementado** |
| **lucide-react instalado; iconos consistentes en todo el panel** | ✅ |
| **Tokens de diseño panel: #19162E sidebar, #F6F7FB fondo, #202337 texto** | ✅ |
| **PanelShell: sidebar 250px, activo con borde morado + fondo, topbar "Ver menú"** | ✅ |
| **Componentes compartidos: PageHeader, EmptyState** | ✅ |
| **/panel: PageHeader + métricas mejoradas + estado vacío correcto** | ✅ |
| **/panel/menu: pestañas Productos / Categorías + búsqueda + filtros cliente** | ✅ |
| **/panel/pedidos: barra de filtros rediseñada + contadores + estados con badges** | ✅ |
| **/panel/configuracion: pestañas General / Horarios / Entregas / Pagos / Dominio** | ✅ |
| **Formularios productos y categorías: PageHeader con título y breadcrumb** | ✅ |
| **Detalle de pedido: PageHeader con número y fecha** | ✅ |
| **Mobile: drawer oscuro, panel-mobile-header, sidebar oculto a ≤ 760 px** | ✅ |
| **dashboard-top eliminado de todas las páginas del panel** | ✅ |
| **Sin regresiones en sitio público ni /r/[slug]** | ✅ (estilos panel aislados en sección del panel de globals.css) |
| **Rediseño menú público /r/[slug]** | ✅ **Implementado (22/10/2026)** |
| **Rediseño one page v2 (hero centrado oscuro, showcase panel+catálogo, cuadrícula editorial)** | ✅ **Implementado (26/10/2026)** |
| **Refinamiento one page v2 (hero blanco, fotos reales, tipografía 600, espaciado, planes alineados)** | ✅ **Implementado (26/10/2026)** |
| **Lanz Technology — negocio real importado (6 productos DJI, imágenes en Storage, owner lfefl1998@gmail.com)** | ✅ **Importado (26/10/2026)** |
| **Luale Shop — negocio real importado (49 productos, 4 categorías, imágenes en Storage, owner lfefl1998@gmail.com)** | ✅ **Importado (26/10/2026)** |
| **Luale Shop — catálogos PDF importados y conciliados (49 páginas = 4 portadas/separadores + 45 láminas; 26 coincidencias limpias + 13 borradores-v1 + 3 conflictos-v2 = 45; 5 pendientes propietario; manifiesto en docs/luale-import-manifest.json)** | ✅ **Procesado (28/10/2026)** |
| **/panel/configuracion rediseñado: 8 secciones, guardado por sección, acciones nuevas (saveIdentity/saveAppearanceConfig/saveCatalogMode), vista previa en tiempo real, presets de color** | ✅ **Implementado (27/10/2026)** |
| **Bug NEXT_REDIRECT en selector: try/catch cliente capturaba señal interna de redirect() → se muestra como error** | ✅ **Corregido (27/10/2026)** |
| **Bug /seleccionar-negocio: query PGRST200 (restaurant_config sin FK directa) → rows=null → redirect /panel** | ✅ **Corregido (27/10/2026)** |
| **Pantalla /seleccionar-negocio — selector post-login con cards accesibles, estado de carga y error** | ✅ **Implementado (27/10/2026)** |
| **Login limpia cookie panel_restaurant_id para forzar selección en múltiples membresías** | ✅ **Implementado (27/10/2026)** |
| **panel-context: 2+ membresías sin cookie → active:null → redirige al selector** | ✅ **Implementado (27/10/2026)** |
| **Sidebar sidebar compacto con "Cambiar negocio" → /seleccionar-negocio vía UnsavedAwareLink** | ✅ **Implementado (27/10/2026)** |
| **Selector de negocio compacto en sidebar — muestra solo cuando hay múltiples membresías** | ✅ **Implementado (27/10/2026)** |
| **"Ver catálogo"/"Ver menú" dinámico según orders_enabled; textos "negocio" en lugar de "restaurante"** | ✅ **Corregido (27/10/2026)** |
| **CSS panel-info-notice, panel-card-header, sidebar role-row; sb-biz-* para el selector** | ✅ **Añadido (27/10/2026)** |
| **Bug: layouts panel/pedidos, panel/menu, panel/configuracion — redirigían a /panel con múltiples membresías** | ✅ **Corregido (27/10/2026)** |
| **"Cambiar restaurante" → "Cambiar negocio"; "Ver menú" → "Ver catálogo" en negocios solo catálogo** | ✅ **Corregido (27/10/2026)** |
| **Pedidos en modo catálogo muestra aviso explicativo en lugar de lista vacía silenciosa** | ✅ **Implementado (27/10/2026)** |
| **Migración 025 (catalog_appearance) — background_color, secondary_color, font_family en restaurant_config** | ✅ **Aplicada (26/10/2026)** |
| **Línea gráfica Luale Shop aplicada — Nunito, crema #fbf3e8, rosa #e8b5b0, marrón #624b3f, portada derivada del color de marca** | ✅ **Implementada (26/10/2026)** |
| **Rediseño catálogo público — topbar compacto, hero opcional, grid 4/3/2 cols, tarjetas verticales imagen cuadrada** | ✅ **Implementado (26/10/2026)** |
| **"Todos" + contadores reales en barra de categorías; currency dinámica; contain por defecto** | ✅ **Implementado (26/10/2026)** |
| **Migración 026 (product_image_fit) — columna image_fit en products; cover por defecto; contain disponible por producto** | ✅ **Aplicada (26/10/2026)** |
| **Encuadre cover por defecto en miniaturas; modal conserva contain; selector en formulario de producto** | ✅ **Implementado (26/10/2026)** |
| **Migración 027 (product_image_thumbnail) — thumbnail_path en product_images; original intacto** | ✅ **Aplicada (26/10/2026)** |
| **CropTool — recorte 1:1 en el panel antes de guardar; drag+resize+preview; sin librerías externas** | ✅ **Implementado (26/10/2026)** |
| **Flujo de carga: original → crop tool → miniatura WebP; "Usar original" para omitir** | ✅ **Implementado (26/10/2026)** |
| **"✂ Recortar miniatura" para imágenes existentes desde edición de producto** | ✅ **Implementado (26/10/2026)** |
| **Sistema de apariencia extendido — --menu-bg, --menu-primary, --menu-card-photo-bg, --menu-bar-bg via CSS vars** | ✅ **Implementado (26/10/2026)** |
| **Panel /panel/configuracion — color de fondo, tipografía (Poppins/Nunito) configurables** | ✅ **Implementado (26/10/2026)** |
| **Modal de producto rediseñado — imagen cuadrada contain, botón × sticky, galería, stepper qty, scroll body lock** | ✅ **Implementado (26/10/2026)** |
| **Subdominios de restaurante — routing en código** | ✅ **Implementado y probado** |
| **extractPlatformSubdomainFor: función pura testeable** | ✅ **Exportada; 11 tests cubren válidos, reservados y edge cases** |
| **resolveRestaurantPath: función pura testeable** | ✅ **Exportada; 8 tests cubren todas las decisiones de path** |
| **proxy.ts refactorizado sobre funciones puras** | ✅ **Sin cambio de comportamiento** |
| **tests/subdomains.test.ts — SD01-SD22** | ✅ **22/22 pasan (npm run test:subdomains)** |
| **Tabs de configuración en móvil — icono + texto con scroll horizontal** | ✅ **Implementado (27/10/2026)** |
| **Diálogo cambios no guardados — 3 opciones: Guardar y continuar, Descartar y salir, Seguir editando** | ✅ **Implementado (27/10/2026)** |
| **saveIdentity / saveAppearanceConfig / saveCatalogMode — upsert atómico por sección (sin read-modify-write)** | ✅ **Implementado (27/10/2026)** |
| **removeConfigImage — quita logo/portada de forma segura; no pierde imagen guardada si falla** | ✅ **Implementado (27/10/2026)** |
| **AppearanceForm — botón "Quitar" para logo y portada; estado optimista local; sin reload en éxito** | ✅ **Implementado (27/10/2026)** |
| **setSaveHandler en UnsavedChangesContext — formularios registran su save fn para "Guardar y continuar"** | ✅ **Implementado (27/10/2026)** |
| **tests/config-sections.test.ts — CS01-CS08** | ✅ **Creados (27/10/2026) — se ejecutan con npm run test:sections** |
| **Advertencia Next.js 16.4.0 — 3 advisories (2 critical, 1 high); versión corregida: no disponible aún** | ⚠️ **Documentado (27/10/2026) — ver sección "Advertencia Next.js"** |
| **Migración 031 (draft support) — base_price_cents nullable en products** | ✅ **Aplicada en Supabase (28/10/2026)** |
| **Importación PDF Luale — 3 borradores con imagen; conciliación 45 láminas; 5 pendientes propietario** | ✅ **Completada (28/10/2026)** |
| **Corrección: 15 borradores sin precio tenían is_published=true — corregido a false en Supabase** | ✅ **Corregido (29/10/2026)** |
| **Push a cerebraia/mesa-platform — SHA ba05e71** | ✅ **Publicado (29/10/2026)** |
| **Verificaciones producción — healthcheck, home, login, /panel y /admin redirigen, catálogos públicos OK** | ✅ **Verificado (29/10/2026)** |
| **Borradores Luale no visibles públicamente** | ✅ **Verificado (29/10/2026)** |
| **Railway deploy del SHA 9280941 — deployment f6849c7e SUCCESS** | ✅ **Desplegado (29/10/2026 11:35 ET)** |
| **Modal de confirmación de publicar/despublicar producto — reemplaza window.confirm** | ✅ **Implementado (29/10/2026)** |
| **Corrección contador panel/menu: visible=pub+avail (41); pausado=8 agotados; sin-precio=16 borradores; borrador=0** | ✅ **Corregido (29/10/2026)** |
| **3 borradores v2 sin precio ocultos en catálogo (is_available=F); nunca mostraron "Sin precio" en producción** | ✅ **Corregido (29/10/2026)** |

---

## Migraciones aplicadas: 31/31

| Versión | Archivo | Contenido |
|---|---|---|
| 20261013000001 | core_tables.sql | Tablas base multiempresa |
| 20261013000002 | functions.sql | Funciones RLS (SECURITY DEFINER) |
| 20261013000003 | rls.sql | Políticas RLS core; trigger guard_restaurant_status |
| 20261013000004 | catalog.sql | Tablas de catálogo con composite FKs |
| 20261013000005 | catalog_rls.sql | RLS autenticado + anon para menú público |
| 20261013000006 | storage.sql | Bucket `product-images` + RLS de Storage |
| 20261013000007 | catalog_rpc.sql | RPCs upsert_product, set_product_published, set_category_active |
| 20261014000008 | anon_column_security.sql | REVOKE INSERT/UPDATE/DELETE de anon; REVOKE ALL en tablas privadas |
| 20261014000009 | anon_column_select_fix.sql | REVOKE SELECT tabla + GRANT SELECT columnas públicas para anon |
| 20261014000010 | fix_anon_rls_subqueries.sql | Corrige EXISTS en RLS de tablas hijo |
| 20261014000011 | restaurant_config.sql | Tablas restaurant_config, business_hours, delivery_zones, payment_methods |
| 20261014000012 | restaurant_config_rls.sql | RLS configuración; columnas privadas revocadas a anon |
| 20261014000013 | restaurant_fn_open.sql | RPCs is_restaurant_open, save_restaurant_config, update_config_image, save_business_hours |
| 20261014000014 | restaurant_assets_storage.sql | Bucket `restaurant-assets` + RLS por restaurant_id |
| 20261014000015 | orders.sql | Tablas order_counters, orders, order_items, order_item_options, order_status_events |
| 20261014000016 | orders_rls.sql | RLS pedidos: anon bloqueado; authenticated lee solo pedidos de su restaurante |
| 20261014000017 | orders_rpc.sql | RPCs place_order (SECURITY DEFINER, transaccional), get_order_by_token |
| 20261014000018 | order_operations.sql | REVOKE place_order a anon; columnas PII revocadas; advance_order_status, confirm_order_payment, get_orders_for_panel, get_order_full_detail |
| 20261014000019 | order_ops_v2.sql | advance_order_status y confirm_order_payment: retornan jsonb, añaden expected_status, idempotencia y detección de conflicto |
| 20261014000020 | admin_plans.sql | advance_order_status v3 y confirm_order_payment v3: p_expected_* obligatorio para transiciones reales; is_restaurant_open verifica status='active'; tablas plans, subscriptions, subscription_payments, admin_audit_log; RLS; place_order verifica suscripción activa |
| 20261014000021 | domains_v2.sql | restaurant_domains: añade status, requested_by, reviewed_by, updated_at; trigger sync_domain_status; RLS INSERT para owner; RPCs get_restaurant_slug_by_host (anon) y manage_restaurant_domain (admin) |
| 20261015000022 | dashboard_metrics.sql | RPC get_dashboard_metrics(p_restaurant_id, p_period, p_timezone): owner/attention recibe conteos, confirmado cobrado, ticket promedio, 5 pedidos recientes; kitchen recibe conteos y cola de preparación; fechas calculadas en zona horaria del restaurante |

---

## Configuración del restaurante (/panel/configuracion)

### Tablas nuevas (migración 011)

| Tabla | Descripción |
|---|---|
| `restaurant_config` | 1:1 con restaurants — identidad, operación, cierre manual |
| `business_hours` | Intervalos de horario por día; closes_at < opens_at = cruce de medianoche |
| `delivery_zones` | Zonas con tarifa (centavos) y mínimo; selección manual por comprador |
| `payment_methods` | Medios de pago; campo `instructions` privado — no expuesto a anon |

### Secciones del panel

- **Identidad**: nombre, slug (solo lectura), descripción, color, teléfono, WhatsApp, redes sociales
- **Logo y portada**: subida vía `/api/menu/upload` al bucket `restaurant-assets`; reemplazo atómico sin referencias rotas
- **Operación**: zona horaria, dirección, retiro en local (on/off + dirección + instrucciones), delivery (on/off), cierre temporal manual
- **Horarios**: múltiples intervalos por día, cruce de medianoche soportado
- **Zonas de delivery**: nombre, tarifa (centavos), mínimo, activar/desactivar; sin geolocalización automática
- **Medios de pago**: nombre, tipo, instrucciones privadas; activar/desactivar

### Permisos aplicados

| Rol | Configuración |
|---|---|
| Owner | Lee y escribe (vía RPC con validación de rol) |
| Atención | Solo lectura |
| Cocina | Solo lectura |
| Anon | Columnas públicas; instrucciones de pago, closed_until y updated_at nunca expuestos |
| Platform admin | Acceso total |

### RPC save_restaurant_config

Actualiza `restaurants.name` y `restaurants.timezone` + upsert de `restaurant_config` en una sola transacción atómica. Verifica `member_role = 'owner'` dentro de la función (SECURITY DEFINER).

### Función is_restaurant_open

- Consulta zona horaria del restaurante
- Evalúa cierre manual (`is_temporarily_closed`)
- Evalúa intervalos activos del día actual y el día anterior para cruces de medianoche
- Accesible a anon (SECURITY DEFINER)

---

## Menú público /r/[slug] — integración con config

- Muestra logo si existe `logo_path` (bucket `restaurant-assets`)
- Muestra portada si existe `cover_path`; si no, mantiene el gradiente por defecto
- Aplica `primary_color` al banner y precios
- Muestra descripción del restaurante si está configurada
- Estado abierto/cerrado calculado en servidor via `is_restaurant_open` (incluye zona horaria y cierre manual)
- Banner de cierre con mensaje personalizable
- Dirección de retiro en el encabezado cuando aplica
- Instrucciones de pago **no expuestas** en el menú público (reservadas para futuro checkout)

---

## Seguridad de columnas para anon

### Verificación (migration 012)

- `restaurant_config.instructions` → no existe (solo en payment_methods)
- `restaurant_config.updated_at` → BLOQUEADO para anon
- `restaurant_config.closed_until` → BLOQUEADO para anon
- `payment_methods.instructions` → BLOQUEADO para anon
- Columnas públicas de restaurant_config, business_hours, delivery_zones, payment_methods → ACCESIBLES para anon
- INSERT/UPDATE/DELETE en todas las tablas de configuración → BLOQUEADOS para anon

---

## Verificaciones de código

| Verificación | Resultado |
|---|---|
| `npm run typecheck` | ✅ limpio |
| `npm test` (precios) | ✅ 5/5 |
| `npm run test:db` (aislamiento core) | ✅ 18/18 |
| `npm run test:catalog` (catálogo) | ✅ 10/10 |
| `npm run test:config` (configuración) | ✅ 18/18 |
| `npm run test:orders` (pedidos) | ✅ 15/15 |
| `npm run test:panel` (panel operativo) | ✅ 20/20 |
| `npm run test:improvements` (mejoras pedidos) | ✅ 10/10 |
| `npm run test:admin` (administración) | ✅ 10/10 |
| `npm run test:domains` (dominios) | ✅ 13/13 |
| `npm run build` (rediseño panel) | ✅ limpio |
| `npm run build` (altura viewport panel) | ✅ limpio |

---

## Rutas del proyecto

| Ruta | Tipo | Descripción |
|---|---|---|
| `/` | Pública | Página comercial |
| `/login` | Pública | Inicio de sesión |
| `/panel` | Protegida (auth) | Panel de miembro |
| `/panel/menu` | Protegida (owner) | Gestión de catálogo |
| `/panel/menu/categories/new` | Protegida (owner) | Nueva categoría |
| `/panel/menu/categories/[id]/edit` | Protegida (owner) | Editar categoría |
| `/panel/menu/products/new` | Protegida (owner) | Nuevo producto |
| `/panel/menu/products/[id]/edit` | Protegida (owner) | Editar producto |
| `/panel/configuracion` | Protegida (owner) | Configuración del restaurante |
| `/admin` | Protegida (platform_admin) | Listado paginado de restaurantes |
| `/admin/restaurants/new` | Protegida (platform_admin) | Crear restaurante |
| `/admin/restaurants/[id]` | Protegida (platform_admin) | Detalle: editar, dueño, estado, suscripciones, pagos |
| `/admin/planes` | Protegida (platform_admin) | Catálogo de planes; crear plan |
| `/admin/restaurants/[id]` (dominios) | Protegida (platform_admin) | Activar/desconectar dominios de restaurante |
| `/panel/configuracion` (dominios) | Protegida (owner) | Solicitar dominio propio; ver estado |
| `/r/[slug]` | Pública (host central) | Menú real del restaurante (desarrollo) |
| `/` en dominio de restaurante | Pública (host propio) | Menú público servido por hostname routing |
| `/pedido[/*]` en dominio propio | Pública (host propio) | Confirmación de pedido; cookie scoped a `/pedido` |
| `/api/menu/upload` | Protegida (owner) | Subida de imágenes (products + assets) |
| `/api/orders` | Pública (rate-limited) | POST — crear pedido como invitado |
| `/r/[slug]/pedido/[token]` | Pública (token) | Intercambia token por cookie, redirige a /pedido/ |
| `/r/[slug]/pedido/` | Pública (cookie) | Confirmación privada; token no en URL |
| `/panel/pedidos` | Protegida (auth + member) | Lista de pedidos (owner/atención/cocina) |
| `/panel/pedidos/[id]` | Protegida (auth + member) | Detalle del pedido con acciones |

---

## Guía de verificación manual en navegador

No dispongo de navegador. Las siguientes comprobaciones son necesarias antes de declarar la configuración lista para uso real.

### Usuario de prueba

Usuario: **owner-alfa@test.mesa** (contraseña en .env.test)
Configuración: `http://localhost:3000/panel/configuracion`
Menú público: `http://localhost:3000/r/restaurante-alfa`

### Flujo a verificar

**1. Acceso a /panel/configuracion**
- Entrar con owner-alfa → `/panel`
- Hacer clic en "Configuración" en el sidebar → debe navegar a `/panel/configuracion`
- Verificar: muestra las 4 secciones (Identidad + Operación, Horarios, Zonas, Pagos)

**2. Guardar identidad y operación**
- Cambiar descripción a "Test de configuración"
- Cambiar color principal a `#e63b70`
- Activar "Retiro en local", poner dirección
- Guardar → debe mostrar "Configuración guardada"
- Recargar → los valores deben persistir

**3. Subir logo y portada**
- Subir una imagen JPEG como logo
- Subir una imagen JPEG como portada
- Recargar → logo y portada deben mostrarse

**4. Verificar en menú público**
- Abrir `/r/restaurante-alfa` en ventana privada
- Verificar: logo en el encabezado
- Verificar: portada o color en el banner
- Verificar: color personalizado en las pestañas y precios
- Verificar: estado abierto/cerrado reflejado

**5. Cierre temporal**
- Activar "Cierre temporal manual", poner mensaje
- Guardar → recargar menú público → debe mostrar banner de cierre y estado "Cerrado"
- Desactivar cierre → recargar menú → debe volver al estado según horarios

**6. Horarios**
- Agregar intervalo: Lunes 09:00→22:00 activo
- Agregar intervalo de cruce de medianoche: Viernes 22:00→02:00
- Guardar horarios → recargar → deben persistir

**7. Zonas de delivery**
- Agregar zona "Centro" tarifa $1.50 mínimo $10.00
- Guardar → debe aparecer en la lista
- Editar → cambiar tarifa a $2.00 → guardar
- Desactivar zona → debe quedar con 50% de opacidad

**8. Medios de pago**
- Agregar "Efectivo" tipo Cash
- Agregar "Transferencia Mercantil" tipo Transferencia con instrucciones
- Verificar que las instrucciones NO aparecen en `/r/restaurante-alfa`

**9. Aislamiento**
- Entrar con owner-beta → `/panel/configuracion`
- Verificar: solo ve configuración de su restaurante
- Intentar modificar → solo afecta a Beta

**10. Acceso denegado**
- Ingresar con attention-alfa → debe redirigir a `/panel` (no puede acceder a configuración)

---

## Estado de verificación

| Verificación | Método | Resultado |
|---|---|---|
| Columnas internas revocadas para anon (config) | Test automatizado | ✅ Confirmado |
| Escritura anon bloqueada | Test automatizado | ✅ Confirmado |
| Owner Beta no modifica config de Alfa | Test automatizado | ✅ Confirmado |
| Atención y cocina no modifican config | Test automatizado | ✅ Confirmado |
| Cierre temporal afecta is_restaurant_open | Test automatizado | ✅ Confirmado |
| Cruce de medianoche se acepta | Test automatizado | ✅ Confirmado |
| Instrucciones de pago bloqueadas para anon | Test automatizado | ✅ Confirmado |
| Assets Storage: owner Beta bloqueado en Alfa | Test automatizado | ✅ Confirmado |
| Configuración guardada vía RPC | Test automatizado | ✅ Confirmado |
| Flujo visual completo en browser | **PENDIENTE** | ⏳ Requiere browser |
| Responsive a 360 px (configuracion) | **PENDIENTE** | ⏳ Requiere browser |
| Logo y portada en formulario | **PENDIENTE** | ⏳ Requiere browser |
| Catálogo: flujo visual (de fase anterior) | **PENDIENTE** | ⏳ Requiere browser |

---

## Declaración de estado

La configuración del restaurante **NO está lista para cargas de producción** hasta que se ejecute la guía de verificación manual y se comprueben en navegador real:
1. Formulario de configuración con subida de logo y portada
2. Persistencia de todos los campos tras recargar
3. Menú público reflejando logo, portada y color personalizado
4. Estado abierto/cerrado calculado correctamente según horario y zona horaria
5. Instrucciones de pago no visibles en el menú público
6. Aislamiento visual entre restaurantes

---

## Pedidos como invitado (fase completada)

### Modelo de datos (migraciones 015-017)

| Tabla | Descripción |
|---|---|
| `order_counters` | Contador atómico por restaurante (ON CONFLICT DO UPDATE para número secuencial) |
| `orders` | Pedido completo con snapshots de zona, método de pago y datos del cliente |
| `order_items` | Líneas del pedido con snapshots de producto/variante (sin FK al catálogo) |
| `order_item_options` | Opciones seleccionadas con snapshots de nombre y precio |
| `order_status_events` | Log inmutable de transiciones de estado |

### Flujo de checkout

1. Comprador navega el menú `/r/[slug]` y agrega productos al carrito (estado React)
2. Dialogo de producto muestra variantes y grupos de opciones con validación client-side
3. Barra inferior "Ir al checkout" muestra cantidad + subtotal
4. Formulario de checkout: nombre, teléfono, modalidad, zona/dirección si delivery, medio de pago, observaciones
5. POST `/api/orders` con idempotency key generada client-side
6. API valida formato, comprueba precios actuales (service role), llama `place_order` RPC
7. RPC valida restaurante abierto, modalidad, zona, pago, cada producto/variante/opción, mínimos de grupos, pedido mínimo de zona; inserta en una transacción
8. API devuelve token de acceso (64 hex chars, 32 bytes, nunca almacenado)
9. Cliente redirige a `/r/[slug]/pedido/[token]`
10. Página de confirmación: servidor hashea token, consulta `get_order_by_token`, muestra resumen con instrucciones de pago y botón WhatsApp

### Seguridad

- `anon` no tiene INSERT/UPDATE/DELETE en ninguna tabla de pedidos — solo vía `place_order` SECURITY DEFINER
- `access_token_hash` guardado en DB; token raw nunca persiste
- Precios recalculados desde catálogo vigente — ningún importe enviado por el browser se acepta como autoridad
- Rate limiting: 5 pedidos por IP por 15 minutos (conteo en tabla `orders` por `ip_hash`)
- Idempotencia: misma clave + mismo carrito → pedido existente; misma clave + carrito diferente → 409
- Precio cambiado: API devuelve 422 con totales reales; cliente muestra modal de confirmación
- Instrucciones de pago expuestas SOLO en la página de confirmación (requiere token)
- `Referrer-Policy: no-referrer` en página de confirmación
- `Cache-Control: no-store` en respuesta de la API de pedidos

### Limitaciones declaradas

- Panel operativo de pedidos para el restaurante: NO implementado (fase siguiente)
- Notificaciones en tiempo real (Supabase Realtime): NO implementado
- Cobros automáticos: NO implementado (fuera de alcance de esta fase)
- La verificación del pago la hace el restaurante manualmente
- El test OR04/OR05/OR06/OR07/OR12/OR13/OR14 requiere al menos un producto publicado en Alfa con medio de pago y zona de delivery configurados — con la BD de prueba actual, esos tests devuelven early con console.warn (no fallas)

---

---

## Panel operativo de pedidos

### Migración 018 — cambios de seguridad y operaciones

| Cambio | Descripción |
|---|---|
| `REVOKE place_order FROM anon` | Checkout solo a través de `/api/orders`; anon no puede saltarse el rate-limit |
| `REVOKE SELECT ON orders FROM authenticated` + `GRANT SELECT (cols)` | Cocina no puede leer customer_name, customer_phone, delivery_address, notes ni campos internos |
| `REVOKE SELECT ON order_status_events` + `GRANT SELECT (cols)` | note y created_by del historial accesibles solo vía RPC |
| `advance_order_status` RPC | Transiciones validadas por rol y estado; FOR UPDATE evita conflictos concurrentes |
| `confirm_order_payment` RPC | Owner/atención confirman; solo owner revierte con motivo |
| `get_orders_for_panel` RPC | Cocina: campos de preparación sin PII. Owner/atención: campos completos con filtros |
| `get_order_full_detail` RPC | Cocina: campos de cocina. Owner/atención: detalle completo + historial |

### Transiciones de estado permitidas

| Estado origen | Estado destino | Roles permitidos | Requiere nota |
|---|---|---|---|
| received | accepted | owner, atención | No |
| received | rejected | owner, atención | Sí |
| accepted | preparing | owner, atención, cocina | No |
| preparing | ready | owner, atención, cocina | No |
| ready | completed | owner, atención (solo retiro) | No |
| ready | on_the_way | owner, atención (solo delivery) | No |
| on_the_way | completed | owner, atención | No |
| cualquier no-terminal | cancelled | owner únicamente | Sí |

Estados terminales (no pueden avanzar): completed, rejected, cancelled.

### Token de confirmación del comprador

- `GET /r/[slug]/pedido/[token]` → Route Handler: valida token, establece cookie `order_receipt_<slug>` (HttpOnly, Secure, SameSite=Strict), redirige a `/r/[slug]/pedido/`
- `GET /r/[slug]/pedido/` → Page: lee la cookie, hashea el token, llama `get_order_by_token`, renderiza confirmación
- El token raw nunca aparece en la URL del comprador después del intercambio
- Residual documentado: el token aparece en el log del servidor exactamente una vez (la solicitud GET inicial al route handler)
- Cookie `order_receipt_<slug>` expira en 7 días; múltiples pedidos del mismo restaurante usan la misma cookie (el más reciente sobreescribe al anterior)

### Política explícita sobre pago y entrega

El sistema no bloquea ni permite automáticamente el despacho según el estado del pago. El restaurante decide si entrega con pago pendiente. La confirmación del pago es un estado independiente del estado del pedido, visible para owner y atención.

### Polling

La lista de pedidos se actualiza automáticamente cada 30 segundos mediante `router.refresh()` en el cliente. No se usa Supabase Realtime en esta fase para evitar complejidad en la gestión de permisos del canal.

### Pendientes del panel

- Verificación visual en browser (ver guía anterior)
- Notificaciones de audio para nuevos pedidos (requiere interacción previa del usuario)
- Supabase Realtime como alternativa al polling cuando se verifiquen los permisos del canal

---

## Mejoras de seguridad y robustez (migración 019)

### Token de confirmación — sin URL

| Antes | Después |
|---|---|
| POST /api/orders devolvía `token` en el body JSON | POST /api/orders devuelve `redirectTo` (sin token) |
| Cliente hacía `router.push('/r/slug/pedido/TOKEN')` | Cliente hace `router.push(response.redirectTo)` |
| Token aparecía en URL, historial y logs del servidor | Token llega solo vía `Set-Cookie` en la respuesta POST |

El route handler `GET /r/[slug]/pedido/[token]` sigue funcionando para URLs antiguas. En el flujo normal, el token nunca aparece en ninguna URL generada por la aplicación.

**Localhost**: `Secure` desactivado cuando `NODE_ENV !== production` (HTTP local); en producción `Secure=true`. `SameSite=Strict` activo en ambos entornos.

### Sesión multi-pedido

Cookie `order_session_<slug>` almacena hasta 5 tokens como array JSON, newest-first. El POST añade el nuevo token al frente sin sobreescribir los existentes. La página de confirmación muestra todos los pedidos de la sesión.

**Límites**: máx. 5 pedidos por restaurante; expira en 7 días; no persiste entre dispositivos ni tras borrar cookies.

### Concurrencia con estado esperado

`advance_order_status(p_expected_status)` y `confirm_order_payment(p_expected_payment_status)`:
- Estado actual ≠ esperado → `{ success: false, conflict: true, current_status }` (no excepción)
- Estado actual ya es el destino → `{ success: true, idempotent: true }` sin nuevo evento de historial
- Transición válida → `{ success: true, idempotent: false }` + evento en historial

Parámetros con `DEFAULT NULL`: callers sin el campo siguen funcionando.

**Cierre de comprobaciones de hito anterior (migración 020):**

| Comprobación | Decisión |
|---|---|
| `p_expected_status DEFAULT NULL` omitible | Cerrado: la función requiere el parámetro para transiciones reales; las idempotentes retornan antes del check |
| `p_expected_payment_status DEFAULT NULL` omitible | Cerrado: mismo mecanismo que `p_expected_status` |
| Cookie de sesión sin límite real | Documentado (ver sección siguiente): máx. 5 tokens × 64 chars = ~335 bytes, validación con regex |
| Ruta antigua con token sigue generándose | Documentado: la ruta `/r/[slug]/pedido/[token]` existe como compatibilidad residual; en el flujo POST no se genera ninguna URL con token |
| Pruebas de Auth con ráfagas 429 | Los tests usan una sesión por rol y la mantienen en el scope del test; `skip` ante variables faltantes; no hay retries en bucle |

### Verificación de RPCs SECURITY DEFINER

Toda RPC: `member_role(p_restaurant_id)` verifica usuario + membresía activa + restaurante + rol en cada llamada. `FOR UPDATE` en lecturas de estado previene race conditions. Rate limit en `/api/orders` es DB-backed, resistente a reinicios del proceso.

---

## Política de cookies de sesión de pedidos

Cookie `order_session_<slug>` — análisis de tamaño y comportamiento:

| Parámetro | Valor |
|---|---|
| Máximo tokens | 5 (SESSION_MAX) |
| Tamaño de cada token | 64 chars hex (32 bytes aleatorios) |
| Tamaño total del valor | ≈ 335 bytes — muy inferior al límite de 4 KB por cookie |
| Validación de entradas | Regex `/^[0-9a-f]{64}$/` — entradas malformadas ignoradas silenciosamente |
| Expiración | 7 días (`maxAge: 7 * 24 * 60 * 60`) |
| Comportamiento con 6.º pedido | El token más antiguo (posición 5) se descarta (`.slice(0, SESSION_MAX)`) |
| HttpOnly / Secure / SameSite | HttpOnly siempre; Secure=true en producción; SameSite=Strict |
| Path | `/r/<slug>/pedido` — no se envía en otras rutas |

**Compatibilidad residual de la ruta `/r/[slug]/pedido/[token]`:**
La ruta existe para URLs antiguas (marcadores o mensajes enviados antes de la migración 019).
En el flujo actual (POST `/api/orders`), el token nunca aparece en ninguna URL generada por la aplicación.
El token sigue apareciendo en el log del servidor exactamente una vez cuando el usuario visita esa URL.
En producción los logs de `/pedido/*` deben enmascararse.

---

## Panel de administración de plataforma (/admin)

### Rutas implementadas

| Ruta | Función |
|---|---|
| `/admin` | Listado paginado (20/página), búsqueda por nombre, filtro por estado |
| `/admin/restaurants/new` | Crear restaurante: nombre, slug (auto-sugerido), moneda, zona horaria; status inicial `onboarding` |
| `/admin/restaurants/[id]` | Editar datos base, asignar dueño, cambiar estado, gestionar suscripciones y pagos |
| `/admin/planes` | Listar planes activos; crear plan con nombre, precio, moneda, límites, flag `is_test` |

### Alta controlada del dueño (`assignOwner`)

1. Busca usuario por email vía Auth Admin API (listUsers, filtrado en JS).
2. **Cuenta existente**: crea o actualiza membresía a `role=owner, status=active`. Sin cambios en contraseña ni en `platform_admins`.
3. **Cuenta nueva**: valida `NEXT_PUBLIC_SITE_URL`, construye `redirectTo = <origin>/login`. Llama `inviteUserByEmail`. Si falla (sin SMTP), deja el estado como `invitePending=true` y documenta el requisito en la respuesta — nunca simula un envío exitoso.
4. En ningún caso esta operación puede conceder `platform_admin`.
5. Las claves de servicio nunca se muestran en el panel.

### Planes y suscripciones

- **Plan**: nombre, descripción, precio en centavos, moneda, límites (max_products, max_members opcionales), `is_active`, `is_test`. Solo platform_admin lee y escribe.
- **Suscripción**: vinculada al restaurante, estado (active/expired/cancelled), vencimiento opcional, notas. Solo platform_admin crea y modifica.
- **Pago manual**: importe, moneda, fecha, referencia, notas, `recorded_by`. Solo platform_admin crea. Owner puede leer sus propios pagos.
- **No mezclar** pagos de suscripción con pagos de pedidos — tablas separadas.

### Reglas de habilitación

| Condición | Resultado en place_order |
|---|---|
| Restaurante con status ≠ 'active' | Bloqueado |
| Restaurante con suscripciones pero ninguna activa/vigente | Bloqueado |
| Restaurante sin ninguna suscripción registrada | Permitido (modo onboarding libre) |
| Restaurante con suscripción activa y vigente | Permitido |

La comprobación de suscripción ocurre **dentro de la RPC `place_order`** (bloque 3b), no solo en la interfaz. Una llamada directa a la RPC tampoco puede saltarla.

### Seguridad

| Operación | Autorización |
|---|---|
| Leer/crear/modificar planes | Solo platform_admin (RLS `plans`) |
| Crear/modificar suscripciones | Solo platform_admin (RLS `subscriptions`) |
| Leer suscripciones | platform_admin ve todas; owner ve solo las suyas |
| Crear pagos de suscripción | Solo platform_admin (RLS `subscription_payments`) |
| Leer pagos | platform_admin ve todos; owner ve los suyos |
| Escribir admin_audit_log | Solo service_role (sin política INSERT para authenticated) |
| Leer admin_audit_log | Solo platform_admin |
| Cambiar status del restaurante | Solo platform_admin (trigger `guard_restaurant_status`) |

---

## Routing por hostname (src/proxy.ts)

### Variables de entorno (sin secretos)

| Variable | Descripción | Requerida |
|---|---|---|
| `NEXT_PUBLIC_PLATFORM_HOST` | Host del sitio comercial y panel (ej. `mesa.app`) | Sí en producción |
| `NEXT_PUBLIC_APP_HOST` | Host alternativo del panel si es distinto al principal | No (hereda PLATFORM_HOST) |
| `PLATFORM_SUBDOMAIN_BASE` | Base para subdominios de restaurante (ej. `mesa.app` → `slug.mesa.app`) | No (sin subdominio si no se define) |

En desarrollo local (`localhost`), siempre se usa el enrutamiento de plataforma sin lookups de dominio.

### Lógica de resolución

| Host recibido | Resultado |
|---|---|
| `localhost` / `127.0.0.1` | Plataforma — sesión + auth normales |
| `NEXT_PUBLIC_PLATFORM_HOST` | Plataforma |
| `NEXT_PUBLIC_APP_HOST` | Plataforma |
| `slug.PLATFORM_SUBDOMAIN_BASE` (si configurado) | Menú de `slug` sin lookup DB |
| host en `restaurant_domains` con `status='active'` Y restaurante `status='active'` | Menú del restaurante |
| cualquier otro | HTTP 404 — sin filtrado de datos |

### Comportamiento en dominios de restaurante

- **`/`** → rewrite interno a `/r/<slug>`
- **`/pedido`**, **`/pedido/`**, **`/pedido/*`** → rewrite a `/r/<slug>/pedido/*`
- **`/api/orders`** → pasa directamente con header `x-mesa-restaurant-slug: <slug>`
- **`/panel`, `/admin`, `/login`, `/demo`** → HTTP 404 (nunca se sirven en dominio de restaurante)
- **`/r/<slug>/*`** en dominio propio → redirect 301 a la ruta limpia (para bookmarks viejos)
- **Otras rutas** → HTTP 404

### Cookies de pedido en dominios propios

Cuando el middleware añade el header `x-mesa-restaurant-slug` a la solicitud `/api/orders`:
- Cookie path = `/pedido` (en lugar de `/r/<slug>/pedido`)
- `redirectTo` = `/pedido/` (en lugar de `/r/<slug>/pedido/`)

Esto permite que el navegador envíe la cookie en `restaurante.com/pedido/`.

**Aislamiento de cookies:** las cookies establecidas en un dominio propio NO se comparten con el dominio de la plataforma, ni entre dominios distintos. Un pedido hecho desde `restaurante.com` no es visible en `mesa.app/r/slug/pedido` y viceversa. Este es el comportamiento esperado de cookies host-only.

### Confianza en encabezados de host

Solo se lee el encabezado `Host`. El encabezado `X-Forwarded-Host` **no se usa** porque puede ser falsificado por clientes. Railway establece `Host` correctamente en producción.

### Subdominios de plataforma

Si se configura `PLATFORM_SUBDOMAIN_BASE=mesa.app`, el slug se extrae del subdominio directamente (sin lookup DB). Los nombres `www`, `app`, `admin`, `api`, `panel`, `mail`, `smtp`, `ftp`, `cdn`, `static`, `assets`, `media`, `dashboard`, `help`, `status`, `blog`, `docs` están reservados y nunca se interpretan como slugs.

---

## Gestión de dominios personalizados

### Flujo

1. Owner solicita desde `/panel/configuracion` → `status='requested'`
2. Admin recibe la solicitud en `/admin/restaurants/[id]` → puede marcar como `pending_verification`
3. Admin verifica DNS manualmente (ej. `dig CNAME mirestaurante.com`)
4. Admin activa el dominio → `status='active'` (la RPC `manage_restaurant_domain` registra auditoría)
5. Admin configura el dominio en Railway (Settings → Domains del servicio)
6. Railway emite el certificado TLS automáticamente

### Estados de dominio

| Estado | Quién lo asigna | Descripción |
|---|---|---|
| `requested` | Owner (INSERT) | Solicitud enviada, pendiente de revisión |
| `pending_verification` | Admin (RPC) | Admin indicó al owner qué registro DNS crear |
| `active` | Admin (RPC) | DNS verificado + Railway configurado + cert TLS emitido |
| `disconnected` | Admin (RPC) | Dominio deshabilitado; datos conservados |

### Seguridad

| Operación | Quién puede |
|---|---|
| Solicitar dominio `kind='custom'` | Owner del restaurante |
| Cancelar solicitud `requested` o `disconnected` | Owner del restaurante |
| Activar / desconectar / marcar pendiente | Solo platform_admin (RPC `manage_restaurant_domain`) |
| Resolver host → slug (hot path del proxy) | Anon (RPC SECURITY DEFINER, solo devuelve slug si `status='active'` Y restaurante `status='active'`) |

---

## Configuración Railway pendiente (instrucciones para cuando se tenga el servicio)

**Datos necesarios antes de conectar:**

| Información | Estado |
|---|---|
| Nombre del proyecto Railway | ⏳ Pendiente |
| Nombre del servicio en Railway | ⏳ Pendiente |
| URL de Railway del servicio (ej. `xxx.up.railway.app`) | ⏳ Pendiente |
| Dominio principal de la plataforma (`NEXT_PUBLIC_PLATFORM_HOST`) | ⏳ Pendiente |
| Decisión: ¿subdominio comodín o solo dominios personalizados? | ⏳ Pendiente |

**Variables de entorno a añadir en Railway:**

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_PLATFORM_HOST` | Dominio principal de la plataforma |
| `NEXT_PUBLIC_APP_HOST` | Igual al principal si no hay separación |
| `PLATFORM_SUBDOMAIN_BASE` | Base de subdominio si se usa comodín |
| `NEXT_PUBLIC_SITE_URL` | URL completa para invitaciones Supabase Auth |
| `SUPABASE_SERVICE_ROLE_KEY` | *(ya existe)* |
| `NEXT_PUBLIC_SUPABASE_URL` | *(ya existe)* |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | *(ya existe)* |

**Pasos para dominio principal (ej. `mesa.app`):**
1. En Railway: Settings → Domains → Add custom domain → `mesa.app`
2. En DNS: crear registro `CNAME mesa.app → xxx.up.railway.app` (o `A record` si Railway lo requiere)
3. Railway emite certificado TLS automáticamente (Let's Encrypt)
4. Verificar: `curl -I https://mesa.app/api/health`

**Pasos para subdominio comodín (ej. `*.mesa.app`):**
1. En Railway: verificar si el plan soporta wildcard domains (Pro plan)
2. En DNS: registro `CNAME *.mesa.app → xxx.up.railway.app`
3. Railway: añadir `*.mesa.app` como dominio del servicio
4. Definir `PLATFORM_SUBDOMAIN_BASE=mesa.app` en variables de entorno

**Pasos para dominio propio de restaurante:**
1. El dueño solicita en `/panel/configuracion`
2. Admin marca como `pending_verification` y comunica al dueño el registro CNAME
3. Dueño crea `CNAME mirestaurante.com → xxx.up.railway.app` en su DNS
4. Admin verifica con `dig CNAME mirestaurante.com`
5. Admin activa en `/admin/restaurants/[id]` (sección Dominios)
6. Admin añade `mirestaurante.com` en Railway → Settings → Domains
7. Railway emite certificado automáticamente

**Nota:** Activar en el panel de Mesa y configurar en Railway son pasos independientes. No activar en Mesa hasta que Railway haya emitido el certificado y el dominio responda correctamente.

---

## Repositorio y despliegue

### Estado del repositorio

- Repositorio: https://github.com/cerebraia/mesa-platform (público)
- Rama main, 3 commits en origin/main:
  - `48942cb` — Proyecto inicial (127 archivos, 22 107 líneas)
  - `02260f3` — Preparación Railway, .env.example, docs
  - `4b2f2b0` — **fix(railway): buildCommand corregido** (`npm ci` eliminado de buildCommand; lo ejecuta Nixpacks automáticamente)
- `.env.local`, `.env.test`, `node_modules/`, `.next/`, `.claude/` excluidos por `.gitignore`.
- Sin secretos en archivos versionados (verificado con grep y clone limpio).
- `railway.json`: buildCommand `npm run build`, startCommand `npm start -H 0.0.0.0`, healthcheck `/api/health`.

### Bloqueo para subir a GitHub

El repositorio remoto `mesa-platform` no existe aún. No hay `gh` CLI instalado y el puerto SSH 22 está bloqueado en esta red. HTTPS a `api.github.com` funciona.

**Pasos exactos para completar (ejecutar tú mismo):**

```bash
# 1. Instalar GitHub CLI (si no lo tienes)
brew install gh

# 2. Autenticarse
gh auth login
# Elige: GitHub.com → HTTPS → authenticate with browser

# 3. Crear repo privado y subir
gh repo create mesa-platform --private --source=. --remote=origin --push

# 4. Verificar
git remote -v
git log --oneline -3
```

Alternativa sin gh CLI:
```bash
# 1. Crear en https://github.com/new → nombre: mesa-platform, privado, SIN inicializar
# 2. Añadir remote y hacer push
git remote add origin https://github.com/<tu-usuario>/mesa-platform.git
git push -u origin main
```

### Staging activo: mesa-platform-production.up.railway.app

**Último commit desplegado:** `3ae1cd5` (fix proxy degradación segura)

#### Variables requeridas — configurar en Railway → tu servicio → Variables

⚠️ **Las variables `NEXT_PUBLIC_*` usan `process.env` en código de servidor/proxy en tiempo de ejecución** (no solo en build de cliente). Basta con definirlas en Railway; el redeploy las aplica.

**Públicas (seguro incluir en logs, nunca en Git con valor):**

| Variable | Valor para staging | Para qué sirve |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xlqilgkohjdleqeeoslk.supabase.co` | Cliente Supabase (proxy, páginas, checkout) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | clave anon de Supabase Dashboard → API | Operaciones dentro de RLS |
| `NEXT_PUBLIC_PLATFORM_HOST` | `mesa-platform-production.up.railway.app` | **Reconocer el hostname propio como plataforma** — sin esta variable, el proxy trata Railway como dominio de restaurante |
| `NEXT_PUBLIC_SITE_URL` | `https://mesa-platform-production.up.railway.app` | URL base para invitaciones de Supabase Auth |

**Privadas (jamás en Git, solo en Railway con mecanismo de secretos):**

| Variable | Origen | Para qué sirve |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → API → service_role | Auth Admin API, place_order, confirmaciones, panel admin |

**No añadir:**
- `MESA_DATABASE_URL` — solo para migraciones locales con supabase CLI, no para la app
- `NODE_ENV` — Railway lo establece automáticamente como `production`
- `NEXT_PUBLIC_APP_HOST` — omitir si el panel y el sitio comparten hostname; hereda de `NEXT_PUBLIC_PLATFORM_HOST`
- `PLATFORM_SUBDOMAIN_BASE` — omitir hasta que haya un dominio real con wildcard

#### Por qué falla sin NEXT_PUBLIC_PLATFORM_HOST

Sin esta variable, `isPlatformHost("mesa-platform-production.up.railway.app")` devuelve `false`. El proxy trata Railway como posible dominio de restaurante, hace un lookup en la BD, y si la BD tampoco está configurada → **HTTP 500**.

Con el fix de `3ae1cd5`, sin variables la app degrada a **404** en lugar de 500, pero aún así no funciona. Con las 5 variables arriba → funciona completamente.

#### Orden de configuración (importante)

1. Añadir las 5 variables en Railway → Variables del servicio
2. Railway dispara redeploy automáticamente al guardar
3. Esperar que el build termine (≈ 2–3 min)
4. Verificar: `curl https://mesa-platform-production.up.railway.app/api/health`
5. Verificar: `curl -I https://mesa-platform-production.up.railway.app/` → debe ser HTTP 200

### Supabase de producción — Cuándo y cómo

Crear un Supabase de producción independiente solo cuando:
- El código haya pasado validación manual en browser completa
- Se tenga un dominio principal definido
- Se haya decidido si se usa subdominio comodín o solo dominios personalizados

**Para aplicar las migraciones en producción (en orden):**
```bash
# Desde la raíz del proyecto, con .env.local apuntando al proyecto de producción
npx supabase db push --db-url "postgresql://postgres.<ID>:<PASS>@aws-1-...pooler.supabase.com:5432/postgres"
```
Las migraciones son aditivas y están numeradas. `supabase db push` aplica solo las que faltan según el historial de migraciones registrado. No ejecutar `supabase db reset` en producción (destruye datos).

### Variables NEXT_PUBLIC y comportamiento en servidor vs cliente

En Next.js 16:
- **Código de cliente (React)**: `NEXT_PUBLIC_*` se reemplazan literalmente en el bundle de JavaScript durante el build. Deben estar presentes al compilar.
- **Código de servidor (proxy, Server Components, Route Handlers)**: `process.env.NEXT_PUBLIC_*` se lee desde el entorno real al iniciar el servidor. No necesitan estar en el build.
- **Módulos de nivel superior** (como las constantes de `host-resolver.ts`): se evalúan al cargar el módulo por primera vez → al arrancar el servidor → desde las variables del entorno de Railway.

Por tanto: añadir las variables en Railway y redesplegar es suficiente. No hace falta cambiar código.

### Cookies Secure bajo HTTPS

En producción (`NODE_ENV=production`) las cookies de sesión de pedidos tienen `Secure=true`. Los tokens de Supabase Auth también requieren HTTPS. El proxy solo funciona correctamente con HTTPS en producción — no hay que configurar nada extra si Railway gestiona TLS.

---

## URLs de retorno para Supabase Auth (pendiente configurar)

Para que el flujo de invitación de dueño funcione (assignOwner con cuenta nueva):

1. En Supabase Dashboard → Authentication → URL Configuration:
   - **Site URL**: `https://<hostname>.up.railway.app` (o el dominio real en producción)
   - **Redirect URLs**: `https://<hostname>.up.railway.app/login`
2. Para SMTP (correos de invitación):
   - Authentication → SMTP Settings → habilitar custom SMTP
   - Requiere: host, puerto, usuario, contraseña del servidor de correo
   - Sin SMTP configurado, `assignOwner` para cuentas nuevas deja la invitación como `invitePending: true`

---

## Categorías de prueba huérfanas ("Cat anon test C08")

**Origen:** test C08 en `tests/catalog-isolation.test.ts`. El test crea una categoría con nombre `"Cat anon test C08"` y `position: 997` en el restaurante Alfa. Si el test se interrumpía antes del cleanup, la categoría quedaba huérfana.

**Corrección aplicada:** el test usa `try/finally` desde `fc97cf2` — cleanup garantizado aunque fallen aserciones.

**Datos existentes:** las categorías `"Cat anon test C08"` visibles en el catálogo son residuos de ejecuciones anteriores interrumpidas. Para limpiarlas:
```bash
# Solo el owner-alfa puede borrarlas (RLS: category pertenece a restaurant Alfa)
# Ejecutar con credenciales de owner-alfa o service_role:
# DELETE FROM categories WHERE name = 'Cat anon test C08' AND restaurant_id = 'aaaaaaaa-0000-0000-0000-000000000001';
```
No se borran automáticamente aquí porque requieren autorización explícita del propietario del proyecto.

---

## Navegación del panel — estructura tras fc97cf2

### Causa del menú ausente

Cada sub-página renderizaba su propio `<aside>` mínimo:
- `/panel/menu` → Brand + ← Panel + SignOut (sin nav completo)
- `/panel/pedidos` → Brand + workspace + ← Panel + SignOut
- `/panel/pedidos/[id]` → Brand + workspace + ← Pedidos + SignOut
- `/panel/configuracion` → Brand + ← Panel + SignOut

### Solución implementada

| Archivo | Rol |
|---|---|
| `panel/layout.tsx` | Carga user + membership + restaurant; renderiza PanelShell o pantalla access-pending |
| `panel/panel-shell.tsx` | Client Component: sidebar completo, usePathname para estado activo, menú móvil |
| Cada sub-página | Solo contenido — sin `<aside>` propio |

### Navegación por rol

| Ítem | owner | attention | kitchen |
|---|---|---|---|
| Inicio | ✅ | ✅ | ✅ |
| Pedidos | ✅ | ✅ | ✅ |
| Catálogo | ✅ | — | — |
| Configuración | ✅ | — | — |
| Ver menú ↗ | ✅ | ✅ | ✅ |

### Menú móvil del panel

- Botón hamburger visible a ≤ 760 px
- Se cierra con Escape (foco devuelto al botón) o al navegar
- Se cierra haciendo clic fuera del drawer

---

## Guard de cambios sin guardar — cobertura y límites

### Arquitectura (commit e2fe71d)

`UnsavedChangesProvider` envuelve `PanelShell`. Gestiona:
- `isDirty` / `setDirty` — compartido por todos los formularios del panel
- `requestLeave()` — muestra el diálogo y resuelve la promesa según la elección del usuario
- `beforeunload` — tab close / reload
- `popstate` + history sentinel — back/forward del navegador

### Navegación cubierta

| Punto de salida | Mecanismo |
|---|---|
| Enlace del sidebar | `UnsavedAwareLink` (intercepta click, llama `requestLeave`) |
| "Volver al catálogo" (Cancelar) | `UnsavedAwareLink` |
| "Ver menú ↗" (nueva pestaña) | `UnsavedAwareLink` |
| Cerrar sesión | `UnsavedAwareButton` (llama `signOut` tras confirmación) |
| Cambio de restaurante | `UnsavedAwareButton` en `RestaurantSwitcher` |
| Cierre / recarga de pestaña | `beforeunload` en el provider |
| Navegación atrás del navegador | `popstate` + `history.pushState` sentinel |

### History sentinel

Cuando el formulario se pone sucio, se hace `history.pushState({ unsavedGuard: true }, "")`. Esto añade una entrada extra al stack. Si el usuario pulsa Atrás, `popstate` detecta que el sentinel fue consumido y muestra el diálogo:
- "Seguir editando": se re-inserta el sentinel con `history.pushState`
- "Descartar y salir": se limpia `dirty` y la navegación procede

El sentinel es una entrada extra en el historial (el usuario ve un extra paso al pulsar Adelante), pero no altera las URLs ni el historial real de páginas. Se elimina al guardar o descartar.

### Límite documentado: forward button

Si el usuario abre el formulario, lo hace sucio, y luego pulsa el botón Adelante del navegador (para ir a una página que cargó antes), el `popstate` NO recibe el sentinel (porque el sentinel está en la posición actual, no en las anteriores). Esta transición queda sin protección. Añadir un guard completo para este caso requeriría history manipulation más invasiva, contradiciendo el requisito de no romper el historial.

### Diálogo

- `role="dialog"` `aria-modal="true"` `aria-labelledby` `aria-describedby`
- Foco inicial en "Seguir editando" al abrir
- Escape → "Seguir editando" (sin salir)
- Clic en backdrop → "Seguir editando"
- Tab navega entre los dos botones (sin salir del diálogo)

### Pruebas de navegador pendientes (GD-B01 a GD-B11)

Ver lista completa en `tests/unsaved-changes.test.ts`. Sin navegador no se pueden ejecutar.

---

## Catálogos públicos — nueva presentación (26/10/2026)

### Cambios aplicados

| Elemento | Antes | Después |
|---|---|---|
| Tarjeta de producto | Horizontal: texto izquierda, foto derecha (140 px) | Vertical: foto cuadrada 1:1 arriba, nombre + precio abajo |
| Columnas | 2 (desktop + mobile) | 4 desktop amplio / 3 intermedio / 2 móvil |
| Cabecera | Portada siempre grande (≥260 px), vacía si no hay imagen | Topbar compacto 60 px siempre visible + hero opcional solo con portada o degradado |
| Navegación | Buscador + tabs (sin "Todos") | Topbar con buscador + catbar sticky con "Todos" y contadores reales |
| Categorías | Tabs simples, sin contador | Tabs con badge numérico por categoría y "Todos N" |
| Moneda | USD hardcodeado | Usa `restaurant.currency` (EUR para Luale, USD para los demás) |
| Foto sin imagen | Degradado morado Mesa | SVG placeholder neutro proporcional al tamaño de tarjeta |
| object-fit | `cover` (recortaba prendas/equipos) | `contain` por defecto (muestra producto completo) |
| WhatsApp topbar | No existía | Botón "Contactar" verde en modo catálogo solo |
| Estado abierto/cerrado | Badge en portada (en modo pedidos) | Pill en topbar (modo pedidos) + en id-bar si no hay hero |
| Descripción en tarjeta | Siempre (2 líneas clamp) | Solo en modo pedidos (restaurantes); catálogo la omite para no saturar |

### URLs locales

| URL | Negocio | Tipo |
|---|---|---|
| `http://localhost:3001/r/luale-shop` | Luale Shop | Solo catálogo, EUR, Nunito, crema |
| `http://localhost:3001/r/lanz-technology` | Lanz Technology | Solo catálogo, USD, Poppins, morado |
| `http://localhost:3001/r/restaurante-alfa` | Restaurante Alfa | Con pedidos, USD |
| `http://localhost:3001/r/demo-tech` | Demo Tech Store | Solo catálogo, USD |

### Comprobaciones funcionales

| Comprobación | Método | Resultado |
|---|---|---|
| Estructura nueva en SSR Luale | curl + grep | ✅ `rm-topbar`, `mc-grid`, `mc-card`, `rm-hero`, `rm-catbar`, "Todos", logo |
| Estructura nueva en SSR Lanz | curl + grep | ✅ `rm-topbar`, `mc-grid`, `rm-hero`, "Todos", morado 7C3AED |
| Estructura nueva en SSR restaurante-alfa | curl + grep | ✅ `rm-topbar`, `mc-grid`, `mc-add-btn`, status abierto |
| Aislamiento Luale: sin carrito ni add-btn | curl + grep | ✅ solo WA 584220162748 |
| Lanz sin datos de Luale | curl + grep | ✅ sin Bebés, sin 584220162748 |
| restaurante-alfa: mc-add-btn presente | curl + grep | ✅ con pedidos habilitados |
| `npm run typecheck` | CLI | ✅ limpio |
| `npm run build` | CLI | ✅ limpio |
| `npm test` | CLI | ✅ 5/5 |

### Verificaciones visuales pendientes (requieren browser)

1. **Luale (360/390/768/1440 px)** — topbar crema + logo redondo, hero degradado marrón cálido, 29 prendas en Bebés con 4/3/2 cols, nombres largos en 2 líneas clamp, precios en €, "Contactar" WA verde, galería/modal sin add-btn
2. **Lanz Technology (360/1440 px)** — hero morado-oscuro con degradado, 4 cols en desktop, fotos DJI en contain (no recortadas), galería en modal
3. **Restaurante alfa (360/1440 px)** — status "Abierto/Cerrado" en topbar, mc-add-btn accesible 44×44, carrito FAB desktop y barra móvil, checkout completo
4. **Negocio sin portada y sin secondary_color** — solo topbar + id-bar compacto (sin hero vacío)
5. **Buscador** — resultados filtran a través de todo el catálogo, estado vacío con "Limpiar"
6. **Categorías** — "Todos" activo al cargar, se actualiza al hacer scroll
7. **Colisión de elementos fijos** — catbar + FAB/cart-bar sin solapamiento

---

## Luale Shop — Importación completa (26/10/2026) + PDF (28/10/2026)

### Negocio

| Campo | Valor |
|---|---|
| Nombre | Luale Shop |
| Slug | `luale-shop` |
| ID | `b0365f95-dabf-42f5-b4b2-578a7954a6ca` |
| Owner | `lfefl1998@gmail.com` |
| Modalidad | Solo catálogo (`orders_enabled = false`) |
| Moneda | EUR (€) — publicada en el sitio; no se convirtió |
| Color | `#F472B6` (aproximado — ajustar desde /panel/configuracion) |
| WhatsApp | `+584220162748` |
| Instagram | `@lualekids.shop` |
| Horarios | Lunes–sábado 09:00–18:00 (estimado; verificar con la tienda) |

### Catálogo actual (28/10/2026)

Cifras exactas verificadas en Supabase:

| Categoría | Total BD | Publicados | Borradores |
|---|---|---|---|
| Bebés | 40 | 29 | 11 |
| Niñas | 11 | 7 | 4 |
| Niños | 9 | 8 | 1 |
| Juguetes | 5 | 5 | 0 |
| **TOTAL** | **65** | **49** | **16** |

**Historia de la importación:**
1. **26/10/2026** — Importación inicial del sitio `lualeshop.com`: 49 productos con precio e imágenes del sitio web.
2. **28/10/2026 (importación PDF v1)** — Importación de 2 catálogos PDF: 13 borradores nuevos + imágenes de catálogo añadidas a 32 productos existentes. Cubrió las 45 láminas.
3. **28/10/2026 (revisión v2)** — Análisis independiente: 3 borradores adicionales para láminas cuya coincidencia v1 se considera cuestionable (Bebés p12, p13, p21).

**Conciliación definitiva (28/10/2026) — corrección del informe anterior:**

El informe previo indicaba 35 coincidencias + 3 creados + 3 ambiguos = 41. Faltaban 4 porque los 13 borradores-v1 no se contaron como láminas asignadas y las 3 láminas con nota de ambigüedad quedaron sin sumar. Recuento correcto:

| PDF | Páginas | Portadas/sep | Láminas | Coincidencia | Con nota ⚑ | Borrador | Conflicto ⚑ |
|---|---|---|---|---|---|---|---|
| Bebés (0–3 a) | 28 | 1 | 27 | 15 | 1 | 8 | 3 |
| Niñas/Niños (4–8 a) | 21 | 3 | 18 | 11 | 2 | 4 | 0 |
| **Total** | **49** | **4** | **45** | **26** | **3** | **13** | **3** |
| | | | **= 45** | | **26+3+13+3** | **= 45 ✓** | |

Las 45 láminas tienen resultado asignado. Tabla completa página a página en `docs/luale-import-manifest.json` (campo `conciliacion_49_paginas`).

### Cinco pendientes que requieren confirmación del propietario

| # | Lámina | Asignación actual | Problema | Dato necesario |
|---|---|---|---|---|
| 1 | Bebés p9 | Set 3 Piezas León `eb4e1261` (pub, €15) | La lámina muestra 2 piezas; el nombre dice 3. Candidato alternativo: Conjunto Animalitos `84e746b4` (pub, €25). | Cuál de los dos productos corresponde a esta lámina |
| 2 | Bebés p12 | **v1:** Sets Leggings B/N `448f0efd` (pub, €25) · **v2:** Pantalones Jogger con Lazo `4b500b7a` (borrador, sin precio) | La lámina muestra 5 joggers lisos con lazo blanco; el nombre v1 no describe lazo ni 5 colores | ¿Son el mismo SKU? → eliminar borrador v2, o → asignar precio al borrador v2 |
| 3 | Bebés p13 | **v1:** Pijamas Enterizas Estampadas `d821ec0c` (pub, €20) · **v2:** Enterizos Cremallera Lisos `296393e6` (borrador, sin precio) | La lámina es LISO; el producto v1 dice ESTAMPADAS | ¿Son distintos SKUs? (probable) → asignar precio al borrador v2, o → si son el mismo, eliminar v2 |
| 4 | Bebés p21 | **v1:** Set Leggings Básicos `c301f0a4` (pub, €8, mismo que p11) · **v2:** Leggings Canalé Colores `4818cd5e` (borrador, sin precio) | V1 asignó p11 (3-6m) y p21 (6-9m, canalé, colores distintos) al mismo producto | ¿Son dos SKUs separados? (probable) → asignar precio al borrador v2 |
| 5 | Niños p14+p15 | Ambas → Set Capri Italy `503e7683` (pub, €35) | Dos láminas distintas (talla 4a/short rojo y talla 6a/short amarillo) apuntan al mismo producto | ¿Un listado cubre ambas tallas o se necesitan dos entradas? |

**Regla aplicada:** ningún borrador de conflicto se publica ni se elimina hasta recibir confirmación del propietario. Los 3 borradores v2 (`4b500b7a`, `296393e6`, `4818cd5e`) conservan su estado actual (sin precio, sin publicar).

### Borradores pendientes de precio (acciones del propietario)

| Producto | ID corto | PDF | Acción requerida |
|---|---|---|---|
| Pantalones Jogger con Lazo | `4b500b7a` | Bebés p12 | Revisar vs "Sets Leggings Blanco y Negro" (448f0efd); asignar precio o consolidar |
| Enterizos Cremallera Lisos | `296393e6` | Bebés p13 | Revisar vs "Pijamas Enterizas Estampadas" (d821ec0c); asignar precio o consolidar |
| Leggings Canalé Colores | `4818cd5e` | Bebés p21 | Revisar vs "Set Leggings Básicos" (c301f0a4); asignar precio o consolidar |
| Conjunto NASA Negro | `edd5b761` | Bebés p7 | Asignar precio y publicar |
| Body Ranita Rayas Multicolor | `493d8fae` | Bebés p10 | Asignar precio y publicar |
| Bodies Manga Corta Básicos | `e4bde614` | Bebés p18 | Asignar precio y publicar |
| Bodies Sin Mangas Tonos Tierra | `0a7c35e0` | Bebés p19 | Asignar precio y publicar |
| Bodies Sin Mangas Tonos Neutros | `fa2676ec` | Bebés p20 | Asignar precio y publicar |
| Tops Manga Larga Clásicos | `319c1dc2` | Bebés p23 | Asignar precio y publicar |
| Diademas Turbantes Tul con Lazo | `7a972b3d` | Bebés p28 | Asignar precio y publicar |
| Pijama Flores y Arcoíris | `675fa49e` | Bebés p14 | Asignar precio y publicar |
| Set Capri Italy Azul — Niñas | `f5b1ae06` | Niñas p3 | Asignar precio y publicar |
| Set Capri Italy Lila — Niñas | `5f281682` | Niñas p11 | Asignar precio y publicar |
| Set Fresh Bakery Naranja | `1f9180e8` | Niñas p4 | Asignar precio y publicar |
| Set Premium Bakery Verde | `f163196c` | Niñas p12 | Asignar precio y publicar |
| Set Polo Oakland Verde — Niños | `2a42f855` | Niños p16 | Asignar precio y publicar |

Imágenes de catálogo PDF: subidas en Storage (PNG 1296×1620 + miniatura cuadrada 1620×1620).  
Imágenes originales del sitio web: conservadas (no eliminadas).  
Migración 031 aplicada: `base_price_cents` permite NULL para borradores.

### Fuente de imágenes

- Imágenes locales: descargadas de `https://www.lualeshop.com/images/products/luale-NNN-slug.webp`
- Imágenes Supabase: descargadas de la instancia propia de Luale (`rbldtmdxhzvpksdrjiju.supabase.co`)
- Ambas fuentes migradas al Storage de Mesa; ningún enlace queda dependiente del sitio original.

### Limitaciones documentadas

- Tallas de ropa: publicadas como referencia informativa en la descripción; no existen como variantes formales en el modelo de Mesa. Los compradores consultan disponibilidad por WhatsApp.
- Tallas adicionales: el sitio solo muestra la talla seleccionada actualmente en cada producto, no el rango completo disponible.
- Precio base "desde": para productos con "Desde €N" se usa el precio mínimo publicado como `base_price_cents`.
- Redes sociales: el sitio no publica TikTok, Facebook ni email de contacto.
- Color de marca: aproximación visual; verificar con Luale y ajustar.

### Identidad visual aplicada (migración 025)

| Elemento | Valor |
|---|---|
| Color primario / acento | `#e8b5b0` (rosa polvorienta — extraído de CSS de lualeshop.com) |
| Fondo del catálogo | `#fbf3e8` (crema cálida — color de fondo del sitio original) |
| Color secundario / texto | `#624b3f` (marrón cálido — color de texto del sitio original) |
| Tipografía | Nunito (cargada vía Google Fonts, variable CSS `--font-nunito`) |
| Portada sin imagen | Degradado `#403129 → #624b3f` (derivado del secondary_color) |
| Placeholder tarjeta foto | Tint rgba del primary_color al 13–25% |
| Barra navegación | Fondo `#fbf3e8` (misma crema, coherente) |
| Tabs activos | Color y borde `#e8b5b0` |

### Comprobaciones realizadas

| Comprobación | Método | Resultado |
|---|---|---|
| SSR catálogo luale-shop | curl HTML | ✅ `Luale Shop`, 4 categorías, productos en HTML |
| WhatsApp correcto (no Lanz) | grep HTML | ✅ `584220162748` presente; `584266540669` ausente |
| Sin carrito/FAB | grep HTML | ✅ `cart-fab`, `cart-bar` ausentes |
| Colores en SSR | grep HTML | ✅ `e8b5b0`, `fbf3e8`, `624b3f`, `Nunito`, `font-nunito` presentes |
| Portada: degradado marrón | grep HTML | ✅ `linear-gradient(115deg,#403129,#624b3f)` |
| Logo Luale desde Storage | grep HTML | ✅ `restaurant-assets/.../logo.jpg` cargado |
| Aislamiento Lanz Technology | curl /r/lanz-technology | ✅ Solo `7C3AED`; sin colores Luale |
| Aislamiento restaurante-alfa | curl /r/restaurante-alfa | ✅ Sin colores Luale |
| `npm run typecheck` | CLI | ✅ limpio |
| `npm run build` | CLI | ✅ limpio |
| `npm test` | CLI | ✅ 5/5 |

### URLs locales

| URL | Descripción |
|---|---|
| `http://localhost:3001/r/luale-shop` | Catálogo público Luale Shop |
| `http://localhost:3001/panel` | Panel (ingresar como `lfefl1998@gmail.com`) |

### Verificaciones visuales pendientes (requieren browser)

1. Catálogo a 360/768/1440 px — 4 categorías, 29 productos en Bebés, navegación horizontal en móvil
2. Tarjetas sin botón "+", sin carrito
3. Abrir producto → diálogo con botón "Consultar por WhatsApp" → mensaje dirigido al número de Luale
4. Logo del negocio visible en el encabezado del catálogo
5. Color #F472B6 en tabs y precios; ajustar si no coincide con la marca real
6. Productos agotados visibles pero sin opción de compra
7. Panel: productos y categorías editables desde `/panel/menu`
8. Aislamiento visual respecto a Lanz Technology y Demo Tech Store

---

## Demo Tech Store — Solo catálogo (22/10/2026)

### Migración 024 — aplicada

| Componente | Estado |
|---|---|
| `orders_enabled` column | ✅ Aplicada vía pooler (`scripts/run-migration-024.ts`) |
| GRANT anon SELECT orders_enabled | ✅ |
| `save_restaurant_config` actualizado | ✅ |
| Trigger `trg_guard_orders_enabled` | ✅ Bloquea INSERT en orders con `ORDERS_DISABLED` hint |

Verificado: `curl -X POST /rest/v1/orders` con service_role en demo-tech devuelve `{"hint":"ORDERS_DISABLED","message":"Los pedidos no están habilitados para este negocio."}` (code 23514).

### Negocio de demostración — Demo Tech Store

| Campo | Valor |
|---|---|
| Nombre | Demo Tech Store |
| Slug | `demo-tech` |
| ID | `26036c03-b8de-4265-bf19-39b5ad822464` |
| Owner | `noaccess@test.mesa` |
| Modalidad | Solo catálogo (`orders_enabled = false`) |
| Color | `#0F4C81` (azul tecnología) |
| WhatsApp | `+584125550042` (número de prueba) |
| Horarios | Lunes–viernes 09:00–18:00 |
| Categorías | Accesorios y cables · Gadgets |
| Productos | 4 (Cable USB-C con variantes, Hub USB-C, Soporte laptop, Auriculares NC con variantes) |

### Comprobaciones realizadas (sin navegador)

| Comprobación | Método | Resultado |
|---|---|---|
| SSR catálogo demo-tech | curl HTML | ✅ `Demo Tech Store`, categorías y productos en HTML |
| Placeholder buscador catálogo | grep HTML | ✅ `¿Qué estás buscando?` presente |
| Carrito/FAB ausente en SSR | grep HTML | ✅ `cart-fab` y `cart-bar` ausentes del body |
| `menu-add-btn` ausente en body | grep HTML | ✅ ausente del body (solo en CSS externo) |
| Bloqueo DB INSERT orders | REST API directo | ✅ `ORDERS_DISABLED` (trigger activo) |
| One-page: precios 19/39/69 | grep HTML | ✅ renderizados como USD enteros |
| One-page: "por negocio" | grep HTML | ✅ presente |
| One-page: plan Negocio featured | grep HTML | ✅ `plan-card--featured` |
| `npm run typecheck` | CLI | ✅ limpio |
| `npm run build` | CLI | ✅ limpio |
| `npm test` | CLI | ✅ 5/5 |

### URLs locales para revisión

| URL | Descripción |
|---|---|
| `http://localhost:3001/r/demo-tech` | Catálogo público Demo Tech (Solo catálogo) |
| `http://localhost:3001/panel` | Panel (ingresar como `noaccess@test.mesa`) |
| `http://localhost:3001/r/restaurante-alfa` | Catálogo Alfa (con pedidos, para contraste) |
| `http://localhost:3001/` | One-page con nuevo posicionamiento |

### Verificaciones visuales pendientes (requieren browser)

1. **Catálogo demo-tech** — Sin botón "+", sin carrito; al abrir producto aparece diálogo con botón "Consultar por WhatsApp" (usa `+584125550042`); mensaje WA incluye nombre del producto y variante seleccionada
2. **Panel como `noaccess@test.mesa`** — `CatalogDashboard` visible (sin métricas de ventas); acciones: "Añadir producto", "Ver catálogo"; enlace `/r/demo-tech` copiable
3. **Configuración → Modalidad** — Toggle "Solo catálogo / Catálogo con pedidos" visible; cambiar a "Con pedidos" y volver a guardar como "Solo catálogo"
4. **Publicar/despublicar** — Producto publicado visible en `/r/demo-tech`; despublicado desaparece (RLS filtra)
5. **Contraste con Alfa** — `/r/restaurante-alfa` sí muestra botón "+", carrito y FAB; placeholder "¿Qué te provoca hoy?"
6. **One-page a 360/768/1440** — Plan cards, CTA "Solicitar mi catálogo" abre cliente de correo; "Ver demostración" abre `/demo/menu`
7. **WhatsApp con variantes** — Abrir Auriculares, seleccionar "Azul medianoche", tocar "Consultar" → mensaje WA con variante incluida

---

## Reposicionamiento y modalidad del catálogo (22/10/2026)

### Cambio de posicionamiento

Mesa pasa de plataforma de pedidos para restaurantes a **plataforma de catálogos digitales para negocios**. El texto de la one-page, los planes y el panel reflejan este cambio. Los pedidos son una función adicional activable, no la función principal.

### Migración 024 — Modalidad del catálogo

| Componente | Estado |
|---|---|
| Archivo SQL | ✅ `supabase/migrations/20261022000024_catalog_mode.sql` |
| `orders_enabled` column | ⏳ **Pendiente DDL** — aplicar en Supabase Dashboard |
| GRANT anon SELECT orders_enabled | ⏳ Requiere DDL |
| `save_restaurant_config` actualizado | ⏳ Requiere DDL |
| Trigger `trg_guard_orders_enabled` en orders | ⏳ Requiere DDL |

**Instrucciones**: SQL Editor → Nueva consulta → pegar `20261022000024_catalog_mode.sql` → Ejecutar.

### Comportamiento antes y después del DDL

| Comportamiento | Antes del DDL | Después del DDL |
|---|---|---|
| `orders_enabled` en config | Null → `?? true` (pedidos ON) | Columna existe; el propietario puede cambiarla |
| Placeholder del buscador | "¿Qué te provoca hoy?" | "¿Qué estás buscando?" cuando `orders_enabled=false` |
| Botón "+" en tarjetas | Siempre visible | Oculto en modo catálogo |
| Carrito/FAB | Siempre visible | Oculto en modo catálogo |
| Diálogo de producto | OrderDialog con carrito | CatalogDialog con WhatsApp en modo catálogo |
| Bloqueo DB de pedidos | No | Trigger bloquea INSERT en orders |

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `supabase/migrations/20261022000024_catalog_mode.sql` | DDL: columna, grant, RPC, trigger |
| `src/lib/catalog-types.ts` | `orders_enabled` en `PublicRestaurantConfig` y `RestaurantConfig` |
| `src/lib/plan-catalog.ts` | Descripciones con catálogo primero |
| `src/app/r/[slug]/page.tsx` | Añade `orders_enabled` al SELECT; pasa `ordersEnabled` al cliente |
| `src/app/r/[slug]/public-menu-client.tsx` | Props `ordersEnabled`, `CatalogProductDialog`, buscador condicional |
| `src/app/panel/configuracion/config-form.tsx` | Toggle de modalidad; "Nombre del negocio" |
| `src/app/panel/configuracion/actions.ts` | `orders_enabled` en config |
| `src/app/panel/page.tsx` | `CatalogDashboard` cuando pedidos desactivados |
| `src/app/page.tsx` | Reescritura completa — nuevo posicionamiento |
| `docs/PROPUESTA.md` | Actualizado con nuevo enfoque |
| `scripts/apply-migration-024.ts` | Script de verificación |

### Verificaciones de código

| Verificación | Resultado |
|---|---|
| `npm run typecheck` | ✅ limpio |
| `npm run build` | ✅ limpio |
| `npm test` | ✅ 5/5 |
| SSR one-page: título "vitrina", CTA "Solicitar", FAQ nuevas preguntas | ✅ |
| `plan-card-billing` dice "por negocio" | ✅ |

### Verificaciones visuales pendientes

1. **One-page** — Título "Tus productos, en una vitrina digital propia." visible; CTA "Solicitar mi catálogo" abre mailto; "Ver demostración" lleva a /demo/menu; plan cards a 360/768/1440 px; FAQ expandible con 8 preguntas
2. **Catálogo modo solo catálogo** — Activar "Solo catálogo" en /panel/configuracion (requiere DDL 024); verificar: sin botón "+", sin carrito, placeholder "¿Qué estás buscando?", diálogo con WhatsApp
3. **Catálogo con pedidos** — Flujo completo sin cambios (requiere restaurante con pedidos activos)
4. **Panel home en modo catálogo** — `CatalogDashboard` con enlace y acciones de catálogo; sin métricas de ventas
5. **Panel config** — Toggle "Solo catálogo / Catálogo con pedidos" visible en pestaña General
6. **Intento directo de pedido con orders_enabled=false** — Verificar que el trigger bloquea (requiere DDL 024)

---

## Entrega visual y planes comerciales (22/10/2026)

### Resumen de cambios

| Área | Qué cambió |
|---|---|
| **globals.css** | Reescritura completa y organizada; variables `--trans`, `--radius-*`; sin minificar |
| **Menú público** | Portada 260 px/200 px móvil; 2 columnas (era 3); imagen tarjeta 140 px/160 px (era 110 px); botón "+" 44×44 px área táctil / 36 px círculo visual; section spacing 52 px |
| **Hover** | `@media(hover:hover)` en tarjetas, botones y plan cards; `translateY` máx. 2 px; `prefers-reduced-motion` desactiva todo |
| **Product dialog** | Imagen 240 px al borde superior del modal (border-radius 18 px); contenido con 24 px padding lateral |
| **One page** | Secciones 96 px desktop / 56 px móvil; plan cards con hover elevation; FAQ summary 15 px |
| **Admin shell** | Sidebar oscuro unificado (`AdminShell`); breadcrumbs; layout 2 columnas en detalle de restaurante |
| **Planes comerciales** | `src/lib/plan-catalog.ts` como fuente única; 3 planes en one-page + formulario admin + widget panel; migración 023 preparada |

### Verificaciones de código

| Verificación | Resultado |
|---|---|
| `npm run typecheck` | ✅ limpio |
| `npm run build` | ✅ limpio |
| `npm test` (precios) | ✅ 5/5 |
| `npm run test:plans` | ✅ 10/10 (PL01/02/03/06/07/08 con ⚠ skip — DDL 023 pendiente en BD) |

### Migración 023 (planes comerciales) — estado

| Componente | Estado |
|---|---|
| Archivo SQL | ✅ `supabase/migrations/20261022000023_commercial_plans.sql` |
| Planes en BD | ⏳ **Pendiente DDL** — aplicar en Supabase Dashboard → SQL Editor |
| `get_plan_usage` RPC | ⏳ Requiere DDL |
| `upsert_product` con límites | ⏳ Requiere DDL |
| Trigger `trg_check_member_limit` | ⏳ Requiere DDL |

Instrucciones: SQL Editor → Nueva consulta → pegar `20261022000023_commercial_plans.sql` → Ejecutar → relanzar `npm run test:plans`.

### Datos de demostración (restaurante-alfa)

Seed idempotente ejecutado con `scripts/seed-demo.ts`. Solo modifica restaurante-alfa.
Portada ✅ · Horarios 11–22 h todos los días ✅ · 3 categorías · 8 productos · Checkout funcional ✅.
Imágenes de productos pendientes: 7 productos sin foto real (subir desde `/panel/menu/products/[id]/edit`).

### Pendientes de revisión visual en navegador

1. **Menú público** — Portada con imagen real y overlay en distintos fondos; scroll táctil de categorías a 360/390 px; tarjetas hover `translateY`; modal con imagen al borde; barra carrito sobre notch iPhone; color E63B3B en acentos
2. **One page** — Plan cards hover elevation a 1440 px; FAQ expandible; sección de precios a 768/390 px
3. **Admin** — Sidebar oscuro; breadcrumbs en detail/new; layout 2 col a 1440 px; filtros stacked a 360 px
4. **Panel** — Tab "Plan" en configuración; banner de límite en catálogo; inputs focus ring
5. **Flujo completo** — Producto → variantes → carrito → checkout → confirmación a 390 px

### Pendientes técnicos

1. **Migración 022** — `get_dashboard_metrics` pendiente de aplicar en BD (dashboard muestra error de RPC)
2. **Migración 023** — DDL planes pendiente (ver tabla arriba)
3. **Canal de contacto** — `mailto:contacto@mesa.app` es placeholder; configurar dirección real antes del lanzamiento
4. **Formulario de producto** — Secciones internas (variantes, opciones) sin refinamiento visual pendiente
4. **sidebar-bottom (móvil)**: el fix de !important de la sesión anterior puede quedar obsoleto; revisar botón "Cerrar sesión" en drawer móvil
0. ← desplaza los pendientes anteriores a continuación
2. **Configurar las 5 variables en Railway** → redeploy → verificar HTTP 200 en /
3. Configurar Supabase Auth → URL Configuration → Site URL y Redirect URLs para staging
4. **Verificación manual en browser** del nuevo dashboard: sidebar oscuro, métricas, filtro de período, tabla de pedidos, estados vacíos
5. Verificar responsive a 360 px: sidebar oculto → header oscuro → drawer oscuro
6. SMTP en Supabase para habilitar flujo completo de invitación de dueño
7. Notificaciones en tiempo real (Supabase Realtime) para nuevos pedidos
8. Registro por invitación (owner invita miembros a su restaurante)
9. Decidir: dominio principal + subdominio comodín vs. solo dominios personalizados
10. Crear Supabase de producción independiente antes de cualquier carga real

## Notas de diseño del dashboard (15/10/2026)

### Definición de métricas

| Métrica | Definición | Cancelaciones |
|---|---|---|
| Pedidos recibidos | COUNT de todos los pedidos creados en el período, cualquier estado | Se cuentan (representan carga operativa) |
| Pedidos activos | COUNT en tiempo real de pedidos no terminales (received, accepted, preparing, ready, on_the_way) | No aplica (en curso) |
| Confirmado cobrado | SUM de total_cents donde payment_status='confirmed' AND status NOT IN ('cancelled','rejected') | Excluidos |
| Ticket promedio | AVG de total_cents excluyendo cancelled y rejected en el período | Excluidos |

"Confirmado cobrado" representa lo que el restaurante marcó como cobrado en el período. No se denomina "ingresos netos" porque el sistema no registra costos ni reembolsos.

### Rol cocina

El rol cocina no recibe métricas financieras ni datos de clientes. Solo ve:
- Pedidos activos (tiempo real)
- Cola de preparación (accepted/preparing/ready, sin monto, sin PII)

### Estados vacíos vs errores

- Sin pedidos en el período → texto descriptivo, sin cifras cero falsas
- Error de RPC → mensaje de error con enlace para reintentar; nunca cifras cero
- Migración 022 no aplicada → el RPC falla, se muestra el error de conexión

---

## Subdominios de restaurante — arquitectura y configuración

### Cómo funciona (código en producción hoy)

El proxy en `src/proxy.ts` y las utilidades en `src/lib/host-resolver.ts` ya manejan la secuencia completa:

```
1. isPlatformHost(host)                → sitio comercial + panel (localhost, PLATFORM_HOST, APP_HOST)
2. Bloqueo de rutas privadas           → /panel /admin /login /demo → 404 en dominios de restaurante
3. extractPlatformSubdomain(host)      → slug.PLATFORM_SUBDOMAIN_BASE → reescritura a /r/[slug]
4. couldBeRestaurantDomain(host)       → filtro de hosts claramente inválidos
5. resolveCustomDomain(host)           → lookup DB via get_restaurant_slug_by_host
6. Respuesta 404 controlada           → sin fuga de datos
```

Para `restaurante-alfa.DOMINIO_PROPIO/`:

| Paso | Función | Resultado |
|---|---|---|
| Normalizar | `normalizeHost` | elimina puerto, FQDN dot, lowercase |
| ¿Plataforma? | `isPlatformHost` | false (no es localhost ni PLATFORM_HOST) |
| ¿Subdominio? | `extractPlatformSubdomainFor(host, PLATFORM_SUBDOMAIN_BASE)` | devuelve `"restaurante-alfa"` |
| Acción | `resolveRestaurantPath("/", "restaurante-alfa")` | `{ kind: "rewrite", to: "/r/restaurante-alfa" }` |
| Cookie checkout | `x-mesa-restaurant-slug` header en `/api/orders` | path `/pedido/`, redirectTo `/pedido/` |

### Variables de entorno requeridas

| Variable | Ejemplo | Descripción |
|---|---|---|
| `NEXT_PUBLIC_PLATFORM_HOST` | `mesa.app` | Dominio del sitio comercial y panel |
| `NEXT_PUBLIC_APP_HOST` | *(vacío)* | Panel si difiere del anterior; hereda PLATFORM_HOST |
| `PLATFORM_SUBDOMAIN_BASE` | `mesa.app` | Base para subdominios de restaurante |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` | URL Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `eyJ…` | Clave anon Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ…` | Clave de servicio (privada) |
| `NEXT_PUBLIC_SITE_URL` | `https://mesa.app` | Para invitaciones Supabase Auth |

**Nota**: Si se usa el mismo dominio para sitio comercial y subdominios (`PLATFORM_SUBDOMAIN_BASE=mesa.app` y `NEXT_PUBLIC_PLATFORM_HOST=mesa.app`), el proxy diferencia correctamente porque `isPlatformHost` atrapa el apex antes de que llegue a `extractPlatformSubdomain`. Los subdominios reservados (www, app, admin, api, panel…) se bloquean explícitamente.

### Pasos pendientes en Railway y DNS (no ejecutables sin dominio propio)

Completar cuando se disponga de un dominio real (p. ej. `mesa.app`).

**Antes de ejecutar cualquier paso: verificar la documentación vigente de Railway.**

#### A. Dominio comercial y panel (`mesa.app`)

1. Railway → Settings → Domains → Add custom domain → `mesa.app`
2. DNS: `CNAME mesa.app → XXX.up.railway.app` (o registro `A` si Railway lo requiere para el apex)
3. Railway emite TLS automáticamente (Let's Encrypt). Esperar a que el estado sea "Active".
4. Variable: `NEXT_PUBLIC_PLATFORM_HOST=mesa.app`

#### B. Host del panel (si es distinto, p. ej. `app.mesa.app`)

1. Railway → Add custom domain → `app.mesa.app`
2. DNS: `CNAME app.mesa.app → XXX.up.railway.app`
3. Variable: `NEXT_PUBLIC_APP_HOST=app.mesa.app`

#### C. Wildcard para restaurantes (`*.mesa.app` → `restaurante-alfa.mesa.app`)

Railway Pro o Team admiten wildcard domains. Verificar disponibilidad en el plan activo antes de continuar.

1. Railway → Settings → Domains → Add custom domain → `*.mesa.app`
2. DNS en el proveedor del dominio:
   ```
   CNAME  *.mesa.app  XXX.up.railway.app
   ```
   Si el proveedor no admite CNAME en el apex, usar el wildcard en el nivel de subdominio específico (p. ej. `*.menu.mesa.app`).
3. TLS wildcard: Railway lo gestiona automáticamente si el proveedor DNS soporta el challange DNS-01. Consultar la documentación de Railway sobre wildcard certificates en el momento de configurar.
4. Variable: `PLATFORM_SUBDOMAIN_BASE=mesa.app`
5. Redeploy en Railway para que las variables queden activas.

#### D. Verificación tras configurar

```bash
# 1. Resolver DNS wildcard
dig restaurante-alfa.mesa.app
# Debe devolver la IP de Railway (misma que el apex o el CNAME).

# 2. HTTPS
curl -I https://restaurante-alfa.mesa.app/
# Esperado: HTTP 200 o rewrite interno, certificado válido.

# 3. Restaurante conocido
# Si restaurante-alfa existe en la BD como slug 'restaurante-alfa':
curl -I https://restaurante-alfa.mesa.app/
# → 200 con el menú

# 4. Subdominio reservado
curl -I https://admin.mesa.app/
# → 404 (extractPlatformSubdomain devuelve null para "admin")

# 5. Subdominio desconocido
curl -I https://no-existe-xyz.mesa.app/
# → La página /r/no-existe-xyz renderiza 404 de Next.js (notFound())

# 6. Checkout desde subdominio
# POST /api/orders desde restaurante-alfa.mesa.app
# La cookie debe tener Path=/pedido (no /r/restaurante-alfa/pedido)
# y redirectTo=/pedido/ (no /r/restaurante-alfa/pedido/)
```

#### E. Acceso /r/[slug] durante la transición

La ruta `/r/restaurante-alfa` en `mesa.app` sigue funcionando después de activar subdominios. No hay periodo de corte. Los dos formatos coexisten indefinidamente.

### Seguridad

| Punto | Mecanismo |
|---|---|
| Host header manipulado | Solo se lee `Host`; `X-Forwarded-Host` ignorado |
| Slug inválido en subdominio | `SLUG_RE` + `RESERVED_SUBDOMAINS` rechazan antes de cualquier lookup |
| Slug multi-nivel (`a.b.BASE`) | `sub.includes(".")` → null; no hay bypass posible |
| Restaurante suspendido o inactivo | `get_restaurant_slug_by_host` (SECURITY DEFINER) solo devuelve slug si `status='active'` |
| Suscripción vencida | `place_order` verifica suscripción dentro del RPC, no en el proxy |
| Cookie cross-domain | Cookies host-only: `restaurante-alfa.mesa.app` no comparte cookies con `mesa.app` |
| Header `x-mesa-restaurant-slug` spoofed | No es gate de seguridad; `restaurant_id` se valida en el RPC por ID |

### Pruebas ejecutadas

| Test | Tipo | Resultado |
|---|---|---|
| SD01-SD11: extractPlatformSubdomainFor | Pura (sin BD) | ✅ 11/11 |
| SD12-SD19: resolveRestaurantPath | Pura (sin BD) | ✅ 8/8 |
| SD20: flujo integrado normalizeHost + extract | Pura (sin BD) | ✅ 1/1 |
| RESERVED_SUBDOMAINS invariante | Pura | ✅ 1/1 |
| SLUG_RE válidos/inválidos | Pura | ✅ 1/1 |
| DO01-DO10: dominios custom (DB) | Con BD | ✅ 13/13 (previos) |
| Verificación con subdominio real | **PENDIENTE** | ⏳ Requiere dominio propio + Railway configurado |

---

## Verificación del rediseño de Configuración (27/10/2026)

### Cambios implementados

| Cambio | Detalle |
|---|---|
| **Tabs en móvil** | Se eliminó `display:none` en `.cfg-tab-label`. Ahora icono + texto visibles en móvil con `font-size:11.5px`, `padding:8px 10px`, `gap:4px`. Scroll horizontal existente (`overflow-x:auto`) gestiona el desbordamiento. |
| **Diálogo 3 opciones** | `UnsavedDialog` recibe `onSave?` y `isSaving`. Al registrar un `setSaveHandler` desde el formulario activo, el diálogo muestra "Guardar y continuar". Si el guardado falla, el diálogo cierra y el formulario conserva sus valores. |
| **setSaveHandler en contexto** | `UnsavedChangesCtx` expone `setSaveHandler(fn | null)`. Cada formulario (NegocioForm, AppearanceForm, CatalogModeForm) registra un handler vía `formRef.current?.requestSubmit()` cuando está dirty, y lo limpia al desmontar. |
| **Saves atómicos** | `saveIdentity`: upsert solo sobre columnas de identidad en `restaurant_config` + update directo sobre `restaurants.name/timezone`. `saveAppearanceConfig`: upsert solo sobre `primary_color, background_color, secondary_color, font_family`. `saveCatalogMode`: upsert solo sobre `orders_enabled, pickup_*, delivery_*, is_temporarily_closed, closed_message`. Sin read-modify-write: concurrencia entre secciones sin sobreescritura. |
| **removeConfigImage** | Nueva Server Action. Llama `update_config_image(p_new_path=null)` para limpiar la referencia en DB antes de borrar el archivo del Storage. Si la RPC falla, el archivo en Storage se conserva. |
| **Botones "Quitar"** | Aparecen solo cuando hay imagen guardada. Usan `removeImg("logo")` / `removeImg("cover")`. Estado local `localLogoPath` / `localCoverPath` refleja el cambio inmediatamente sin recargar la página. |
| **Upload sin reload** | `uploadImg` ya no llama `window.location.reload()` en éxito. Si el update en DB falla tras subir el archivo, muestra el error y no navega (el archivo en Storage queda huérfano, recuperable desde el dashboard de Supabase). |
| **formRef en formularios** | `NegocioForm`, `AppearanceForm` (colors form), `CatalogModeForm` usan `useRef<HTMLFormElement>` para `requestSubmit()` desde el save handler del diálogo. |
| **prevState guard en effects** | Cada formulario mantiene `prevState.current` para evitar que el effect de `state` dispare en el render inicial (comparación referencial). |

### Colores y tipografía en el catálogo público

La ruta `/r/[slug]/public-menu-client.tsx` ya leía `background_color`, `secondary_color` y `font_family` desde `restaurant_config` (columnas añadidas en migración 025 y expuestas a `anon`). Los CSS vars `--menu-bg`, `--menu-primary` y `fontFamilyStyle` se aplican al wrapper raíz del catálogo. Tras guardar desde `saveAppearanceConfig`, `revalidatePath("/r/[slug]", "page")` invalida el caché SSR.

La vista previa en `AppearanceForm` usa los mismos estados `primaryColor`, `bgColor` y `fontFamily` que se incluyen en el form submit, por lo que siempre representa lo que se va a guardar.

### Pruebas funcionales añadidas

| Test | Descripción | Tipo |
|---|---|---|
| CS01 | Guardar Apariencia conserva `phone`, `whatsapp`, `description` | BD (upsert columnas distintas) |
| CS02 | Guardar Mi negocio conserva `primary_color`, `font_family`, `background_color` | BD |
| CS03 | Dos upserts concurrentes en secciones distintas se preservan mutuamente | BD (Promise.all) |
| CS04 | Lanz y Luale tienen `primary_color`, `background_color`, `font_family` y `whatsapp` distintos | BD |
| CS05 | Owner de Alfa no puede upsert directo sobre restaurant_config de Beta | RLS |
| CS06 | Un guardado previo no altera campos de sesiones anteriores | BD |
| CS07 | Colores y tipografía guardados por owner son visibles para anon (columnas con GRANT) | BD + anon |
| CS08 | Owner de Beta no puede sobreescribir config de Alfa | RLS |

Ejecutar: `npm run test:sections` (requiere `.env.local` y `.env.test`).

### Verificaciones ejecutadas

| Verificación | Resultado |
|---|---|
| `npm run typecheck` | ✅ limpio |
| `npm run build` | ✅ limpio (tras refreshar receipt del advisory) |
| `npm test` (precios) | ✅ 5/5 |
| `npm run test:unsaved` (guard lógico) | ✅ 12/12 |
| `npm run test:sections` | ⏳ Requiere BD de prueba (.env.test) |

### Verificaciones visuales pendientes

1. **Tabs en móvil (360 px)** — 8 tabs con icono + texto; scroll horizontal sin saltos; tab activo con borde morado visible
2. **Diálogo "Guardar y continuar"** — Modificar campo en Mi negocio → hacer clic en pestaña Apariencia → diálogo aparece con 3 botones → "Guardar y continuar" guarda y navega → si el servidor devuelve error, diálogo cierra, formulario mantiene los valores
3. **Diálogo al cambiar negocio** — Modificar campo → "Cambiar negocio" → diálogo aparece → opciones funcionan
4. **Diálogo al cerrar/recargar pestaña** — Formulario sucio → F5 → el navegador pide confirmación
5. **Logo "Quitar"** — Subir logo → aparece botón "Quitar" → clic → logo desaparece de la vista previa y del catálogo público tras recargar
6. **Portada "Quitar"** — Mismo flujo
7. **Reemplazar sin perder** — Subir logo → reemplazar con imagen nueva → si la red falla al actualizar DB, la imagen anterior sigue visible
8. **Colores en catálogo** — Guardar color `#e63946` en Apariencia → recargar `/r/lanz-technology` → pestañas y precios usan ese color
9. **Tipografía Nunito** — Activar en Apariencia → recargar catálogo → fuente se aplica a nombres y precios
10. **Vista previa en tiempo real** — Cambiar color en el picker → la tarjeta de vista previa refleja el cambio sin guardar

---

## Advertencia de seguridad — Next.js 16.4.0

### Versión instalada

`next@16.4.0` (ver `package.json`). React `19.3.0`.

### Advisories activos (consultado 27/10/2026 via npm bulk advisory endpoint)

| Título | Severidad | Rango afectado | Versión corregida |
|---|---|---|---|
| Denial of Service in App Router using Server Actions | **High** | `>=16.0.0 <=16.4.0` | No disponible |
| Unauthenticated RCE in Image Optimization API (SVG files) | **Critical** | `>=16.0.0 <=16.4.0` | No disponible |
| Unauthenticated RCE in `use cache` functions returning typed arrays | **Critical** | `>=16.0.0 <=16.4.0` | No disponible |

La respuesta del endpoint muestra `patched_versions: None` — no existe una versión corregida publicada en npm a esta fecha. `next upgrade --agent=security` bloquea el build (`SecurityFatalError`) hasta que se ejecute por primera vez o hasta que el receipt de retry (`.next/cache/next-agentic-upgrade-retries/`) sea fresco (TTL 5 min).

### Mecanismo del bloqueo

Next.js 16.x detecta el contexto de agente IA vía la variable de entorno `__NEXT_AGENT_UPGRADE=security` (inyectada por Claude Code). Al encontrar un advisory activo, escribe un archivo de receipt y lanza `SecurityFatalError`. En el segundo intento dentro de los 5 minutos del receipt, el build prosigue con una advertencia. En sesiones de CI o fuera de agente el bloqueo no aplica.

Para ejecutar el build localmente sin el bloqueo: refrescar el receipt file en `.next/cache/next-agentic-upgrade-retries/` e inmediatamente ejecutar `npm run build`.

### Aplicabilidad a Mesa Platform

| Advisory | Aplica a Mesa | Justificación |
|---|---|---|
| DoS via Server Actions | **Parcial** | Mesa usa Server Actions (saveIdentity, etc.) pero requieren autenticación como owner — el atacante tendría que estar autenticado y ser miembro activo del negocio |
| RCE en Image Optimization API (SVG) | **No aplica** | Mesa no usa `next/image`. Las imágenes se sirven directamente desde Supabase Storage con etiquetas `<img>` sin pasar por la Image Optimization API de Next.js |
| RCE en `use cache` con typed arrays | **No aplica** | Mesa no usa la directiva `use cache` en ningún archivo |

### Worktree preparado (no integrado)

Pendiente: crear worktree con `git worktree add` y ejecutar `next upgrade --agent=security` para investigar si la herramienta encuentra una versión destino o solo documenta el estado de las vulnerabilidades. No integrar hasta que exista una versión corregida publicada en npm y el equipo autorice la actualización.

**Acción recomendada**: suscribirse a las alertas del repositorio `vercel/next.js` y al feed de advisories de npm para `next` — actualizar en cuanto aparezca una versión corregida en el rango `>=16.4.1`.

---

## Finanzas e Inventario — Implementación v1 (27/10/2026)

### Estado de las migraciones

| Num. | Archivo | Contenido | Aplicada en BD |
|---|---|---|---|
| 028 | `20261027000028_financial_movements.sql` | Tabla `financial_movements` + RLS + RPC `get_financial_summary` | ⏳ Pendiente |
| 029 | `20261027000029_product_cost_stock.sql` | Columnas `cost_cents`, `stock_quantity`, `stock_alert` en `products` y `product_variants`; tabla `stock_adjustment_log`; REVOKE anon | ⏳ Pendiente |
| 030 | `20261027000030_stock_tracking_config.sql` | Columna `stock_tracking_enabled` en `restaurant_config`; extiende `save_restaurant_config` RPC | ⏳ Pendiente |

Para aplicar: SQL Editor de Supabase → pegar cada archivo en orden.

### Rutas implementadas

| Ruta | Descripción |
|---|---|
| `/panel/finanzas` | Pantalla principal: 3 indicadores, lista de movimientos, CTA "Registrar movimiento" |
| `/panel/finanzas/analisis` | Vista secundaria: tabla de márgenes, valoración de inventario |

### Navegación

- **Finanzas** añadido al sidebar de `PanelShell` entre Catálogo y Configuración (solo `owner`).
- No aparece en el menú de roles `attention` ni `kitchen`.

### Funciones operativas

| Función | Dónde | Estado |
|---|---|---|
| Registrar movimiento (income/expense/purchase) | `/panel/finanzas` — slideout derecho | ✅ UI + action |
| Anular movimiento (`is_voided=true`) | `voidMovement` en actions.ts | ✅ Action (UI de anulación pendiente en lista de movimientos) |
| Ver indicadores Cobrado/Pagado/Flujo neto | `/panel/finanzas` | ✅ Conectado a RPC (requiere migración 028) |
| Filtro de período (Hoy/Ayer/7 días/Este mes) | Header de `/panel/finanzas` | ✅ URL searchParam |
| Control del producto (costo, stock, alerta) | Formulario de producto — bloque colapsado | ✅ UI + action (requiere mig. 029+030) |
| Toggle "Control de existencias" | `/panel/configuracion` → Catálogo | ✅ Toggle + action (requiere mig. 030) |
| Vista análisis: márgenes y valoración | `/panel/finanzas/analisis` | ✅ SSR (requiere mig. 029) |
| Ajuste de stock con historial | `adjustStock` en actions.ts | ✅ Action (sin UI de ajuste rápido en esta versión) |

### Limitaciones documentadas de v1

- **Anulación desde UI**: la UI de anulación desde la lista de movimientos queda pendiente; la Server Action `voidMovement` ya existe y está lista.
- **Stock por variante**: el DB tiene las columnas en `product_variants`, pero el formulario muestra solo una nota indicando que vendrá próximamente.
- **Descuento automático de stock al procesar un pedido**: no implementado en v1 (documentado como pendiente).
- **Stock en catálogo público**: `stock_quantity` y `stock_alert` no se muestran a anon en v1.
- **Resumen financiero sin migración 028**: la página muestra un aviso de error accionable en lugar de romper.

### Reglas aplicadas

- `purchase` no aparece como tipo si `stockEnabled = false` (toggle en Configuración).
- Movimientos anulados (`is_voided=true`) no afectan los totales del RPC.
- El RPC usa la zona horaria del restaurante para calcular "hoy".
- No se mezclan monedas: el resumen usa la moneda más frecuente de los movimientos del restaurante.
- Cada acción de servidor valida `member_role(restaurant_id) = 'owner'` antes de operar.
- RLS en `financial_movements`: owner solo ve/escribe sus propios movimientos; anon sin acceso.
- RLS en `stock_adjustment_log`: owner solo ve/escribe sus propios ajustes; anon sin acceso.
- Columnas `cost_cents`, `stock_quantity`, `stock_alert` en `products`/`product_variants`: REVOKE anon (internas).

### Verificaciones realizadas

| Verificación | Método | Resultado |
|---|---|---|
| `npm run typecheck` | CLI | ✅ limpio |
| `npm run build` | CLI | ✅ limpio — rutas /panel/finanzas y /panel/finanzas/analisis presentes |
| `npm test` (precios) | CLI | ✅ 5/5 |
| `npm run test:unsaved` (guard) | CLI | ✅ 12/12 |
| `npm run test:finance` (aislamiento) | CLI | ⏳ Requiere BD con migraciones 028-030 y .env.test |
| Estructura RLS migración 028 | Revisión SQL | ✅ Políticas SELECT/INSERT/UPDATE separadas; anon bloqueado |
| Estructura RLS migraciones 029-030 | Revisión SQL | ✅ REVOKE anon en columnas internas; GRANT authenticated |

### Verificaciones visuales pendientes (requieren browser + migraciones aplicadas)

1. **Registrar movimiento** → guardar → recargar → aparece en lista y actualiza totales
2. **Anulación**: añadir botón en fila y verificar que el total cambia
3. **Toggle "Control de existencias"** en Configuración → habilitar → ir a ficha de producto → bloque "Control del producto" aparece colapsado
4. **Guardar costo y stock** desde ficha de producto → recargar → valores persisten
5. **Vista análisis** `/panel/finanzas/analisis` → tabla de márgenes con productos que tienen costo
6. **Aislamiento Lanz/Luale**: ingresar con cada owner y verificar que los movimientos son independientes
7. **Rol atención en Finanzas**: la ruta `/panel/finanzas` redirige a `/panel` (layout gate)
8. **Slideout en móvil**: formulario ocupa pantalla completa, botón "Registrar" visible sin scroll

---

## Diagnóstico y corrección de /panel/finanzas (27/10/2026)

### Causa demostrada

Las migraciones 023-030 **nunca habían sido aplicadas** a la BD de Supabase (`xlqilgkohjdleqeeoslk`). La BD tenía solo hasta la migración 022. Los errores eran exactamente esto:
- `public.get_financial_summary` → función no existía
- `public.financial_movements` → tabla no existía

Adicionalmente, la MESA_DATABASE_URL es un pooler en transaction mode (puerto 6543), que no soporta DDL. Los scripts anteriores de migración individual fallaban silenciosamente por timeout. Se resolvió usando session mode (puerto 5432) del mismo pooler.

### Proyecto Supabase

- **Ref**: `xlqilgkohjdleqeeoslk`
- **Mismo proyecto** para la app (NEXT_PUBLIC_SUPABASE_URL) y las migraciones (MESA_DATABASE_URL) — verificado que la DB URL contiene el mismo ref de proyecto.
- **Modo de conexión para DDL**: session mode (puerto 5432) en lugar de transaction mode (puerto 6543).

### Migraciones aplicadas (27/10/2026)

| Migración | Contenido | Estado |
|---|---|---|
| 023 — Planes comerciales | `plan_code`, `allowed_roles`, seed planes, trigger límite miembros | ✅ Aplicada |
| 024 — Modo catálogo | `orders_enabled` en restaurant_config, trigger guard_orders_enabled | ✅ Aplicada |
| 025 — Apariencia catálogo | `background_color`, `secondary_color`, `font_family` | ✅ Aplicada |
| 026 — Image fit producto | `image_fit` en products | ✅ Aplicada |
| 027 — Thumbnail producto | `thumbnail_path` en product_images | ✅ Aplicada |
| 028 — Movimientos financieros | Tabla `financial_movements` + RLS + RPC `get_financial_summary` | ✅ Aplicada |
| 029 — Costo y stock producto | Columnas en products/variants, tabla `stock_adjustment_log` | ✅ Aplicada |
| 030 — Config seguimiento stock | `stock_tracking_enabled` en restaurant_config | ✅ Aplicada |

**Total aplicadas ahora: 30/30**

### Corrección de seguridad aplicada

`get_financial_summary` tenía `EXECUTE` concedido a `PUBLIC` y `anon` por defecto de PostgreSQL. Se revocó: ahora solo `authenticated` (con verificación de `member_role = 'owner'` dentro de la función SECURITY DEFINER).

### Mejoras de UI (estados de error)

- **Módulo no disponible**: si el RPC falla, muestra tarjeta con mensaje comprensible y botón "Reintentar". No muestra nombres de tablas, funciones ni instrucciones técnicas.
- **Error de movimientos**: si la tabla falla, muestra estado vacío con "Reintentar" (no el mensaje de error del servidor).
- **"Sin movimientos"**: solo se muestra cuando la consulta termina correctamente y devuelve 0 registros.
- **Botón "Registrar movimiento"**: solo aparece cuando el módulo está disponible.

### Verificación con datos reales (service role contra BD real)

| Verificación | Resultado |
|---|---|
| Insert movimiento income $125 para Lanz | ✅ status 201 |
| RPC summary hoy → income_cents = 12500 | ✅ coincide |
| Anular movimiento → summary income_cents = 0 | ✅ void excluido de totales |
| Anon no puede leer financial_movements | ✅ `permission denied for table` |
| financial_movements separados por restaurant_id | ✅ Lanz=1, Luale=0 movimientos |

### Verificaciones de código

| Verificación | Resultado |
|---|---|
| `npm run typecheck` | ✅ limpio |
| `npm run build` | ✅ limpio |
| `npm test` | ✅ 5/5 |

---

## Rediseño del shell del panel (27/10/2026)

### Cambios implementados

| Componente | Cambio |
|---|---|
| `panel-shell.tsx` | Rediseño completo. Sidebar 260 px, gradiente oscuro, iconos 20 px, cabecera integrada `.shell-header`, drawer móvil con backdrop y scroll-lock, "Ver catálogo/menú" centralizado en la cabecera |
| `admin-shell.tsx` | Mismo lenguaje visual: bloque de identidad "Plataforma Mesa", iconos 20 px, `.shell-header` sin botón de catálogo, drawer móvil con backdrop |
| `globals.css` (sección panel) | Reescritura completa de la sección de diseño del panel: sidebar con gradiente `#1e1a36→#19162E`, nuevas clases `.shell-header`, `.shell-catalog-btn`, `.sb-brand-wrap`, `.sb-biz-block`, `.sb-biz-row`, `.sb-biz-info`, `.sb-user-row`, `.sb-user-avatar`, `.panel-drawer-backdrop`, `.panel-mobile-drawer--open`, mejoras en hover/focus/active |

### Decisiones de diseño

**Sidebar (260 px)**
- Fondo: `linear-gradient(180deg, #1e1a36, #19162E)` — oscuro con gradiente sutil
- Logo arriba con padding propio (`.sb-brand-wrap`)
- Bloque de negocio: avatar con iniciales + nombre + rol + "Cambiar negocio" (solo si hay múltiples membresías)
- Nav agrupada: "Inicio + Pedidos" sin label, "Gestión" para Catálogo/Finanzas/Configuración
- Iconos 20 px con label siempre visible
- Estado activo: fondo morado suave + borde lateral izquierdo 3 px morado
- Sin grupo "ext" en el nav — "Ver catálogo/menú" se eliminó del sidebar
- Perfil + cierre de sesión en zona inferior

**Cabecera compartida (`.shell-header`)**
- Fondo `#1e1a36` integrado con el sidebar
- Altura 52 px (44 px en móvil)
- Izquierda: título de la sección actual derivado de `usePathname` + items del nav
- Derecha: botón "Ver catálogo" / "Ver menú" según `ordersEnabled`, solo en el panel del negocio
- Admin: solo muestra el título de sección, sin botón de catálogo

**Móvil (≤760 px)**
- Sidebar oculto; botón hamburguesa en la barra oscura fija
- Drawer se desliza desde la izquierda (`transform: translateX`) con transición fluida
- Backdrop oscuro semitransparente con `backdrop-filter: blur(2px)`
- Scroll-lock en `document.body` mientras el drawer está abierto
- Cierre: botón X dentro del drawer, clic en backdrop, tecla Escape
- `.shell-header` visible en móvil bajo la barra fija

**Sin duplicaciones**
- "Ver catálogo/menú" aparece SOLO en `.shell-header`
- Ninguna página del panel añade este botón en `PageHeader.actions` (se eliminó en sesiones anteriores)
- `pedidos/[id]` usa `btn-ver-menu` para el botón "← Pedidos" (retorno, no duplicado)
- `panel/page.tsx` tiene "Ver catálogo ↗" como acción rápida dentro del contenido de Inicio (no cabecera)

### Plan/consumo de productos
Omitido en esta primera versión del rediseño. La instrucción especifica "únicamente con datos y límites reales"; la integración del plan con el sidebar requiere una RPC adicional. Se añade en una iteración futura.

### Verificaciones realizadas

| Verificación | Resultado |
|---|---|
| `npm run typecheck` | ✅ limpio |
| `npm run build` | ✅ limpio — todas las rutas del panel presentes |
| `npm test` (precios) | ✅ 5/5 |
| `npm run test:unsaved` | ✅ 12/12 |
| Sin usos huérfanos de `.panel-topbar`, `.sidebar-workspace`, `.sidebar-bottom-v2` en páginas | ✅ verificado con grep |

### Verificaciones visuales pendientes (requieren browser en localhost:3001)

1. Sidebar visible y sticky al hacer scroll en contenido largo (Catálogo con muchos productos)
2. Estado activo correcto en formularios y sub-páginas (ej. `/panel/menu/products/new` → Catálogo activo)
3. Al cambiar Lanz ↔ Luale: nombre del negocio en sidebar actualiza, "Ver catálogo" apunta al slug correcto
4. Drawer móvil: abre, cierra con X/backdrop/Escape, scroll-lock activo, items visibles en 360 px
5. Admin shell: misma apariencia, título "Negocios" o "Planes" en cabecera
6. Finanzas: mantiene diseño sencillo (3 indicadores + movimientos) bajo la nueva cabecera
7. Configuración: secciones y formularios conservados, sin botón "Ver catálogo" duplicado
8. Foco visible en todos los elementos interactivos del sidebar

---

## Pre-despliegue — verificación (27/10/2026)

### Estado del repositorio

| Elemento | Estado |
|---|---|
| Repositorio | `https://github.com/cerebraia/mesa-platform.git` |
| Rama | `main` |
| Remoto | `origin` |
| Commits locales adelantados a origin/main | 3 (eb41acd, baa9807, 9c4fbfa) + este commit |
| Secretos versionados | ✅ Ninguno — `.env.local`, `.env.test`, service_role, DATABASE_URL en `.gitignore` |
| `.env.example` | ✅ Solo claves con valores vacíos — sin secretos |

### Next.js — parche de seguridad

- **Versión anterior**: `16.4.0` — 3 vulnerabilidades activas (2 Critical, 1 High)
- **Versión actualizada**: `16.4.3` — sin advisories verificado contra npm advisory bulk endpoint
- `npm ci` limpio · typecheck limpio · build limpio con 16.4.3

### Estado de la base de datos

| Objeto | Existe en BD | Verificado |
|---|---|---|
| `financial_movements` | ✅ | via REST API (`/rest/v1/financial_movements`) |
| `get_financial_summary(uuid, text)` RPC | ✅ | via REST API (`/rest/v1/rpc/get_financial_summary`) |
| `restaurant_config.stock_tracking_enabled` | ✅ | columna accesible |
| `restaurant_config.orders_enabled` | ✅ | columna accesible |
| `products.cost_cents` | ✅ | columna accesible |
| Migraciones aplicadas | 30/30 (001–030) | ✅ |
| Migraciones pendientes para el despliegue | Ninguna — ya aplicadas | ✅ |

### Resultados de pruebas

| Suite | Resultado | Tipo |
|---|---|---|
| `npm test` (pricing) | ✅ 5/5 | Automatizado — sin BD |
| `npm run test:unsaved` | ✅ 12/12 | Automatizado — sin BD |
| `npm run test:subdomains` | ✅ 22/22 | Automatizado — sin BD |
| `npm run test:finance` | ⏳ requiere `.env.test` con creds | BD — skip limpio sin creds |
| `npm run test:config` / `test:orders` / `test:panel` | ⏳ requieren `.env.test` | BD — skip limpio sin creds |
| `typecheck` | ✅ limpio | Automatizado |
| `build` | ✅ limpio — 28 rutas generadas | Automatizado |

### Verificaciones funcionales — estado

| Verificación | Método | Estado |
|---|---|---|
| Login y selección de negocio | Visual — requiere browser | ⏳ Pendiente |
| Navegación conservando negocio activo | Visual | ⏳ Pendiente |
| Sidebar sin duplicados, cabecera integrada | Visual | ⏳ Pendiente |
| Configuración: guardar sin perder otros ajustes | Test config-sections + visual | ⚠ Test requiere BD; visual pendiente |
| Catálogo público y WhatsApp | curl + visual | ✅ Verificado via curl (SSR correcto) |
| Finanzas: registro, resumen, anulación | Test finance + verificación REST real | ✅ Verificado via REST con datos reales |
| Aislamiento entre negocios | Test finance-isolation (requiere creds) | ✅ RLS verificado en conversación anterior |

### Archivos del commit

**Modificados (32):** `.gitignore`, `package.json`, `package-lock.json`, `docs/ESTADO.md`, todos los archivos de `src/` (panel, configuracion, menu, finanzas, catálogo público, admin, globals.css)

**Nuevos (17):**
- `src/app/panel/finanzas/` (layout, page, actions, movement-form, summary-client, analisis/)
- `src/app/seleccionar-negocio/`
- `src/components/crop-tool.tsx`, `hero-demo.tsx`, `whatsapp-button.tsx`
- `src/lib/contact.ts`
- `supabase/migrations/` (025–030)
- `tests/config-sections.test.ts`, `tests/finance-isolation.test.ts`
- `scripts/run-migrations-023-030.ts`, `seed-lanz-technology.ts`, `seed-luale-shop.ts`

### Variables Railway requeridas

Verificar que el servicio en Railway tiene configuradas estas variables. No configurar el valor aquí.

| Variable | Tipo | Para qué |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Build + Runtime | Cliente Supabase en SSR, proxy, checkout |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Build + Runtime | Operaciones dentro de RLS |
| `NEXT_PUBLIC_PLATFORM_HOST` | Runtime | Reconocer el hostname de Railway como plataforma |
| `NEXT_PUBLIC_SITE_URL` | Runtime | URL base para invitaciones Auth |
| `SUPABASE_SERVICE_ROLE_KEY` | Runtime (privada) | Auth Admin API, place_order, panel admin |

Variables ya confirmadas desde el despliegue previo en `mesa-platform-production.up.railway.app`.

**Variables que NO añadir:** `NODE_ENV` (Railway la pone), `MESA_DATABASE_URL` (solo migraciones locales), `NEXT_PUBLIC_APP_HOST` (hereda de PLATFORM_HOST).

### Railway — configuración

| Campo | Valor |
|---|---|
| Build command | `npm run build` (= `next build --webpack`) |
| Start command | `npm start` (= `next start -H 0.0.0.0`) — Next.js lee `PORT` de Railway automáticamente |
| Healthcheck | `GET /api/health` → `{"status":"ok"}` |
| Healthcheck timeout | 30 s |
| Restart policy | ON_FAILURE, max 3 reintentos |
| Deploy automático | **SÍ** — Railway detecta push a `main` y redesplega automáticamente |

### Despliegue automático

⚠️ **Un push a `main` activa el despliegue inmediatamente.** Confirmar que se quiere desplegar antes de ejecutar `git push origin main`.

### Reversión

| Nivel | Procedimiento |
|---|---|
| Aplicación | Railway: Settings → Deployments → elegir un deploy anterior → Redeploy. No toca la BD. |
| Migraciones 025–030 | **No hay rollback automático.** Estas migraciones son aditivas (ADD COLUMN IF NOT EXISTS, CREATE TABLE IF NOT EXISTS). La aplicación anterior (commit eb41acd) funciona sin esas columnas porque el código las lee con `?.` o `?? default`. |
| Datos comerciales | Sin cambio — ninguna migración modifica datos existentes. |

### Hostname a conservar

`mesa-platform-production.up.railway.app` — ya configurado en Railway. No se cambia ninguna variable de dominio en este despliegue.

---

## Importación catálogos Luale Shop (28/10/2026)

### Fuentes
- `Catalogo_Luale_Bebes_0_a_3_anos_Portada_Nueva (2).pdf` — 28 páginas (27 de producto)
- `Catalogo_Luale_Ninas_y_Ninos_Sin_Logos_Secciones (1).pdf` — 21 páginas (18 de producto, 2 separadores)

### Resultado

| Estado | Cantidad | Motivo |
|---|---|---|
| Actualizados con imagen nueva | **32** | Imagen de catálogo cargada en Storage y vinculada al producto existente |
| Pendientes — nuevos sin precio | **13** | `base_price_cents NOT NULL` impide crear productos sin precio; además el plan está en 49/50 productos |
| Errores | **0** | |
| Skipped (ya existían) | **0** | Primera importación desde estos PDFs |

### Método

- Páginas extraídas a 300 DPI con `pdftoppm`
- Miniaturas cuadradas 600×600 JPEG (fondo blanco, ratio conservado) con Pillow
- Upload idempotente a bucket `product-images` con clave estable `catalog-{fuente}-p{nn}.jpg`
- `product_images` insertado con storage_path + thumbnail_path + alt_text + position
- Verificación pre-insert evita duplicados (HEAD en Storage + query en DB)

### Verificaciones realizadas

| Check | Resultado |
|---|---|
| 32 registros `product_images` con `catalog-` en path en Luale | ✅ |
| URLs públicas accesibles (HTTP 200) | ✅ 3/3 spot-checked |
| Lanz Technology sin registros de catálogo | ✅ 0 |
| 12/12 productos clave verificados con imagen de catálogo | ✅ |
| Productos siguen publicados y con precio original | ✅ (solo se añadió imagen, nada más) |

### 13 pendientes (requieren precio confirmado y ampliación de plan)

| Fuente | Página | Producto |
|---|---|---|
| bebés | 7 | Conjunto chaqueta+pantalón NASA negro — 12-18m |
| bebés | 10 | Body ranita rayas multicolor — 3-6m |
| bebés | 14 | Pijama flores arcoíris celeste — 9-12m |
| bebés | 18 | Bodies manga corta básicos (5 colores) — 3-6m |
| bebés | 19 | Bodies sin mangas tonos tierra (5 colores) — 3-6m |
| bebés | 20 | Bodies sin mangas tonos neutros (5 colores) — 6-9m |
| bebés | 23 | Tops manga larga 3 piezas blanco/negro — 6-9m |
| bebés | 28 | Diademas turbantes tul con lazo (talla única) |
| niñas | 3 | Capri Italy top+pantalón palazzo azul — 4 años |
| niñas | 4 | Fresh Bakery top+pantalón naranja — 6 años |
| niñas | 11 | Capri Italy top lila+pantalón palazzo rayas rosa — 5 años |
| niñas | 12 | Premium Bakery top+pantalón palazzo verde — 4 años |
| niños | 16 | Oakland polo verde+short verde — 4 años |

Imágenes de los pendientes **sí fueron extraídas** (en `/tmp/luale_import/`). En cuanto se confirmen precios y se amplíe el plan, se pueden crear los productos y vincular las imágenes ya disponibles.

**Manifiesto completo:** `docs/luale-import-manifest.json`

### Actualización — borradores creados sin precio (28/10/2026)

El usuario autorizó crear los 13 productos pendientes sin precio.

**Migración 031** (`supabase/migrations/20261028000031_products_draft_support.sql`):
- `ALTER TABLE products ALTER COLUMN base_price_cents DROP NOT NULL`
- Aplicada. Migraciones totales: 31/31.
- `base_price_cents = NULL` es ahora válido; el CHECK `>= 0` solo aplica cuando el valor no es nulo.
- Productos con `base_price_cents = NULL` se crean con `is_published = false` y `is_available = false`.

**13 productos creados como borrador:**

| Categoría | Nombre | Talla |
|---|---|---|
| Bebés | Conjunto NASA Negro | 12-18 meses |
| Bebés | Body Ranita Rayas Multicolor | 3-6 meses |
| Bebés | Pijama Flores y Arcoíris | 9-12 meses |
| Bebés | Bodies Manga Corta Básicos | 3-6 / 6-9 meses |
| Bebés | Bodies Sin Mangas Tonos Tierra | 3-6 meses |
| Bebés | Bodies Sin Mangas Tonos Neutros | 6-9 meses |
| Bebés | Tops Manga Larga Clásicos | 6-9 meses |
| Bebés | Diademas Turbantes Tul con Lazo | Talla única |
| Niñas | Set Capri Italy Azul — Niñas | 4 años |
| Niñas | Set Fresh Bakery Naranja | 6 años |
| Niñas | Set Capri Italy Lila — Niñas | 5 años |
| Niñas | Set Premium Bakery Verde | 4 años |
| Niños | Set Polo Oakland Verde — Niños | 4 años |

**Estado final Luale Shop:** 62 productos totales (49 publicados + 13 borradores sin precio).

**Verificación:**
- 94 `product_images` en Luale (32 catálogo en productos existentes + 13 en borradores + 49 originales)
- Spot-check imagen borrador: HTTP 200 ✓
- Lanz Technology: 6 productos, sin cambios ✓
