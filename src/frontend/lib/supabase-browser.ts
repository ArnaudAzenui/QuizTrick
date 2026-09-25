import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client (anon key only — safe to ship to the client).
 *
 * CAUTION: it cannot see the signed-in session. The session cookie is written
 * httpOnly (backend/supabase/cookies.ts) so a script can't lift the tokens out
 * of it, which also means this client reads no session and every call it makes
 * is anonymous. Use it only for things that need no identity; anything
 * user-specific goes through /api, which reads the cookie server-side.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
