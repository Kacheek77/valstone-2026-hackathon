import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-side only. The env vars are deliberately not prefixed NEXT_PUBLIC_,
// so Next.js never inlines them into browser bundles.
//
// Built lazily (on first call, not at import) so a missing env var surfaces
// as a readable error on the page instead of failing the build or crashing
// the module.
let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase is not configured: SUPABASE_URL and/or SUPABASE_ANON_KEY is missing.",
    );
  }

  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
