/**
 * Authentication (WBS 1.4.1, owner: Isaiah) - NOT IMPLEMENTED YET.
 *
 * Functions to build here:
 *   - registerUser (FR-1.1, FR-1.2)
 *   - loginUser (FR-1.3)
 *   - logoutUser (FR-1.3, SEC-8)
 *   - requestPasswordReset (FR-1.7)
 *   - getCurrentUser - reads the Supabase session; used by API routes and server components (FR-1.4, FR-1.5)
 *
 * Errors: throw AppError (src/backend/lib/errors.ts); routes wrap handlers with handle() from lib/api.ts.
 * Data access: user-owned rows via supabase/server.ts (RLS); answer keys + atomic RPCs via supabase/admin.ts ONLY.
 */

export {};
