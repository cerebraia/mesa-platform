// Auth and platform_admin authorization are handled exclusively in
// src/app/admin/layout.tsx — this page trusts that the layout already ran.
// Duplicating the check here caused a redirect loop:
//   /admin/restaurants/new → /panel (maybeSingle fails with 2+ admins) → /admin
import { createServerClient } from "@/lib/supabase/server";
import { NewRestaurantWizard } from "./new-restaurant-wizard";

export default async function NewRestaurantPage() {
  const supabase = await createServerClient();

  const { data: plans } = await supabase
    .from("plans")
    .select("id, name, price_cents, currency, is_active, plan_code")
    .eq("is_active", true)
    .order("price_cents");

  type Plan = { id: string; name: string; price_cents: number; currency: string; is_active: boolean; plan_code: string | null };
  const activePlans = (plans ?? []) as Plan[];

  return <NewRestaurantWizard plans={activePlans} />;
}
