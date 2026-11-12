import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { NewRestaurantWizard } from "./new-restaurant-wizard";

export default async function NewRestaurantPage() {
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: adminRow } = await supabase
    .from("platform_admins").select("user_id").maybeSingle();
  if (!adminRow) redirect("/panel");

  const { data: plans } = await supabase
    .from("plans")
    .select("id, name, price_cents, currency, is_active, plan_code")
    .eq("is_active", true)
    .order("price_cents");

  type Plan = { id: string; name: string; price_cents: number; currency: string; is_active: boolean; plan_code: string | null };
  const activePlans = (plans ?? []) as Plan[];

  return <NewRestaurantWizard plans={activePlans} />;
}
