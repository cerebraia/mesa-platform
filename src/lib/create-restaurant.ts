// Core restaurant creation logic, extracted from admin/actions.ts
// so it can be reused by multiple server actions and integration tests.
//
// Design constraints:
//   - `supabase` must be the authenticated admin JWT client  → guard_restaurant_status
//     (BEFORE UPDATE trigger) calls is_platform_admin() → auth.uid().
//     Passing a service-role client here will cause auth.uid()=NULL and the trigger
//     will raise "Solo los administradores de plataforma pueden cambiar el estado".
//   - `svc` can be a service-role client for reads that bypass RLS.
//   - Inserts do NOT trigger guard_restaurant_status, so the INSERT in step 3 can
//     use either client.

import type { SupabaseClient } from "@supabase/supabase-js";
import { SLUG_RE } from "./host-resolver.ts";

export type RestaurantCreationParams = {
  name: string;
  slug: string;
  currency?: string;
  timezone?: string;
  businessType?: string;
  ordersEnabled?: boolean;
  whatsapp?: string | null;
  instagramUrl?: string | null;
  description?: string | null;
  planId?: string | null;
};

export type RestaurantCoreResult = {
  error: string | null;
  restaurantId?: string;
  restaurantName?: string;
  slug?: string;
  activated?: boolean;
  catalogUrl?: string;
  loginUrl?: string;
  pendingItems?: string[];
  resumed?: boolean;
};

/**
 * Core restaurant creation flow.
 *
 * Steps:
 *  1. Validate slug format.
 *  2. Check if slug already exists (non-deleted):
 *       active      → return early with resumed: true (idempotent)
 *       suspended   → error: slug in use
 *       onboarding  → reuse that restaurantId (resume)
 *  3. If new slug: INSERT restaurants (status='onboarding').
 *  4. UPSERT restaurant_config (idempotent).
 *  5. If no active subscription: resolve plan (by planId or plan_code='inicio'),
 *     then INSERT subscriptions.
 *  6. If config OK and sub OK → UPDATE restaurants SET status='active'
 *     using the authenticated client so the guard trigger sees auth.uid().
 *  7. Build catalog/login URLs from env vars.
 *  8. Return RestaurantCoreResult.
 */
