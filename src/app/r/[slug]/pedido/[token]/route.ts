import { type NextRequest, NextResponse } from "next/server";
import { createServerClient as createSsrClient } from "@supabase/ssr";
import { createHash } from "crypto";

// Legacy entry point: handles direct token URLs.
//
// In the current flow, the /api/orders POST sets the session cookie directly
// in its response. This route is only reached when:
//   1. A user visits an old-style confirmation URL they bookmarked or received.
//   2. The client somehow still navigates to the token URL (should not happen).
//
// Security: the token validates that the order exists. If valid, the token is
// added to the session array (not replacing existing ones) and the user is
// redirected to the clean confirmation URL.
//
// Residual logging: the token appears once in the server access log for this
// request. This is unavoidable when using URL-based token sharing. Production
// logging should treat /pedido/* paths as sensitive and suppress or mask them.

const SESSION_MAX = 5;

function createServiceClient() {
  return createSsrClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );
}

function readSessionTokens(request: NextRequest, cookieName: string): string[] {
  const raw = request.cookies.get(cookieName)?.value;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (t): t is string => typeof t === "string" && /^[0-9a-f]{64}$/.test(t),
    );
  } catch {
    return [];
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; token: string }> },
) {
  const { slug, token } = await params;

  if (!/^[0-9a-f]{64}$/.test(token)) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const supabase = createServiceClient();

  const { data: orderData } = await supabase.rpc("get_order_by_token", {
    p_token_hash: tokenHash,
  });
  if (!orderData) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  const order = orderData as { restaurant_id: string };
  if (!restaurant || order.restaurant_id !== restaurant.id) {
    return new NextResponse("Not Found", { status: 404 });
  }

  // Detect custom-domain context (same logic as /api/orders).
  // When the middleware rewrites /pedido/[token] from a custom domain,
  // it adds x-mesa-restaurant-slug. The cookie path and redirect destination
  // must match the browser-visible path on that domain.
  const customDomainSlug = request.headers.get("x-mesa-restaurant-slug");
  const isCustomDomain   =
    typeof customDomainSlug === "string" &&
    customDomainSlug === slug;

  const cookiePath   = isCustomDomain ? "/pedido"        : `/r/${slug}/pedido`;
  const redirectDest = isCustomDomain ? `/pedido/`       : `/r/${slug}/pedido/`;

  // Append this token to the session array (preserving access to older orders).
  const cookieName = `order_session_${slug}`;
  const existing = readSessionTokens(request, cookieName);
  // Deduplicate and cap at SESSION_MAX, newest first
  const sessionTokens = [token, ...existing.filter((t) => t !== token)].slice(0, SESSION_MAX);

  const response = NextResponse.redirect(
    new URL(redirectDest, request.url),
    { status: 302 },
  );

  response.cookies.set(cookieName, JSON.stringify(sessionTokens), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: cookiePath,
    maxAge: 7 * 24 * 60 * 60,
  });

  response.headers.set("Cache-Control", "no-store, no-cache");
  response.headers.set("Referrer-Policy", "no-referrer");

  return response;
}
