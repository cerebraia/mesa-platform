// Shared test helpers for Mesa platform integration tests.
//
// Auth cache: reuses JWT tokens within a test process to avoid hitting
// Supabase auth rate limits (429) when running multiple test suites quickly.
// Each clientFor() call with the same credentials returns the same client.
//
// Limitation: the cache is per-process. Running multiple test files in the
// same npm test run still authenticates fresh per file. Spacing out test suite
// invocations by ~2 seconds prevents most 429 errors in that case.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

const authCache = new Map<string, { client: SupabaseClient; expiresAt: number }>();
const TOKEN_TTL_MS = 55 * 60 * 1000; // 55 min (Supabase JWTs expire in 60 min)

export async function clientFor(
  email: string,
  password: string,
  retries = 3,
): Promise<SupabaseClient> {
  const cacheKey = `${email}`;
  const cached = authCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.client;

  for (let attempt = 0; attempt < retries; attempt++) {
    const resp = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: ANON, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (resp.status === 429) {
      if (attempt < retries - 1) {
        // Exponential backoff: 2s, 4s
        await new Promise((r) => setTimeout(r, 2000 * Math.pow(2, attempt)));
        continue;
      }
      throw new Error(`Auth rate limited for ${email} after ${retries} attempts (429)`);
    }

    const json = await resp.json() as Record<string, unknown>;
    if (!resp.ok || !json.access_token) {
      throw new Error(
        `Auth failed ${email}: ${String(json.error_description ?? json.error ?? resp.status)}`,
      );
    }

    const client = createClient(URL, ANON, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${json.access_token}` } },
    });

    authCache.set(cacheKey, { client, expiresAt: Date.now() + TOKEN_TTL_MS });
    return client;
  }
  throw new Error(`clientFor: unreachable`);
}

export function anonClient(): SupabaseClient {
  return createClient(URL, ANON, { auth: { persistSession: false } });
}

export const URL_  = URL;
export const ANON_ = ANON;
