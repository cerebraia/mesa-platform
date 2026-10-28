"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient } from "@/lib/supabase/server";

export type LoginState = { error: string | null };

export async function signIn(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Ingresa tu correo y contraseña." };
  }

  const supabase = await createServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Don't expose internal error messages; just confirm the credentials failed.
    return { error: "Correo o contraseña incorrectos. Inténtalo de nuevo." };
  }

  // Clear any previous business selection so each login starts at the selector
  // when the user has multiple memberships.
  const cookieStore = await cookies();
  cookieStore.delete("panel_restaurant_id");

  redirect("/panel");
}

export async function signOut(): Promise<void> {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
