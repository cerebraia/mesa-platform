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
