import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "../lib/env";

/**
 * Service-role client. BYPASSES RLS — use only after the caller's identity
 * has been established with createUserClient() and only for operations
 * that the client must not be able to perform directly:
 *   - reading/writing `questions` (answer keys, SDD decision 2)
 *   - `submit_attempt` RPC (NFR-R3)
 *   - `generation_requests` / `count_recent_generations` (SEC-6)
 * Never import this from client code.
 */
let cached: SupabaseClient | null = null;

export function createAdminClient(): SupabaseClient {
  if (!cached) {
    cached = createClient(env.supabaseUrl(), env.supabaseServiceRoleKey(), {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return cached;
}
