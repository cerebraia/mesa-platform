import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { randomBytes, createHash } from "crypto";
import type {
  PlaceOrderRequest,
  PlaceOrderResponse,
  PriceChangedResponse,
} from "@/lib/catalog-types";

// Service-role client — bypasses RLS for server-side reads and calls place_order RPC.
// Secret key never reaches the browser.
function createServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );
}

const MAX_BODY_BYTES = 32 * 1024;

// DB-backed rate limit: max 5 orders per IP per 15-minute window.
// Resistant to process restarts and horizontal scaling.
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 5;

async function checkRateLimit(
  supabase: ReturnType<typeof createServiceClient>,
  ipHash: string,
): Promise<boolean> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const { count } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", windowStart);
  return (count ?? 0) < RATE_LIMIT_MAX;
}

function buildCartHash(req: PlaceOrderRequest): string {
  const payload = JSON.stringify({
    items: req.items
      .map((it) => ({
        p: it.productId,
        v: it.variantId ?? "",
        o: [...it.options]
          .sort((a, b) =>
            a.optionGroupId.localeCompare(b.optionGroupId) ||
            a.optionId.localeCompare(b.optionId),
          )
          .map((o) => `${o.optionGroupId}:${o.optionId}`),
        q: it.quantity,
      }))
      .sort((a, b) => a.p.localeCompare(b.p)),
    modality: req.modality,
    zoneId: req.deliveryZoneId ?? "",
    paymentId: req.paymentMethodId,
    name: req.customerName.trim().toLowerCase(),
    phone: req.customerPhone.trim(),
    notes: req.notes.trim().toLowerCase(),
  });
  return createHash("sha256").update(payload).digest("hex");
}

// Session cookie stores up to SESSION_MAX raw order tokens (newest first).
// Tokens are 64-char hex — individually cryptographically secure.
// No signing needed: the token itself is the credential.
const SESSION_MAX = 5;

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

