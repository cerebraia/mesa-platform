# Propuesta de desarrollo: plataforma de pedidos para restaurantes

**Responsable del producto:** Luis Fernando Flores  
**Fecha:** 13 de octubre de 2026  
**Nombre de trabajo:** Mesa (provisional; pendiente de comprobar disponibilidad de marca y dominio)  
**Desarrollo:** Claude Code, con revisión y pruebas por cada fase  
**Estado:** especificación inicial para desarrollar una primera versión comercial.

## 1. Objetivo

Crear una plataforma que Luis pueda ofrecer por suscripción a restaurantes. Cada negocio tendrá un menú público con su marca y un panel privado para administrar productos, variaciones, pedidos, personal y configuración. Luis tendrá un panel general para gestionar restaurantes y suscripciones.

La experiencia debe ser sencilla y minimalista, tomando como referencia funcional y de composición https://latentacion.wuplify.com/. Se creará una identidad propia, sin reutilizar sus fotografías, textos, marca ni código.

Esta propuesta define el producto y el plan de implementación; no representa software ya desarrollado ni un presupuesto cerrado.

## 2. Modelo de funcionamiento

Una aplicación compartida en Railway y un proyecto de Supabase por entorno. Cada restaurante constituye un negocio independiente dentro de la plataforma. No se crea un despliegue por restaurante.

- Dirección inicial: `restaurante.tuplataforma.com`.
- Dominio opcional: `pedidos.restaurante.com` o `restaurante.com`.
- Panel del restaurante: inicialmente centralizado en `app.tuplataforma.com`, para simplificar sesiones y autenticación entre dominios.
- Administración general: sección protegida del panel central, con permisos exclusivos de plataforma.
- El dominio público identifica al negocio; los permisos autenticados determinan qué datos puede consultar o modificar cada usuario.

El alta inicial la realiza Luis desde su panel. El negocio recibe una invitación para configurar su cuenta y su menú. El registro público autónomo y la contratación automática se incorporarán después de validar los pilotos.

## 3. Dirección visual

### Menú público

Fondo limpio, tipografía legible y tarjetas horizontales compactas. En escritorio, tres columnas cuando el ancho lo permita; en móvil, una columna con imagen a la derecha. La fotografía del plato será el elemento visual principal.

Cabecera compacta con fotografía, logo, nombre, estado abierto/cerrado, horario y redes. Debajo: buscador y categorías con desplazamiento horizontal. Productos agrupados por categoría con nombre, descripción breve, precio, promoción cuando aplique y botón para agregar.

Al tocar un producto se abre su detalle con opciones y total actualizado. Carrito accesible en escritorio; en móvil, barra inferior con cantidad y subtotal al agregar el primer producto. Compra como invitado en la primera versión.

### Paneles privados

Morado como color principal, sugerencia inicial `#703BE6`, con superficies neutras, estados claramente etiquetados y formularios cortos. El menú público tendrá colores configurables por restaurante; el morado identificará la plataforma y sus paneles.

Navegación del restaurante: Pedidos, Menú, Clientes, Reportes, Equipo y Configuración. Navegación de Luis: Restaurantes, Planes y suscripciones, Dominios y Actividad.

Diseñar estados vacíos, carga, error, éxito y confirmación de acciones. Usar fotografías de demostración autorizadas y claramente sustituibles, evitando emojis como imágenes finales del catálogo.

## 4. Alcance de la primera versión

### A. Menú público y compra

- Categorías y productos con fotografías, descripción, precio y disponibilidad.
- Búsqueda y navegación por categorías.
- Precio normal y precio promocional, con reglas claras.
- Variantes y grupos de opciones por producto.
- Carrito que conserva cada personalización.
- Retiro en local y delivery por zonas configuradas y tarifa fija por zona.
- Nombre, teléfono, dirección cuando aplique y observaciones.
- Medios de pago configurados: efectivo, transferencia, pago móvil u otros con instrucciones. Esto no implica integración bancaria ni verificación automática.
- Página de confirmación con número y resumen del pedido.
- Seguimiento mediante enlace privado de alta entropía, sin exponer teléfonos o direcciones en enlaces públicos.
- Botón para enviar a WhatsApp el resumen de un pedido ya guardado. El cliente debe enviar el mensaje; abrir WhatsApp no garantiza que lo envíe.

