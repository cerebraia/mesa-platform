"use server";

import { redirect } from "next/navigation";
import { selectRestaurant } from "@/app/panel/select-restaurant";

/**
 * Validates membership, sets the cookie, then redirects to /panel.
 *
 * Design: real validation failures are returned as { error } values so the
 * client can display them. redirect() is called OUTSIDE any try/catch so
 * Next.js's NEXT_REDIRECT signal is never caught and never surfaces as an
 * error message. The function never returns normally on success — the router
 * navigates away before the client can read a return value.
 */
export async function selectAndGo(
  restaurantId: string,
): Promise<{ error: string } | never> {
  // Validate membership and persist the selection. selectRestaurant throws a
  // real Error (not NEXT_REDIRECT) when the membership is invalid or the DB
  // write fails, so catching it here is safe and correct.
  try {
    await selectRestaurant(restaurantId);
  } catch (e) {
    return {
      error:
        e instanceof Error
          ? e.message
          : "No se pudo seleccionar el negocio. Inténtalo de nuevo.",
    };
  }

  // redirect() is intentionally outside the try/catch.
  // It throws NEXT_REDIRECT internally; the framework handles navigation.
  // The client never sees this because it never receives a return value.
  redirect("/panel");
}
