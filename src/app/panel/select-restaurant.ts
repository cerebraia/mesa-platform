"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";

// Sets the active restaurant for the current session.
// The selection is validated server-side: the user must have an active
// membership in the requested restaurant. A forged POST cannot grant
// access to another tenant's data.
export async function selectRestaurant(restaurantId: string) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado.");

  const { data: membership } = await supabase
    .from("restaurant_members")
    .select("restaurant_id")
    .eq("user_id", user.id)
    .eq("restaurant_id", restaurantId)
    .eq("status", "active")
    .maybeSingle();

  if (!membership) throw new Error("Sin acceso a ese restaurante.");

  const cookieStore = await cookies();
  cookieStore.set("panel_restaurant_id", restaurantId, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    path:     "/panel",
    maxAge:   30 * 24 * 60 * 60, // 30 days
  });

  revalidatePath("/panel", "layout");
}