El sistema crea un pedido recibido y pendiente de aceptación. La aceptación del restaurante y la confirmación del pago son estados separados. No prometer preparación hasta que el negocio acepte.

### B. Panel del restaurante

- Crear, editar, archivar y ordenar categorías y productos.
- Gestionar fotografías y disponibilidad.
- Configurar variantes, extras, restricciones y promociones.
- Pedidos recientes con filtros y detalle completo.
- Flujo: recibido → aceptado → en preparación → listo → en camino, para delivery → completado. Rechazado y cancelado como estados alternativos.
- Verificación manual del pago y notas internas.
- Historial de cambios de estado y responsable.
- Avisos visuales de nuevos pedidos; sonido opcional tras interacción del usuario. Recuperar pedidos al reconectar, sin depender exclusivamente de avisos en tiempo real.
- Vista simplificada de cocina, con opciones e ingredientes retirados destacados.
- Clientes e historial por negocio; consentimiento separado para comunicaciones comerciales.
- Reportes básicos: pedidos, importe confirmado y ticket promedio, indicando período y tratamiento de cancelaciones. No presentar pedidos recibidos como ventas cobradas.
- Equipo con invitaciones, permisos y revocación de accesos.
- Configuración de marca, contacto, horario, cierre excepcional, zonas, pagos y dominio.

### C. Administración general de Luis

- Crear y editar restaurantes, invitar a sus dueños y suspender el negocio.
- Configurar planes y límites, con aplicación de límites también en el servidor.
- Registrar suscripciones y pagos manualmente en la primera versión.
- Consultar estado operativo, vencimientos y dominios.
- Registrar acciones administrativas en auditoría.
- Evitar acceso indiscriminado a información personal; cualquier acceso de soporte debe ser explícito y quedar registrado.

La suspensión oculta la toma de pedidos públicos según una política definida, sin borrar historial. Definir acceso de lectura, exportación y retención antes de activar clientes comerciales.

## 5. Variantes y personalizaciones

Distinguir variantes con precio propio de opciones adicionales.

**Ejemplo de hamburguesa:** sencilla $6,50 o doble $9,50; pan tradicional incluido o brioche +$1; tocineta +$2; queso extra +$1; sin cebolla sin recargo.

Cada grupo define nombre, selección única o múltiple, mínimo y máximo de selecciones, opciones disponibles y recargos. Cada opción define si admite cantidad y su límite. El dueño puede pausar una variante u opción sin desactivar el producto completo.

Los combos requieren grupos obligatorios, por ejemplo elegir bebida y acompañante. En la primera versión, el combo es un producto con grupos de selección; no implica control automático de inventario de sus componentes.

El cliente ve el total antes de agregar. El servidor valida que variante y opciones pertenecen al producto y restaurante, están activas y cumplen mínimos y máximos. Calcula precios a partir de datos vigentes, nunca de importes enviados por el navegador.

Dos unidades con configuraciones diferentes generan líneas distintas. Un pedido guarda una copia de nombre, variante, opciones, cantidades y precios al comprar, para conservar su historial aunque cambie el menú. Si cambia el precio durante la compra, solicitar que el cliente revise el total antes de confirmar.

## 6. Roles y permisos

| Rol | Acceso |
|---|---|
| Administrador de plataforma | Restaurantes, planes, suscripciones, dominios y auditoría |
| Dueño | Configuración y operación de su restaurante, incluido equipo |
| Atención | Pedidos y datos necesarios para gestionar entrega y pago |
| Cocina | Productos, cantidades, opciones y estado de preparación; sin acceso a suscripciones ni datos de clientes innecesarios |
| Comprador invitado | Menú público, creación de pedido y seguimiento de su pedido mediante enlace privado |

