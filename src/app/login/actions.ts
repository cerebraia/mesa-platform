"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient } from "@/lib/supabase/server";
import { selectRestaurant } from "@/app/panel/select-restaurant";
import { SLUG_RE, RESERVED_SUBDOMAINS } from "@/lib/host-resolver";

export type LoginState = {
  error:    string | null;
  /** True when auth succeeded but the user has no active membership in the requested business. */
  noAccess?: boolean;
};

// Exact allowlist of internal paths accepted via the ?next= post-login param.
// Keeping it exact (not a wildcard) eliminates open-redirect risk entirely.
// Add entries here when other protected pages need this flow.
const ALLOWED_NEXT_PATHS = new Set(["/admin/usuarios"]);

function sanitizeNext(next: string | null | undefined): string | null {
  if (!next) return null;
  // Reject anything that is not a simple pathname (no host, protocol, query or fragment).
  if (!/^\/[a-zA-Z0-9/_-]*$/.test(next)) return null;
  return ALLOWED_NEXT_PATHS.has(next) ? next : null;
}

export async function signIn(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email    = String(formData.get("email")    ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const negocio  = String(formData.get("negocio")  ?? "").trim();
  const nextRaw  = String(formData.get("next")     ?? "").trim();
  const nextPath = sanitizeNext(nextRaw);

  if (!email || !password) {
    return { error: "Ingresa tu correo y contraseña." };
  }

  const supabase = await createServerClient();
  const { error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError) {
    return { error: "Correo o contraseña incorrectos. Inténtalo de nuevo." };
  }

  // Business-specific login: validate the slug and check membership.
  if (negocio) {
    if (!SLUG_RE.test(negocio) || RESERVED_SUBDOMAINS.has(negocio)) {
      return { error: "Negocio no válido." };
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "No se pudo verificar la sesión. Inténtalo de nuevo." };
    }

    // Resolve restaurant id from slug — only active restaurants.
    const { data: restaurant } = await supabase
      .from("restaurants")
      .select("id")
      .eq("slug", negocio)
      .eq("status", "active")
      .maybeSingle();

    if (!restaurant) {
      // The business was valid when the page loaded but is no longer active.
      return { error: "Este negocio no está disponible en este momento." };
    }

    // Verify the user has an active membership in this specific business.
    const { data: membership } = await supabase
      .from("restaurant_members")
      .select("restaurant_id")
      .eq("user_id", user.id)
      .eq("restaurant_id", restaurant.id)
      .eq("status", "active")
      .maybeSingle();

    if (!membership) {
      return { error: "Tu cuenta no tiene acceso a este negocio.", noAccess: true };
    }

    // Membership confirmed — set the active business cookie and open the panel.
    try {
      await selectRestaurant(restaurant.id);
    } catch {
      return { error: "No se pudo seleccionar el negocio. Inténtalo de nuevo." };
    }

    redirect("/panel");
  }

  // Standard login: clear any stale business selection so the selector shows
  // when the user has multiple memberships.
  const cookieStore = await cookies();
  cookieStore.delete("panel_restaurant_id");

  // If the user was trying to reach a specific internal path, go there now.
  redirect(nextPath ?? "/panel");
}

export async function signOut(): Promise<void> {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
