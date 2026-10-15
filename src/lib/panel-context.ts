// Shared membership resolution for all panel server components.
//
// React.cache deduplicates within a single server render tree (layout + page
// within the same request). Server Actions run in a separate request context
// and cannot benefit from this cache — they use getActiveMembershipForAction().
//
// Cookie panel_restaurant_id stores the user-selected restaurant.
// The selection is validated against actual DB memberships, so a forged
// cookie cannot grant access to another restaurant.

import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClient } from "@/lib/supabase/server";
import type { MemberRole } from "./db-types";

export type ActiveMembership = {
  restaurantId: string;
  role:         MemberRole;
  restaurant:   { id: string; name: string; slug: string };
  /** True when the user has more than one active membership. */
  hasMultiple:  boolean;
};

/** All active memberships for the current user, ordered deterministically. */
export type MembershipOption = {
  restaurantId:   string;
  restaurantName: string;
  role:           MemberRole;
};

// Deduplicated within the same request (layout + page).
export const getActiveMembership = cache(
  async (): Promise<{
    active:  ActiveMembership | null;
    options: MembershipOption[];
  }> => {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { active: null, options: [] };

    const { data: rows } = await supabase
      .from("restaurant_members")
      .select("restaurant_id, role, restaurants(id, name, slug)")
      .eq("user_id", user.id)
      .eq("status", "active")
      // Deterministic order: oldest first so the "default" is always the same
      .order("created_at")
      .returns<
        Array<{
          restaurant_id: string;
          role:           MemberRole;
          restaurants:    { id: string; name: string; slug: string } | null;
        }>
      >();

    const valid = (rows ?? []).filter((r) => r.restaurants != null);
    if (!valid.length) return { active: null, options: [] };

    const options: MembershipOption[] = valid.map((r) => ({
      restaurantId:   r.restaurant_id,
      restaurantName: r.restaurants!.name,
      role:           r.role,
    }));

    // Preferred restaurant from cookie — validated against real memberships
    const cookieStore  = await cookies();
    const preferredId  = cookieStore.get("panel_restaurant_id")?.value;
    const preferred    = preferredId
      ? valid.find((r) => r.restaurant_id === preferredId)
      : null;

    const chosen = preferred ?? valid[0];

    const active: ActiveMembership = {
      restaurantId: chosen.restaurant_id,
      role:         chosen.role,
      restaurant:   chosen.restaurants!,
      hasMultiple:  valid.length > 1,
    };

    return { active, options };
  },
);

// For use inside Server Actions (separate request context, can't use React.cache).
// Reads the same cookie to pick the matching restaurant. Falls back to oldest.
// Validates: role must match requiredRole if provided.
export async function getActiveMembershipForAction(opts?: {
  requiredRole?: MemberRole | MemberRole[];
}): Promise<{ restaurantId: string; role: MemberRole }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado.");

  const { data: rows } = await supabase
    .from("restaurant_members")
    .select("restaurant_id, role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at");

  if (!rows?.length) throw new Error("Sin membresía activa.");

  const cookieStore = await cookies();
  const preferredId = cookieStore.get("panel_restaurant_id")?.value;
  const preferred   = preferredId
    ? rows.find((r) => r.restaurant_id === preferredId)
    : null;
  const chosen = preferred ?? rows[0];

  if (opts?.requiredRole) {
    const allowed = Array.isArray(opts.requiredRole)
      ? opts.requiredRole
      : [opts.requiredRole];
    if (!allowed.includes(chosen.role as MemberRole)) {
      throw new Error(
        `Esta acción requiere rol ${allowed.join(" o ")}. Tu rol actual es ${chosen.role}.`,
      );
    }
  }

  return { restaurantId: chosen.restaurant_id, role: chosen.role as MemberRole };
}
