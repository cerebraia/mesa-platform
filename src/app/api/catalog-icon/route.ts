import { type NextRequest, NextResponse } from "next/server";
import { createServerClient as createSsrClient } from "@supabase/ssr";
import sharp from "sharp";

// ── Wacatalog fallback favicon (SVG → PNG) ────────────────────
// Inline SVG of the "W" isotipo — matches the Brand component.
// Rendered as 32×32 and 180×180 PNG without any external fetch.

const WACATALOG_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <rect width="64" height="64" rx="12" fill="#703BE6"/>
  <text x="32" y="46" font-family="Arial,Helvetica,sans-serif"
        font-size="40" font-weight="bold" text-anchor="middle" fill="white">W</text>
</svg>
`.trim();

async function wacatalogPng(size: number): Promise<ArrayBuffer> {
  const buf = await sharp(Buffer.from(WACATALOG_SVG))
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

// ── Anon Supabase client (no session) ────────────────────────
function anonClient() {
  return createSsrClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );
}

// ── Logo path validation ──────────────────────────────────────
// Only accept paths that look like storage paths (no ../, no scheme).
// The path must be a simple relative path within the bucket.
function isSafeStoragePath(path: string): boolean {
  if (!path) return false;
  // Must not contain .. or start with / or contain a scheme
  if (path.includes("..") || path.startsWith("/") || /^[a-z]+:/.test(path)) return false;
  // Allow: UUID-like segments, slashes, dots, hyphens, alphanumeric
  return /^[a-zA-Z0-9/_\-\.]+$/.test(path);
}

// ── Image processing ──────────────────────────────────────────
// Resize the logo to a square PNG. The logo is placed inside the square
// with "contain" fit (no cropping, preserves aspect ratio, transparent bg).

async function logoToPng(imageData: ArrayBuffer, size: number): Promise<ArrayBuffer | null> {
  try {
    const buf = Buffer.from(imageData);
    const outBuf = await sharp(buf)
      .resize(size, size, {
        fit:        "contain",
        background: { r: 255, g: 255, b: 255, alpha: 0 }, // transparent padding
        withoutEnlargement: false,
      })
      .flatten({ background: { r: 255, g: 255, b: 255 } }) // white bg for JPEG logos
      .png()
      .toBuffer();
    return outBuf.buffer.slice(outBuf.byteOffset, outBuf.byteOffset + outBuf.byteLength) as ArrayBuffer;
  } catch {
    return null;
  }
}

// ── GET /api/catalog-icon ─────────────────────────────────────
//
// Query params:
//   id   — restaurantId (UUID). Takes priority over slug.
//   slug — restaurant slug (alternative to id, used by favicon.ico redirect).
//   v    — cache buster (stable hash of logo_path). Absent = short cache.
//   sz   — size in px (32 or 180). Default: 32.
//
// Cache behaviour:
//   With v → 30-day immutable cache (v changes when logo changes).
//   Without v → 1-hour cache.
//
// Security:
//   - restaurantId must be a valid UUID; slug alphanumeric + hyphens.
//   - logo_path fetched from DB, never from a URL param (prevents SSRF).
//   - Fetch only from the known Supabase Storage origin.
//   - Invalid/missing logo → Wacatalog fallback PNG silently.

export async function GET(request: NextRequest): Promise<NextResponse> {
  const sp   = request.nextUrl.searchParams;
  const id   = sp.get("id")   ?? "";
  const slug = sp.get("slug") ?? "";
  const sz   = parseInt(sp.get("sz") ?? "32", 10);
  const size = sz === 180 ? 180 : 32;

  const pngHeaders = (maxAge: number) => ({
    "Content-Type": "image/png",
    "Cache-Control": `public, max-age=${maxAge}, stale-while-revalidate=86400`,
    "X-Content-Type-Options": "nosniff",
  });

  const isValidUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(s);
  const isValidSlug = (s: string) => /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(s);

  const hasId   = isValidUuid(id);
  const hasSlug = !hasId && isValidSlug(slug);

  // ── No valid id or slug → Wacatalog favicon ───────────────────
  if (!hasId && !hasSlug) {
    const png = await wacatalogPng(size);
    return new NextResponse(png, { headers: pngHeaders(3600) });
  }

  // ── Fetch logo_path from DB (anon can read public columns) ───
  const db = anonClient();

  let logoPath: string | null = null;
  let restaurantId = id;

  if (hasId) {
    const { data: cfg } = await db
      .from("restaurant_config")
      .select("logo_path")
      .eq("restaurant_id", id)
      .maybeSingle();
    logoPath = cfg?.logo_path ?? null;
  } else {
    // Look up by slug — join restaurants → restaurant_config
    const { data: row } = await db
      .from("restaurants")
      .select("id, restaurant_config(logo_path)")
      .eq("slug", slug)
      .eq("status", "active")
      .is("deleted_at", null)
      .maybeSingle<{ id: string; restaurant_config: { logo_path: string | null } | null }>();
    restaurantId = row?.id ?? "";
    logoPath = row?.restaurant_config?.logo_path ?? null;
  }

  const _ = restaurantId; // suppress unused warning

  if (!logoPath || !isSafeStoragePath(logoPath)) {
    const png = await wacatalogPng(size);
    return new NextResponse(png, { headers: pngHeaders(3600) });
  }

  // ── Fetch image from Supabase Storage (public bucket) ───────
  // Only the known Supabase URL — no user-supplied URLs.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const imageUrl = `${supabaseUrl}/storage/v1/object/public/restaurant-assets/${logoPath}`;

  let imageData: ArrayBuffer;
  try {
    const res = await fetch(imageUrl, { next: { revalidate: 3600 } });
    if (!res.ok) throw new Error(`Storage ${res.status}`);
    imageData = await res.arrayBuffer();
  } catch {
    const png = await wacatalogPng(size);
    return new NextResponse(png, { headers: pngHeaders(60) });
  }

  // ── Resize to square PNG ──────────────────────────────────────
  const png = await logoToPng(imageData, size);
  if (!png) {
    const fallback = await wacatalogPng(size);
    return new NextResponse(fallback, { headers: pngHeaders(60) });
  }

  // Cache for 30 days when caller includes the version param (v=…).
  // Without v, cache for 1 hour so stale logos don't linger too long.
  const hasVersion = sp.has("v") && sp.get("v") !== "";
  return new NextResponse(png, {
    headers: pngHeaders(hasVersion ? 30 * 24 * 3600 : 3600),
  });
}
