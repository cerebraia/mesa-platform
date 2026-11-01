# Mesa Platform

Lee README.md, docs/PROPUESTA.md y docs/ESTADO.md antes de desarrollar.

## Producto
SaaS de menús y pedidos multiempresa, con sitio comercial propio, menús por negocio, panel de restaurante y administración general. Marca provisional Mesa, morado #703BE6. Referencias funcionales: Wuplify y La Tentación; identidad y código propios.

## Estado
Base Next.js + React + TypeScript. Solo demostración con datos locales. Sin autenticación, Supabase, dominios ni pedidos reales. Las rutas /demo son públicas intencionalmente y no deben reutilizarse como paneles reales protegidos.

## Reglas
- No presentar datos de prueba como integración real.
- Próximo trabajo: fase 2, migraciones, Auth y RLS verificadas entre dos negocios.
- No usar las credenciales de otros proyectos del usuario.
- Cada entidad de negocio lleva restaurant_id; validar pertenencia en relaciones, consultas, RLS, Storage y caché.
- Dinero en centavos, validar precios y pedidos en servidor. src/lib/pricing.ts es lógica compartida pero todavía no existe endpoint de compra.
- Variantes y grupos de opciones con mínimos/máximos desde el modelo inicial.
- Pedidos transaccionales e idempotentes.
- Secretos solo en variables de servidor. Nunca claves privadas NEXT_PUBLIC_.
- No catch vacíos; mostrar errores accionables.
- Antes de publicar, comprobar producción separada, roles y aislamiento.
- No ejecutar migraciones destructivas en producción sin autorización específica.
- Cada fase termina con comprobaciones y actualización de docs/ESTADO.md.

## Comandos
npm ci; npm run dev; npm run typecheck; npm test; npm run build.

## Diseño
Menú compacto horizontal con fotos reales aportadas por el usuario. Marcadores de fotografía son temporales. No crear testimonios, métricas o precios comerciales ficticios en la página principal. Funciones de prueba deben estar etiquetadas.

## Responsive — requisito permanente
Todo hito que afecte la interfaz debe verificarse en estos puntos de corte antes de darse por terminado:

- **360 y 390 px** (móvil estrecho): sin scroll horizontal de página, todas las acciones alcanzables con el pulgar.
- **768 px** (tablet): columnas reducidas, navegación lateral colapsada.
- **1280 px o superior** (escritorio): diseño completo.

Reglas generales:
- Áreas táctiles mínimas de **44 × 44 px** (botones, enlaces, tabs).
- Ninguna información ni acción debe quedar fuera del ancho visible; no usar `overflow-x:hidden` en el body para ocultar desbordamientos.
- Nombres largos, estados vacíos, de carga y de error deben probarse con datos reales o ficticios representativos.
- Las tablas de escritorio deben tener una vista alternativa en tarjetas/lista para ≤ 760 px.
- Si no hay navegador disponible, indicar explícitamente que la revisión visual queda pendiente; typecheck y build no demuestran que el responsive esté correcto.
