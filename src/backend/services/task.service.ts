/**
 * Study tasks API (WBS 1.5.1; Fardin owns the UI) - NOT IMPLEMENTED YET.
 *
 * Functions to build here:
 *   - listTasks(scope: today|all) (FR-6.3)
 *   - createTask (FR-6.1, FR-6.2)
 *   - updateTask - incl. isComplete toggle (FR-6.4)
 *   - deleteTask (FR-6.5)
 *
 * Errors: throw AppError (src/backend/lib/errors.ts); routes wrap handlers with handle() from lib/api.ts.
 * Data access: user-owned rows via supabase/server.ts (RLS); answer keys + atomic RPCs via supabase/admin.ts ONLY.
 */

export {};
