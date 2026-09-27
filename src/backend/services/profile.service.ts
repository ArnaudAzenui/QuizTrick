/**
 * User profile (WBS 1.4.1, owner: Isaiah) - NOT IMPLEMENTED YET.
 *
 * Functions to build here:
 *   - getProfile (FR-1.6)
 *   - updateDisplayName (FR-1.6)
 *
 * display_name is the ONLY column a user may write (migration 0002 revoked the
 * rest at the column level). Changing an email is an auth operation —
 * supabase.auth.updateUser() — not an update to public.profiles.
 *
 * Errors: throw AppError (src/backend/lib/errors.ts); routes wrap handlers with handle() from lib/api.ts.
 * Data access: user-owned rows via supabase/server.ts (RLS); answer keys + atomic RPCs via supabase/admin.ts ONLY.
 */

export {};
