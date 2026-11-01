// Anon (unauthenticated) Supabase client for server-side public data access.
// Used by generateMetadata and sitemap.
// RLS restricts reads to published/active content only.
import { createServerClient } from "@supabase/ssr";

export function createAnonSupabaseClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );
}
