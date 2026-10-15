import { createServerClient as createSsrClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Use in Server Components, Server Actions, and Route Handlers.
// getUser() validates the JWT with the GoTrue server on every call.
export async function createServerClient() {
  const cookieStore = await cookies();

  return createSsrClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
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
    },
  );
}