La pertenencia de usuarios a restaurantes se guarda en una tabla de miembros con roles. Un usuario puede pertenecer a varios negocios, pero debe elegir el negocio activo y conservar permisos separados.

## 7. Arquitectura propuesta

| Componente | Elección |
|---|---|
| Interfaz y servidor | Next.js, React y TypeScript |
| Estilos y componentes | Tailwind CSS y componentes accesibles, con identidad propia |
| Validación | Esquemas compartidos y validación autoritativa en servidor |
| Datos | PostgreSQL de Supabase |
| Usuarios | Supabase Auth |
| Fotografías | Supabase Storage |
| Actualización de pedidos | Supabase Realtime, con recuperación por consulta |
| Alojamiento | Railway |
| Código y cambios | Repositorio privado GitHub |
| Desarrollo asistido | Claude Code |

Fijar versiones estables compatibles al iniciar y guardar archivo de dependencias bloqueadas. No instalar indiscriminadamente versiones experimentales.

Mantener lógica de pedidos, precios, permisos y dominios en módulos de servidor. Las claves administrativas de Supabase y Railway nunca se envían al navegador ni se guardan en GitHub.

## 8. Modelo de datos inicial

Nombres orientativos; Claude Code deberá convertirlos en migraciones, restricciones e índices.

| Entidad | Contenido |
|---|---|
| restaurants | Nombre, slug único, moneda, zona horaria, estado y configuración de marca |
| restaurant_members | Usuario, restaurante, rol y estado |
| restaurant_domains | Host único normalizado, negocio, tipo y estado de verificación |
| categories | Categorías y orden |
| products / product_images | Producto, descripción, precios, fotografías, orden y disponibilidad |
| product_variants | Variante, precio propio y disponibilidad |
| option_groups / product_option_groups | Grupos reutilizables y reglas de selección por producto |
| options | Opción, recargo, disponibilidad y reglas de cantidad |
| business_hours / delivery_zones | Horarios, excepciones y zonas de entrega |
| payment_methods | Instrucciones y medios habilitados |
| customers | Contacto e historial por negocio |
| orders / order_items / order_item_options | Pedido y copias históricas de precios y selecciones |
| order_status_events | Transiciones, fecha y responsable |
| plans / subscriptions / subscription_payments | Plan, vigencia y pagos de la suscripción |
| audit_events | Acciones administrativas importantes |

Las entidades de negocio deben incluir `restaurant_id`. Las relaciones deben impedir vincular registros de distintos restaurantes mediante claves y restricciones consistentes, además de RLS. Representar dinero mediante unidades menores enteras o un tipo decimal exacto, nunca mediante coma flotante para cálculos financieros.

Para pedidos de invitados, usar un endpoint de servidor con validación y protección contra abuso; no habilitar lectura ni escritura anónima general de las tablas de pedidos y clientes.

## 9. Seguridad y fiabilidad indispensables

- RLS y permisos en todas las tablas de negocio y archivos privados; lectura pública limitada al menú publicado.
- Probar aislamiento tanto de lectura como de escritura entre dos restaurantes distintos.
- Calcular total y delivery en servidor; comprobar horario y disponibilidad al confirmar.
- Crear pedido y líneas dentro de una transacción. Clave de idempotencia para evitar duplicados al reintentar o hacer doble clic.
- Validar transiciones y permisos de estado; registrar autor y momento.
- No guardar secretos en código, archivos de muestra ni registros de errores.
- Separar pruebas y producción, incluidas base de datos y credenciales.
- Política de respaldo y restauración comprobada para base de datos e imágenes.
- Validar tipos, tamaño y permisos de carga de fotografías.
- Registro de errores que permita diagnosticar fallos sin mostrar datos sensibles.
- Proteger creación de pedidos y accesos frente a abuso mediante límites de solicitudes y validaciones.
- No cachear ni compartir respuestas privadas entre negocios. Claves de caché públicas incluyen restaurante y estado de publicación.

