# Estado Mesa Platform — 14 de octubre de 2026 (actualizado)

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

---

## Migraciones aplicadas: 21/21

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
| `npm run build` | ✅ limpio |

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

## Pendientes

1. **Configurar las 5 variables en Railway** → redeploy → verificar HTTP 200 en /
2. Configurar Supabase Auth → URL Configuration → Site URL y Redirect URLs para staging
3. **Verificación manual en browser** (guías anteriores + /admin + /login + formularios con guard GD-B01…GD-B11)
4. SMTP en Supabase para habilitar flujo completo de invitación de dueño
5. Notificaciones en tiempo real (Supabase Realtime) para nuevos pedidos
6. Registro por invitación (owner invita miembros a su restaurante)
7. Decidir: dominio principal + subdominio comodín vs. solo dominios personalizados
8. Crear Supabase de producción independiente antes de cualquier carga real
