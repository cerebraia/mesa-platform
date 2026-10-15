// Next.js 16 proxy entry point: session management + hostname-based routing.
//
// In Next.js 16, this file ("proxy.ts") replaces the traditional "middleware.ts".
// The exported `proxy` function is the handler; `config.matcher` controls which
// paths are processed.
//
// Host resolution order:
//   1. Platform host (NEXT_PUBLIC_PLATFORM_HOST / NEXT_PUBLIC_APP_HOST /
//      localhost) → normal routing (landing, /r/[slug], /panel, /admin).
//   2. Platform subdomain (slug.PLATFORM_SUBDOMAIN_BASE, if configured)
//      → internal rewrite to /r/[slug].  Slug must be non-reserved, valid.
//   3. Custom restaurant domain (DB lookup via get_restaurant_slug_by_host RPC)
//      → internal rewrite to /r/[slug].
//   4. Unknown host → controlled 404 (no data leakage).
//
// Security notes:
//   - Only the Host header is read; X-Forwarded-Host is NOT trusted.
//   - /panel, /admin and /login are never served on restaurant domains.
//   - The x-mesa-restaurant-slug header added to rewrites is set server-side
//     only; downstream routes use it to choose the correct cookie path for
//     custom/subdomain domains. It is NOT a security gate — the restaurant is
//     always validated by restaurant_id in the RPC.

import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import {
  normalizeHost,
  isPlatformHost,
  extractPlatformSubdomain,
  couldBeRestaurantDomain,
  resolveRestaurantPath,
  type RestaurantAction,
} from "./lib/host-resolver";

// ── Session-refresh helper (used for platform-host requests) ──────────────────

async function runSessionProxy(request: NextRequest): Promise<NextResponse> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // If Supabase is not configured, protect private routes with a redirect to /login
  // and pass public routes through. Never crash with 500.
  if (!supabaseUrl || !supabaseKey) {
    const { pathname } = request.nextUrl;
    if (pathname.startsWith("/panel") || pathname.startsWith("/admin")) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    return NextResponse.next({ request });
  }

  // supabaseResponse must be returned (or have its cookies copied) on every
  // branch so that session token refreshes are written back to the browser.
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // getUser() validates the JWT with the GoTrue server; never use getSession()
  // for authorization because it reads from storage without server validation.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPrivate =
    pathname.startsWith("/panel") || pathname.startsWith("/admin");

  if (!user && isPrivate) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const redirect = NextResponse.redirect(url);
    supabaseResponse.cookies
      .getAll()
      .forEach((c) => redirect.cookies.set(c.name, c.value, c));
    return redirect;
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/panel";
    const redirect = NextResponse.redirect(url);
    supabaseResponse.cookies
      .getAll()
      .forEach((c) => redirect.cookies.set(c.name, c.value, c));
    return redirect;
  }

  return supabaseResponse;
}

// ── Restaurant-domain DB lookup ───────────────────────────────────────────────
// Uses the anon key: get_restaurant_slug_by_host is SECURITY DEFINER and only
// returns slugs for active domains/restaurants. No service role needed here.

async function resolveCustomDomain(host: string): Promise<string | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  // If Supabase is not configured, fail safely to 404 instead of 500.
  if (!supabaseUrl || !supabaseKey) return null;
  try {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: { getAll: () => [], setAll: () => {} },
    });
    const { data } = await supabase.rpc("get_restaurant_slug_by_host", {
      p_host: host,
    });
    return typeof data === "string" && data.length > 0 ? data : null;
  } catch {
    return null;
  }
}

// ── Restaurant-domain path routing ────────────────────────────────────────────

function rewriteForRestaurant(
  request: NextRequest,
  targetPath: string,
  slug: string,
): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = targetPath;
  const headers = new Headers(request.headers);
  headers.set("x-mesa-restaurant-slug", slug);
  return NextResponse.rewrite(url, { request: { headers } });
}

function unknownHostResponse(): NextResponse {
  return new NextResponse(
    "<!DOCTYPE html><html lang='es'><head><meta charset='utf-8'>" +
    "<title>No encontrado</title></head>" +
    "<body style='font-family:sans-serif;padding:40px'>" +
    "<h1>Dominio no configurado</h1>" +
    "<p>Este dominio no está asociado a ningún restaurante en Mesa.</p>" +
    "</body></html>",
    { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

// Executes a RestaurantAction (from the pure resolveRestaurantPath) against
// the actual NextRequest, producing a NextResponse.
function executeRestaurantAction(
  request: NextRequest,
  action: RestaurantAction,
  slug: string,
): NextResponse {
  switch (action.kind) {
    case "api-passthrough": {
      const headers = new Headers(request.headers);
      headers.set("x-mesa-restaurant-slug", slug);
      return NextResponse.next({ request: { headers } });
    }
    case "static-passthrough":
      return NextResponse.next();
    case "rewrite":
      return rewriteForRestaurant(request, action.to, slug);
    case "redirect": {
      const url = request.nextUrl.clone();
      url.pathname = action.to;
      return NextResponse.redirect(url, { status: 301 });
    }
    case "not-found":
      return new NextResponse("Not Found", { status: 404 });
  }
}

function routeRestaurantPath(
  request: NextRequest,
  pathname: string,
  slug: string,
): NextResponse {
  const action = resolveRestaurantPath(pathname, slug);
  return executeRestaurantAction(request, action, slug);
}

// ── Main proxy handler ────────────────────────────────────────────────────────

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const rawHost = request.headers.get("host") ?? "";
  const host = normalizeHost(rawHost);
  const { pathname } = request.nextUrl;

  // ── 1. Platform host ──────────────────────────────────────
  if (isPlatformHost(host)) {
    return runSessionProxy(request);
  }

  // ── 2. Restaurant domain — block private routes ───────────
  if (
    pathname.startsWith("/panel") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/demo")
  ) {
    return new NextResponse("Not Found", { status: 404 });
  }

  // ── 3. Platform subdomain (e.g. slug.PLATFORM_SUBDOMAIN_BASE) ─
  // extractPlatformSubdomain validates: non-reserved, single label, SLUG_RE.
  const subdomainSlug = extractPlatformSubdomain(host);
  if (subdomainSlug !== null) {
    return routeRestaurantPath(request, pathname, subdomainSlug);
  }

  // ── 4. Clearly non-restaurant host ────────────────────────
  if (!couldBeRestaurantDomain(host)) {
    return unknownHostResponse();
  }

  // ── 5. Custom restaurant domain — DB lookup ───────────────
  const slug = await resolveCustomDomain(host);
  if (!slug) {
    return unknownHostResponse();
  }

  return routeRestaurantPath(request, pathname, slug);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|images|api/health).*)",
  ],
};