export async function restaurantCreationCore(
  supabase: SupabaseClient,
  svc: SupabaseClient,
  params: RestaurantCreationParams,
  adminUserId: string,
): Promise<RestaurantCoreResult> {
  const {
    name,
    slug,
    currency = "USD",
    timezone = "America/Caracas",
    businessType = "restaurant",
    ordersEnabled = true,
    whatsapp = null,
    instagramUrl = null,
    description = null,
    planId = null,
  } = params;

  // 1. Validate slug
  if (!SLUG_RE.test(slug)) {
    return {
      error:
        "El slug solo puede tener minúsculas, dígitos y guiones (3–63 chars).",
    };
  }
  if (!name || name.trim().length < 2) {
    return { error: "El nombre debe tener al menos 2 caracteres." };
  }

  // 2. Check if slug already exists (non-deleted)
  const { data: existing } = await svc
    .from("restaurants")
    .select("id, status")
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle();

  let restaurantId: string;
  let resumed = false;

  if (existing) {
    if (existing.status === "active" || existing.status === "suspended") {
      // Slug is taken by a complete or suspended business — not safe to reuse.
      return { error: "Este slug ya está en uso." };
    }
    // onboarding → incomplete creation; resume it without creating a duplicate.
    restaurantId = existing.id;
    resumed = true;
  } else {
    // 3. INSERT new restaurant in onboarding state
    const { data: restaurant, error: rErr } = await supabase
      .from("restaurants")
      .insert({
        name: name.trim(),
        slug,
        currency: (currency ?? "USD").toUpperCase(),
        timezone: timezone ?? "America/Caracas",
        status: "onboarding",
        business_type: businessType ?? "restaurant",
      })
      .select("id")
      .single();

    if (rErr) {
      if (rErr.code === "23505") return { error: "Este slug ya está en uso." };
      return { error: rErr.message };
    }
    restaurantId = restaurant.id;
  }

  const pendingItems: string[] = [];
  let configOk = false;
  let subOk = false;

  // 4. UPSERT restaurant_config (idempotent)
  const configPayload: Record<string, unknown> = {
    restaurant_id: restaurantId,
    orders_enabled: ordersEnabled,
  };
  if (whatsapp != null) configPayload.whatsapp = whatsapp;
  if (instagramUrl != null) configPayload.instagram_url = instagramUrl;
  if (description != null) configPayload.description = description;

  const { error: configErr } = await supabase
    .from("restaurant_config")
    .upsert(configPayload, { onConflict: "restaurant_id" });

  if (configErr) {
    pendingItems.push(
      `No se pudo crear la configuración inicial: ${configErr.message}. Ve al detalle del negocio → Configuración para completarla.`,
    );
  } else {
    configOk = true;
  }

  // 5. Subscription — only if no active subscription exists yet
  const { data: existingSub } = await svc
    .from("subscriptions")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .eq("status", "active")
    .maybeSingle();

  if (existingSub) {
    // Already subscribed
    subOk = true;
  } else {
    let resolvedPlanId = planId;
    if (!resolvedPlanId) {
      const { data: inicioPlan } = await svc
        .from("plans")
        .select("id")
        .eq("plan_code", "inicio")
        .eq("is_active", true)
        .maybeSingle();
      resolvedPlanId = inicioPlan?.id ?? null;
    }

    if (resolvedPlanId) {
      const { error: subErr } = await supabase
        .from("subscriptions")
        .insert({
          restaurant_id: restaurantId,
          plan_id: resolvedPlanId,
          status: "active",
          starts_at: new Date().toISOString(),
          created_by: adminUserId,
        });

      if (subErr) {
        pendingItems.push(
          `No se pudo asignar el plan: ${subErr.message}. Ve al detalle del negocio para asignarlo manualmente.`,
        );
      } else {
        subOk = true;
      }
    } else {
      pendingItems.push(
        "No se encontró el plan Inicio. Ve al detalle del negocio para asignar un plan manualmente.",
      );
    }
  }

  // 6. Activate when both required dependencies succeeded.
  //    Uses the authenticated session client so guard_restaurant_status sees auth.uid().
  let activated = false;
  if (configOk && subOk) {
    const { error: activateErr } = await supabase
      .from("restaurants")
      .update({ status: "active", updated_at: new Date().toISOString() })
      .eq("id", restaurantId);

    if (activateErr) {
      pendingItems.push(
        `El catálogo quedó en "En configuración". Ve al detalle del negocio → Estado para activarlo: ${activateErr.message}`,
      );
    } else {
      activated = true;
    }
  } else {
    pendingItems.push(
      'El catálogo permanece en "En configuración" hasta completar las dependencias obligatorias (configuración y plan). Ve al detalle del negocio para completarlas y luego activarlo desde Estado.',
    );
  }

  // 7. Build URLs
  const urls = _buildUrls(slug, activated);

  return {
    error: null,
    restaurantId,
    restaurantName: name.trim(),
    slug,
    activated,
    resumed,
    pendingItems: pendingItems.length > 0 ? pendingItems : undefined,
    ...urls,
  };
}

/** Build catalog and login URLs from environment variables. */
function _buildUrls(
  slug: string,
  activated: boolean,
): Pick<RestaurantCoreResult, "catalogUrl" | "loginUrl"> {
  const subBase = process.env.PLATFORM_SUBDOMAIN_BASE?.toLowerCase().trim();
  const rawSite =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.NEXT_PUBLIC_PLATFORM_HOST
      ? `https://${process.env.NEXT_PUBLIC_PLATFORM_HOST}`
      : null);

  const loginUrl = subBase
    ? `https://${slug}.${subBase}/panel/login`
    : rawSite
      ? `${rawSite}/login?negocio=${slug}`
      : `/login?negocio=${slug}`;

  const catalogUrl =
    activated && subBase
      ? `https://${slug}.${subBase}/`
      : activated && rawSite
        ? `${rawSite}/r/${slug}`
        : undefined;

  return { catalogUrl, loginUrl };
}
