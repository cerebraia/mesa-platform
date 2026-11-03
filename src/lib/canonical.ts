// Canonical URL helpers for restaurant catalog pages.
//
// Priority for the canonical URL of a restaurant:
//   1. Active custom domain (status='active' in restaurant_domains).
//   2. Platform subdomain, if PLATFORM_SUBDOMAIN_BASE is configured.
//   3. Platform path  ${SITE_URL}/r/[slug]   (always available).
//
// Trust model:
//   - We NEVER derive the canonical from the incoming request Host header
//     because the same catalog is served under multiple hostnames.
//   - We use environment variables and verified DB data only.
//   - In development (no SITE_URL set), functions return relative paths
//     so we never generate fictitious production domains.

/** Base URL of the platform (no trailing slash). */
export function getPlatformBase(): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) return siteUrl.replace(/\/$/, "");

  const platformHost = process.env.NEXT_PUBLIC_PLATFORM_HOST;
  if (platformHost) return `https://${platformHost}`;

  // Local development — callers should guard against empty string before
  // using this as an absolute URL in metadata.
  return "";
}

/** Absolute canonical URL for a restaurant catalog page. */
export function getRestaurantCanonical(
  slug: string,
  /** Active custom domain host (e.g. "mirestaurante.com"), if any. */
  activeDomain?: string | null,
): string {
  if (activeDomain) {
    return `https://${activeDomain}/`;
  }

  const subdomainBase = process.env.PLATFORM_SUBDOMAIN_BASE;
  if (subdomainBase) {
    return `https://${slug}.${subdomainBase}/`;
  }

  const base = getPlatformBase();
  if (base) return `${base}/r/${slug}`;

  return `/r/${slug}`;
}

/**
 * Resolves the active custom domain for a restaurant from an already-loaded
 * list of domain rows (avoids an extra DB round-trip).
 * Returns null when there is no active custom domain.
 */
export function getActiveDomainFromRows(
  domains: Array<{ host: string; kind: string; status: string }> | null | undefined,
): string | null {
  if (!domains) return null;
  const active = domains.find((d) => d.kind === "custom" && d.status === "active");
  return active?.host ?? null;
}
