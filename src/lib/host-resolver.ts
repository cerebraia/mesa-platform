// Host resolution utilities for multi-tenant routing.
//
// Trust model:
//   - We read the `Host` request header, NOT X-Forwarded-Host.
//   - Railway sets the Host header correctly at the edge.
//   - X-Forwarded-Host is not trusted unless explicitly verified
//     via a reverse proxy you control.
//
// Platform hosts are configured via env vars:
//   NEXT_PUBLIC_PLATFORM_HOST  — main commercial site (e.g. mesa.app)
//   NEXT_PUBLIC_APP_HOST       — panel/admin host (defaults to PLATFORM_HOST)
//   PLATFORM_SUBDOMAIN_BASE    — base for restaurant subdomains (e.g. mesa.app
//                                → restaurante-alfa.mesa.app)
//                                Optional. If unset, subdomains are not parsed.
//
// Reserved subdomains that can never be a restaurant slug:
//   www, app, admin, api, mail, smtp, ftp, cdn, static, assets, media,
//   panel, auth, dashboard, help, status, blog, docs

export const RESERVED_SUBDOMAINS = new Set([
  "www", "app", "admin", "api", "mail", "smtp", "ftp",
  "cdn", "static", "assets", "media", "panel", "auth",
  "dashboard", "help", "status", "blog", "docs",
]);

// Slug-compatible pattern: lowercase letters, digits, hyphens.
// Matches the CHECK constraint on restaurants.slug.
// Exported so tests can verify the same pattern without duplicating it.
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;

/**
 * Normalise an incoming Host header value.
 * - Converts to lowercase.
 * - Strips trailing dot (FQDN notation).
 * - Strips port number (e.g. localhost:3000 → localhost).
 * Returns an empty string if the input is clearly invalid.
 */
export function normalizeHost(raw: string): string {
  if (!raw) return "";
  const lower = raw.toLowerCase().trim();
  // Strip trailing dot
  const noDot = lower.endsWith(".") ? lower.slice(0, -1) : lower;
  // Strip port
  const colonIdx = noDot.lastIndexOf(":");
  if (colonIdx !== -1) {
    const maybePort = noDot.slice(colonIdx + 1);
    if (/^\d+$/.test(maybePort)) {
      return noDot.slice(0, colonIdx);
    }
  }
  return noDot;
}

function isLocalDev(host: string): boolean {
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.startsWith("192.168.") ||
    host.startsWith("10.") ||
    host.startsWith("172.")
  );
}

const PLATFORM_MAIN  = (process.env.NEXT_PUBLIC_PLATFORM_HOST ?? "").toLowerCase().trim();
const PLATFORM_APP   = (process.env.NEXT_PUBLIC_APP_HOST ?? PLATFORM_MAIN).toLowerCase().trim();
const SUBDOMAIN_BASE = (process.env.PLATFORM_SUBDOMAIN_BASE ?? "").toLowerCase().trim();

const PLATFORM_HOST_SET = new Set([PLATFORM_MAIN, PLATFORM_APP].filter(Boolean));

/**
 * Returns true if the host belongs to the central platform
 * (commercial site + panel + admin). These requests are served
 * by the normal Next.js routing pipeline.
 */
export function isPlatformHost(host: string): boolean {
  if (isLocalDev(host)) return true;
  if (PLATFORM_HOST_SET.has(host)) return true;
  return false;
}

/**
 * Pure, testable core of extractPlatformSubdomain.
 * Given an already-normalised host and an explicit base (e.g. "mesa.app"),
 * returns the subdomain slug if it is valid and non-reserved, or null.
 *
 * Invariants checked:
 *   - host ends with exactly ".<base>" (not multi-level: "a.b.BASE" → null)
 *   - subdomain is a single DNS label (no dots)
 *   - subdomain is not in RESERVED_SUBDOMAINS
 *   - subdomain matches SLUG_RE
 */
export function extractPlatformSubdomainFor(host: string, base: string): string | null {
  if (!base) return null;
  const suffix = `.${base}`;
  if (!host.endsWith(suffix)) return null;
  const sub = host.slice(0, host.length - suffix.length);
  // Must be a single DNS label (no dots)
  if (sub.includes(".")) return null;
  if (RESERVED_SUBDOMAINS.has(sub)) return null;
  if (!SLUG_RE.test(sub)) return null;
  return sub;
}

/**
 * If the host is a platform subdomain (e.g. slug.mesa.app), returns
 * the subdomain part if it looks like a valid, non-reserved restaurant slug.
 * Returns null otherwise.
 *
 * Requires PLATFORM_SUBDOMAIN_BASE to be set.
 */
export function extractPlatformSubdomain(host: string): string | null {
  return extractPlatformSubdomainFor(host, SUBDOMAIN_BASE);
}

/**
 * Returns true if `host` could be a restaurant's custom domain
 * (not a platform host, not local dev).
 * Only meaningful when isPlatformHost returns false.
 */
export function couldBeRestaurantDomain(host: string): boolean {
  if (!host) return false;
  if (isLocalDev(host)) return false;
  if (PLATFORM_HOST_SET.has(host)) return false;
  // Basic validity: at least two DNS labels
  const parts = host.split(".");
  return parts.length >= 2 && parts.every((p) => p.length > 0);
}

// ── Restaurant path routing ────────────────────────────────────────────────────
//
// Pure function that decides what to do with an incoming path on a restaurant
// domain or subdomain.  Returns a discriminated union so proxy.ts and tests can
// act on the decision without coupling to NextResponse.

export type RestaurantAction =
  | { kind: "rewrite";            to: string }
  | { kind: "api-passthrough" }
  | { kind: "static-passthrough" }
  | { kind: "redirect";           to: string }
  | { kind: "not-found" };

/**
 * Given a URL `pathname` and a restaurant `slug`, returns the action the proxy
 * should take.  No side-effects; safe to call in tests without Edge Runtime.
 *
 * Rules (in priority order):
 *   /api/*            → api-passthrough  (route handler adds x-mesa-restaurant-slug)
 *   /_next/* /favicon /images → static-passthrough
 *   / or ""           → rewrite to /r/<slug>
 *   /pedido …         → rewrite to /r/<slug>/pedido…
 *   /r/<slug>/*       → redirect to clean path (301 for bookmarks)
 *   anything else     → not-found
 */
export function resolveRestaurantPath(
  pathname: string,
  slug: string,
): RestaurantAction {
  if (pathname.startsWith("/api/")) {
    return { kind: "api-passthrough" };
  }

  if (
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/images/")
  ) {
    return { kind: "static-passthrough" };
  }

  if (pathname === "/" || pathname === "") {
    return { kind: "rewrite", to: `/r/${slug}` };
  }

  if (
    pathname === "/pedido" ||
    pathname === "/pedido/" ||
    pathname.startsWith("/pedido/")
  ) {
    const subpath =
      pathname === "/pedido" || pathname === "/pedido/"
        ? ""
        : pathname.slice("/pedido".length);
    return { kind: "rewrite", to: `/r/${slug}/pedido${subpath}` };
  }

  // Old /r/<slug>/* bookmarks → redirect to clean URL on same domain
  if (pathname.startsWith(`/r/${slug}`)) {
    const remainder = pathname.slice(`/r/${slug}`.length) || "/";
    return { kind: "redirect", to: remainder };
  }

  return { kind: "not-found" };
}
