import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client (anon key only — safe to ship to the client).
 * Currently used only for auth state changes; all data goes through /api.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
