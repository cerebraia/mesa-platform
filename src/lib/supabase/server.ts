import { createServerClient as createSsrClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Use in Server Components, Server Actions, and Route Handlers.
// getUser() validates the JWT with the GoTrue server on every call.
export async function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // Give a readable error instead of the generic ssr throw.
  // Common mistake: setting NEXT_PUBLIC_SUPABASE_ANON_KEY instead of
  // NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in Railway/env vars.
  if (!url || !key) {
    throw new Error(
      "Variables de entorno de Supabase no configuradas. " +
      "Añade NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY " +
      "en las variables del servicio Railway.",
    );
  }

  const cookieStore = await cookies();

  return createSsrClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components can't write cookies; the proxy handles refresh.
        }
      },
    },
  });
}
