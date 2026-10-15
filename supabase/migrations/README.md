# Migraciones

Migraciones versionadas para Mesa Platform. Aplicar en orden con Supabase CLI.

## Fase 2 — Base multiempresa

| Archivo | Contenido |
|---|---|
| `20261013000001_core_tables.sql` | Tablas: restaurants, restaurant_members, platform_admins, restaurant_domains + índices y restricciones |
| `20261013000002_functions.sql` | Funciones SECURITY DEFINER: set_updated_at, is_platform_admin, is_active_member, member_role |
| `20261013000003_rls.sql` | RLS habilitado + políticas por tabla + GRANTs a authenticated |

## Cómo aplicar localmente

```bash
# Prerequisitos: Docker + Supabase CLI
brew install supabase/tap/supabase   # macOS
supabase start                        # inicia la pila local
supabase db reset                     # aplica migraciones desde cero
```

## Procedimiento para asignar el primer administrador de plataforma

El primer platform_admin no puede insertarse mediante una operación autenticada
(no hay platform_admin previo que autorice el INSERT). Usar el cliente con
service_role, que omite RLS:

```sql
-- Ejecutar con la clave service_role o directamente en el SQL editor de Supabase.
-- Sustituir <uuid-del-admin> por el UUID real del usuario en auth.users.
INSERT INTO platform_admins (user_id, created_by)
VALUES ('<uuid-del-admin>', NULL);
```

O desde código de servidor:
```ts
// En un script de inicialización con SUPABASE_SERVICE_ROLE_KEY.
const { error } = await supabase
  .from('platform_admins')
  .insert({ user_id: '<uuid-del-admin>', created_by: null });
```

## Normas

- No ejecutar SQL manual en producción sin registrar el cambio como migración.
- No aplicar migraciones destructivas (DROP, truncado) sin autorización específica.
- Cada fase termina con pruebas de aislamiento ejecutadas y documentadas en ESTADO.md.