## 10. Subdominios y dominios propios

Configurar DNS comodín para los subdominios de la plataforma, enrutamiento y HTTPS. Verificar soporte y límites vigentes de Railway al implementar.

La aplicación normaliza el host, lo busca en una lista de dominios verificados y resuelve el restaurante. Hosts desconocidos no acceden a otro negocio ni reciben datos de un restaurante por defecto.

Para dominio propio: propietario solicita conexión → dominio pendiente → instrucciones DNS → verificación de propiedad y enrutamiento → HTTPS disponible → activación. Guardar estados pendientes, activos y fallidos. Automatización mediante API de Railway en servidor, sin prometer activación inmediata ni dominios ilimitados.

Un dominio solo puede pertenecer a un restaurante. Controlar cambios, bajas y reclamaciones, y retirar el vínculo al desconectar. Si el negocio ya usa su dominio para otra web, recomendar un subdominio de pedidos. Definir una dirección principal y redirecciones para evitar contenido duplicado.

## 11. Fases y entregables

**Plan orientativo: 6–8 semanas para una versión piloto**, sujeto a disponibilidad de trabajo, validaciones, integraciones y cambios de alcance. La asistencia de Claude Code no sustituye pruebas ni revisión.

| Fase | Resultado verificable |
|---|---|
| 1. Base y diseño | Repositorio, estructura, guía visual, pantallas públicas y privadas responsivas con datos de prueba |
| 2. Negocios y seguridad | Migraciones, autenticación, roles, alta de negocios y aislamiento demostrado entre dos restaurantes |
| 3. Menú y variaciones | CRUD completo, imágenes, opciones obligatorias, variantes, promociones y carrito personalizado |
| 4. Pedidos y operación | Confirmación transaccional, entrega, pagos manuales, estados, cocina, seguimiento y resumen WhatsApp |
| 5. Administración y dominios | Planes, suscripciones manuales, alta del dueño, subdominios y conexión de un dominio de prueba |
| 6. Piloto y publicación | Pruebas, correcciones, restauración de respaldo, despliegue y documentación de operación |

Cada fase termina con una demostración funcional y validación de criterios antes de ampliar el alcance. Las migraciones deben estar versionadas en GitHub, evitando SQL manual sin registrar.

## 12. Criterios de aceptación del piloto

1. Dos restaurantes con sus menús y marcas independientes en dos subdominios.
2. Un dominio propio verificado abre el negocio correcto; host desconocido no filtra datos.
3. Dueño A no puede leer ni modificar datos del negocio B, incluso manipulando solicitudes.
4. Producto con variante, grupo obligatorio, extras múltiples y cantidades calcula el total correctamente.
5. No permite agregar opciones incompatibles o incumplir las restricciones.
6. Dos configuraciones distintas del mismo producto permanecen separadas en carrito y pedido.
7. Reintentar la compra con la misma clave no duplica el pedido.
8. Cocina recibe las opciones exactas y cambios de estado permitidos.
9. Un cambio posterior del menú no modifica pedidos históricos.
10. Total del servidor coincide con la selección y tarifa de entrega; manipular precios del navegador no altera el total.
11. Pago pendiente y pedido aceptado se distinguen claramente.
12. Menú y paneles funcionan a 360 px y en escritorio sin perder acciones esenciales.
13. CRUD persiste tras recargar y muestra errores accionables si falla.
14. Despliegue reproducible y recuperación de datos probada.

## 13. Funciones posteriores

Cobro automático de suscripciones, integración de pagos online, cuentas de compradores, cupones avanzados, fidelización, campañas, IA para atención, integración oficial de WhatsApp, inventario por ingredientes, cocina por estaciones, múltiples sucursales, asignación de repartidores y conexión con otras plataformas.

Estas funciones requieren alcance y pruebas propios; no deben añadirse automáticamente a la primera versión.

## 14. Costos y operación comercial