type RpcResult = {
  order_id: string;
  order_number: number;
  subtotal_cents: number;
  delivery_fee_cents: number;
  total_cents: number;
  status: string;
  payment_method_name: string;
  payment_method_type: string;
  idempotent_replay: boolean;
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── Body size guard ───────────────────────────────────────────
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Solicitud demasiado grande." }, { status: 413 });
  }

  let body: PlaceOrderRequest;
  try {
    body = await request.json() as PlaceOrderRequest;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  // ── Basic format validation ───────────────────────────────────
  if (
    !body.restaurantId ||
    !body.idempotencyKey ||
    !body.customerName?.trim() ||
    !body.customerPhone?.trim()
  ) {
    return NextResponse.json({ error: "Faltan campos obligatorios." }, { status: 400 });
  }
  if (!body.items?.length) {
    return NextResponse.json({ error: "El carrito está vacío." }, { status: 400 });
  }
  if (body.items.length > 30) {
    return NextResponse.json({ error: "El pedido supera el máximo de 30 líneas." }, { status: 400 });
  }
  if (!["pickup", "delivery"].includes(body.modality)) {
    return NextResponse.json({ error: "Modalidad inválida." }, { status: 400 });
  }
  if (body.modality === "delivery" && !body.deliveryZoneId) {
    return NextResponse.json({ error: "Selecciona una zona de delivery." }, { status: 400 });
  }
  if (!body.paymentMethodId) {
    return NextResponse.json({ error: "Selecciona un medio de pago." }, { status: 400 });
  }

  const supabase = createServiceClient();

  // ── Rate limiting ─────────────────────────────────────────────
  const rawIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const ipHash = createHash("sha256").update(rawIp).digest("hex");

  const allowed = await checkRateLimit(supabase, ipHash);
  if (!allowed) {
    return NextResponse.json(
      { error: "Demasiados pedidos. Intenta de nuevo en 15 minutos." },
      { status: 429 },
    );
  }

  // ── Look up restaurant slug (needed for cookie name and redirectTo) ──
  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id, slug")
    .eq("id", body.restaurantId)
    .eq("status", "active")
    .maybeSingle();

  if (!restaurant) {
    return NextResponse.json({ error: "Restaurante no disponible." }, { status: 422 });
  }

  // ── Pre-validate and recompute prices ─────────────────────────
  const productIds = [...new Set(body.items.map((i) => i.productId))];

  const { data: products, error: prodErr } = await supabase
    .from("products")
    .select("id, name, base_price_cents, promo_price_cents, is_published, is_available, restaurant_id")
    .in("id", productIds)
    .eq("restaurant_id", body.restaurantId);

  if (prodErr) {
    return NextResponse.json({ error: "Error al leer el catálogo." }, { status: 500 });
  }

  const productMap = new Map((products ?? []).map((p) => [p.id, p]));
  let computedSubtotal = 0;
  let computedDeliveryFee = 0;

  for (const item of body.items) {
    const product = productMap.get(item.productId);
    if (!product || !product.is_published || !product.is_available) {
      return NextResponse.json(
        { error: "Un producto del carrito ya no está disponible." },
        { status: 422 },
      );
    }
    if (item.quantity < 1 || item.quantity > 20) {
      return NextResponse.json({ error: "Cantidad inválida." }, { status: 400 });
    }

    let unitPrice = product.promo_price_cents ?? product.base_price_cents;

    if (item.variantId) {
      const { data: variant } = await supabase
        .from("product_variants")
        .select("price_cents, is_available")
        .eq("id", item.variantId)
        .eq("product_id", item.productId)
        .eq("restaurant_id", body.restaurantId)
        .maybeSingle();
      if (!variant || !variant.is_available) {
        return NextResponse.json(
          { error: "Una variante del carrito no está disponible." },
          { status: 422 },
        );
      }
      unitPrice = variant.price_cents;
    }

    for (const opt of item.options) {
      const { data: option } = await supabase
        .from("options")
        .select("price_delta_cents, is_available")
        .eq("id", opt.optionId)
        .eq("option_group_id", opt.optionGroupId)
        .eq("restaurant_id", body.restaurantId)
        .maybeSingle();
      if (!option || !option.is_available) {
        return NextResponse.json(
          { error: "Una opción del carrito no está disponible." },
          { status: 422 },
        );
      }
      unitPrice += option.price_delta_cents;
    }

    if (unitPrice < 0) unitPrice = 0;
    computedSubtotal += unitPrice * item.quantity;
  }

  if (body.modality === "delivery" && body.deliveryZoneId) {
    const { data: zone } = await supabase
      .from("delivery_zones")
      .select("fee_cents, minimum_order_cents, is_active")
      .eq("id", body.deliveryZoneId)
      .eq("restaurant_id", body.restaurantId)
      .maybeSingle();
    if (!zone || !zone.is_active) {
      return NextResponse.json(
        { error: "La zona de delivery seleccionada no está disponible." },
        { status: 422 },
      );
    }
    computedDeliveryFee = zone.fee_cents;
    if (computedSubtotal < zone.minimum_order_cents) {
      return NextResponse.json(
        { error: `El pedido mínimo para esta zona es $${(zone.minimum_order_cents / 100).toFixed(2)}.` },
        { status: 422 },
      );
    }
  }

  const computedTotal = computedSubtotal + computedDeliveryFee;

  // ── Price-change acknowledgment ───────────────────────────────
  if (body.acknowledgedTotalCents !== computedTotal) {
    const resp: PriceChangedResponse = {
      priceChanged: true,
      actualTotalCents: computedTotal,
      actualSubtotalCents: computedSubtotal,
      actualDeliveryFeeCents: computedDeliveryFee,
    };
    return NextResponse.json(resp, { status: 422 });
  }

  // ── Generate access token ─────────────────────────────────────
  // Token raw value is delivered ONLY via Set-Cookie — never in the response body.
  const tokenBytes = randomBytes(32);
  const token = tokenBytes.toString("hex");                           // 64 hex chars
  const tokenHash = createHash("sha256").update(token).digest("hex"); // stored in DB

  const cartHash = buildCartHash(body);

  // ── Call place_order RPC (transactional) ─────────────────────
  const rpcItems = body.items.map((it) => ({
    product_id: it.productId,
    variant_id: it.variantId ?? null,
    options: it.options.map((o) => ({
      option_group_id: o.optionGroupId,
      option_id: o.optionId,
    })),
    quantity: it.quantity,
  }));

  const { data: rpcData, error: rpcErr } = await supabase.rpc("place_order", {
    p_restaurant_id:     body.restaurantId,
    p_idempotency_key:   body.idempotencyKey,
    p_cart_hash:         cartHash,
    p_customer_name:     body.customerName.trim(),
    p_customer_phone:    body.customerPhone.trim(),
    p_modality:          body.modality,
    p_delivery_zone_id:  body.deliveryZoneId ?? null,
    p_delivery_address:  body.deliveryAddress?.trim() ?? null,
    p_payment_method_id: body.paymentMethodId,
    p_notes:             body.notes?.trim() ?? null,
    p_items:             rpcItems,
    p_access_token_hash: tokenHash,
    p_ip_hash:           ipHash,
  });

  if (rpcErr) {
    if (rpcErr.code === "23505" || rpcErr.message?.includes("unique_violation")) {
      return NextResponse.json(
        { error: "Ya existe un pedido con esta clave de idempotencia y contenido diferente." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: rpcErr.message }, { status: 422 });
  }

  const result = rpcData as RpcResult;

  if (result.idempotent_replay) {
    // First attempt already set the cookie. The client should use the
    // confirmation page it already has (the session cookie is still valid).
    return NextResponse.json(
      { error: "El pedido ya fue enviado. La página de confirmación aún está disponible." },
      { status: 409 },
    );
  }

  // ── Detect custom-domain context ─────────────────────────────
  // When the middleware rewrites a request from a restaurant's custom domain
  // (e.g. restaurante.com), it adds x-mesa-restaurant-slug.
  // In that case the browser path is /pedido/, not /r/<slug>/pedido/, so
  // we must set the cookie path and redirectTo accordingly.
  //
  // Cookie isolation note: cookies set for a custom domain (e.g. restaurante.com
  // with path /pedido/) are NOT shared with the main platform domain, and vice
  // versa. This is the expected browser behaviour for host-only cookies.
  const customDomainSlug = request.headers.get("x-mesa-restaurant-slug");
  const isCustomDomain   =
    typeof customDomainSlug === "string" &&
    customDomainSlug.length > 0 &&
    customDomainSlug === restaurant.slug; // must match what we looked up by ID

  const cookiePath  = isCustomDomain ? "/pedido"                      : `/r/${restaurant.slug}/pedido`;
  const redirectTo  = isCustomDomain ? "/pedido/"                     : `/r/${restaurant.slug}/pedido/`;

  // ── Set session cookie ────────────────────────────────────────
  const cookieName = `order_session_${restaurant.slug}`;
  const existingTokens = readSessionTokens(request, cookieName);
  const sessionTokens = [token, ...existingTokens].slice(0, SESSION_MAX);

  const response: PlaceOrderResponse = {
    orderNumber: result.order_number,
    redirectTo,
    totalCents: result.total_cents,
    subtotalCents: result.subtotal_cents,
    deliveryFeeCents: result.delivery_fee_cents,
    status: "received",
    paymentMethodName: result.payment_method_name,
  };

  const httpResponse = NextResponse.json(response, {
    status: 201,
    headers: {
      "Cache-Control": "no-store",
      "Pragma": "no-cache",
    },
  });

  // Cookie: HttpOnly so JS cannot read it; Secure in production; SameSite=Strict.
  // Path scoped to the confirmation route — not sent on other requests.
  // 7-day expiry covers follow-up visits ("where's my order?").
  httpResponse.cookies.set(cookieName, JSON.stringify(sessionTokens), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: cookiePath,
    maxAge: 7 * 24 * 60 * 60,
  });

  return httpResponse;
}
