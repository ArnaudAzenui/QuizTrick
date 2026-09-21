/**
 * Study timer sessions (WBS 1.5.2) - NOT IMPLEMENTED YET.
 *
 * Functions to build here:
 *   - listSessions
 *   - saveSession (FR-7.4)
 *
 * durationSeconds is derived twice on purpose — by createSessionSchema and
 * again by the study_sessions trigger (migration 0002) — because the browser
 * can insert here directly with the anon key. Pass the timestamps through and
 * let both do their job; a task_id belonging to another user raises P0002.
 *
 * Errors: throw AppError (src/backend/lib/errors.ts); routes wrap handlers with handle() from lib/api.ts.
 * Data access: user-owned rows via supabase/server.ts (RLS); answer keys + atomic RPCs via supabase/admin.ts ONLY.
 */

export {};
