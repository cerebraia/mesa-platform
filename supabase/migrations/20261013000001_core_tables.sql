-- ============================================================
-- Mesa Platform · Migración 001 — Tablas base multiempresa
-- ============================================================
-- Entidades: restaurants, restaurant_members, platform_admins,
--            restaurant_domains.
--
-- Decisiones de modelo:
--
-- 1. restaurants.slug: identifica el subdominio de plataforma.
--    Solo minúsculas, dígitos y guiones; mínimo 3, máximo 63 chars.
--    Unique index garantiza que no haya dos negocios con el mismo slug.
--
-- 2. restaurant_members.role: 'owner', 'attention' o 'kitchen'.
--    platform_admin es un permiso de plataforma (tabla separada),
--    nunca un valor de esta columna. Esto impide que cualquier usuario
--    se lo asigne a sí mismo al registrarse.
--
-- 3. UNIQUE(restaurant_id, user_id) en restaurant_members impide
--    dobles membresías. Un usuario con dos roles en un restaurante
--    requeriría ampliar el modelo; por ahora un usuario tiene un
--    rol único por restaurante.
--
-- 4. platform_admins.created_by: auditoría del origen de la asignación.
--    NULL en el primer admin (se crea mediante operación privilegiada).
--    ON DELETE SET NULL conserva el registro cuando el creador es dado de baja.
--
-- 5. restaurant_domains.host: siempre normalizado en minúsculas.
--    La restricción de formato lo verifica. Un host pertenece a
--    exactamente un restaurante (UNIQUE). 'verified' solo puede
--    activarse mediante una operación administrativa (ver RLS).
--
-- 6. Dinero: estas tablas no almacenan importes todavía. Las tablas
--    de productos y pedidos (fase 3) usarán centavos como integer.
-- ============================================================

-- ── restaurants ──────────────────────────────────────────────
CREATE TABLE restaurants (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL
             CHECK (char_length(name) BETWEEN 2 AND 100),
  slug       text        NOT NULL
             CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$'),
  currency   text        NOT NULL DEFAULT 'USD'
             CHECK (char_length(currency) = 3),
  timezone   text        NOT NULL DEFAULT 'America/Caracas',
  status     text        NOT NULL DEFAULT 'onboarding'
             CHECK (status IN ('onboarding', 'active', 'suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT restaurants_slug_unique UNIQUE (slug)
);

-- restaurants_slug_idx omitido: UNIQUE ya crea el índice B-tree sobre slug.
CREATE INDEX restaurants_status_idx ON restaurants (status);

-- ── restaurant_members ───────────────────────────────────────
-- ON DELETE CASCADE: eliminar el restaurante elimina sus membresías.
-- ON DELETE CASCADE en user_id: eliminar un usuario de Auth
--   elimina sus membresías (sin huérfanos).
CREATE TABLE restaurant_members (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid        NOT NULL
                REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id       uuid        NOT NULL
                REFERENCES auth.users(id) ON DELETE CASCADE,
  role          text        NOT NULL
                CHECK (role IN ('owner', 'attention', 'kitchen')),
  status        text        NOT NULL DEFAULT 'invited'
                CHECK (status IN ('invited', 'active', 'suspended')),
  created_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT restaurant_members_unique UNIQUE (restaurant_id, user_id)
);

CREATE INDEX restaurant_members_user_idx       ON restaurant_members (user_id);
CREATE INDEX restaurant_members_restaurant_idx ON restaurant_members (restaurant_id);
-- Índice parcial para búsquedas frecuentes de miembros activos por restaurante.
CREATE INDEX restaurant_members_active_idx     ON restaurant_members (restaurant_id)
  WHERE status = 'active';

-- ── platform_admins ──────────────────────────────────────────
-- Tabla separada de restaurant_members para que ningún usuario
-- pueda asignarse permisos de plataforma mediante una operación
-- ordinaria de registro o membresía.
-- El primer admin se inserta mediante service_role (ver ESTADO.md).
CREATE TABLE platform_admins (
  user_id    uuid        PRIMARY KEY
             REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- NULL en el primer admin (no hay nadie que lo haya creado antes).
  created_by uuid        REFERENCES auth.users(id) ON DELETE SET NULL
);

-- ── restaurant_domains ───────────────────────────────────────
-- 'host' almacenado en minúsculas, sin barra final, sin doble punto.
-- La restricción de formato es informativa; la normalización real
-- debe hacerse en la capa de aplicación antes de insertar.
CREATE TABLE restaurant_domains (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  host          text        NOT NULL,
  restaurant_id uuid        NOT NULL
                REFERENCES restaurants(id) ON DELETE CASCADE,
  kind          text        NOT NULL
                CHECK (kind IN ('platform_subdomain', 'custom')),
  verified      boolean     NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT restaurant_domains_host_unique  UNIQUE (host),
  CONSTRAINT restaurant_domains_host_format  CHECK (
    host = lower(host)
    AND host NOT LIKE '%..%'
    AND char_length(host) BETWEEN 4 AND 253
    AND host ~ '^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$'
  )
);

CREATE INDEX restaurant_domains_restaurant_idx ON restaurant_domains (restaurant_id);
-- Índice parcial: las búsquedas de enrutamiento solo consultan dominios verificados.
CREATE INDEX restaurant_domains_verified_idx   ON restaurant_domains (verified)
  WHERE verified = true;