Railway, Supabase, dominio y herramientas de desarrollo son costos de operación de la plataforma. A medida que crezca, revisar consumo, almacenamiento, tráfico, respaldo y soporte. Claude Code es un costo de desarrollo; añadir IA a la operación requeriría una integración y un presupuesto de consumo aparte.

No se fijan tarifas actuales de proveedores ni precio final del desarrollo en este documento. Cotizarlos con sus páginas oficiales antes de contratar. El modelo comercial propuesto es configuración inicial + mensualidad, con dominio y servicios de marketing delimitados por separado.

Antes del piloto definir: nombre comercial, dominio principal, país y moneda inicial, horario de soporte y política de datos. Para el desarrollo se asume operación inicial en Venezuela, español y USD; permitir configurar moneda y zona horaria por negocio. Conversión a bolívares y tasa BCV requieren una especificación adicional: no incluir una tasa fija silenciosa.

## 15. Instrucción inicial para Claude Code

Copia este bloque al iniciar una sesión y adjunta este documento y la captura de referencia:

> Actúa como desarrollador full stack senior. Implementa la plataforma de restaurantes descrita en este documento con Next.js, React, TypeScript, Supabase y despliegue en Railway. Trabaja en el repositorio del proyecto y respeta cualquier trabajo existente.
>
> Primero inspecciona el repositorio y presenta brevemente la arquitectura, dependencias, modelo de datos y plan por fases. Si el repositorio está vacío, crea una base nueva. Registra decisiones, comandos y progreso en documentación del proyecto. Usa un CLAUDE.md para las reglas estables del proyecto; este documento es la especificación funcional.
>
> Comienza por la fase 1 y continúa secuencialmente con las siguientes fases dentro del alcance autorizado. Haz cambios pequeños y verificables; no intentes resolver todo con una sola generación. Marca los datos de demostración y separa su uso de producción. No presentes pantallas simuladas como funciones conectadas.
>
> Mantén diseño minimalista, paneles morados y menús con marca configurable. Incluye variantes y extras desde el modelo inicial. Aplica aislamiento multiempresa en base de datos, almacenamiento, consultas y caché. Calcula precios y valida pedidos en servidor, con transacciones e idempotencia.
>
> Implementa operaciones reales de crear, editar, archivar, guardar y consultar; comprueba persistencia tras recargar. No ocultes errores con catch vacíos. No inventes credenciales ni pongas claves administrativas en el cliente. Usa .env.example con nombres de variables y valores vacíos.
>
> Si faltan credenciales, completa las tareas independientes, documenta lo bloqueado y solicita únicamente los datos necesarios. No declares realizada una integración sin verificarla. No publiques ni ejecutes migraciones destructivas en producción sin autorización específica.
>
> Al terminar cada fase, entrega cambios, validaciones ejecutadas, resultado, pendientes y siguiente paso. Las pruebas prioritarias cubren permisos entre restaurantes, precios, variantes, pedidos duplicados y persistencia. Mantén migraciones y decisiones versionadas en GitHub.

## Referencias técnicas para verificar durante el desarrollo

- Railway y Next.js: https://docs.railway.com/guides/nextjs
- Railway y dominios: https://docs.railway.com/networking/domains/working-with-domains
- API de dominios: https://docs.railway.com/integrations/api/manage-domains
- Supabase y RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Storage: https://supabase.com/docs/guides/storage
- Claude Code: https://code.claude.com/docs/en/overview

## 16. Página comercial de Mesa

Referencia de organización: https://wuplify.com/. Crear una página original con identidad morada que presente el producto, muestre una demostración, explique funciones y proceso, y reserve una sección para planes. No copiar marca, textos ni activos del proveedor.

En fase inicial, explicar que el producto está en desarrollo. No publicar precios definitivos, testimonios, volumen de restaurantes ni resultados no verificados. Los botones principales llevan a la demostración hasta definir el canal comercial. Funciones descritas como alcance deben distinguirse de las ya operativas.
