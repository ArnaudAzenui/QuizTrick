/**
 * Generation prompt (WBS 1.4.3.2, owner: Arnaud) - NOT IMPLEMENTED YET.
 *
 * Functions to build here:
 *   - buildPrompt(text, questionCount) - fixed server-side instructions; fence the user text as source material only (AB-1 prompt-injection defence). 70/30 MCQ / short-answer mix (FR-3.2, FR-3.3).
 *
 * Errors: throw AppError (src/backend/lib/errors.ts); routes wrap handlers with handle() from lib/api.ts.
 * Data access: user-owned rows via supabase/server.ts (RLS); answer keys + atomic RPCs via supabase/admin.ts ONLY.
 */

export {};
