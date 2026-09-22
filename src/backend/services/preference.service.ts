/**
 * Theme preference (WBS 1.6.2) - NOT IMPLEMENTED YET.
 *
 * Functions to build here:
 *   - getPreference (FR-8.3)
 *   - setTheme (FR-8.3)
 *
 * Use upsert, not update: the signup trigger creates the row, but accounts that
 * predate the schema (or a row deleted before migration 0002 closed that off)
 * may not have one, and "theme could not be found" is a nonsense error to show.
 *
 * Errors: throw AppError (src/backend/lib/errors.ts); routes wrap handlers with handle() from lib/api.ts.
 * Data access: user-owned rows via supabase/server.ts (RLS); answer keys + atomic RPCs via supabase/admin.ts ONLY.
 */

export {};
