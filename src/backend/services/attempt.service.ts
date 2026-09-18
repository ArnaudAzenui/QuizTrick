/**
 * Attempts (WBS 1.4.4 / 1.6.1) - NOT IMPLEMENTED YET.
 *
 * Functions to build here:
 *   - submitAttempt - atomic: grade server-side with answer keys, store attempt + answers + score in one transaction/RPC (FR-4.5, NFR-R3)
 *       The submit_attempt RPC REQUIRES exactly one record per question of the quiz, all belonging to that quiz.
 *       So: load all questions (admin client), grade every one — unanswered => { response: "", is_correct: false } —
 *       and pass the full list. The RPC raises 23503 / 23514 otherwise; map those to AppError.validation().
 *   - getAttemptReview (FR-4.6)
 *   - listHistory (FR-5.1, FR-5.2, FR-5.4)
 *
 * Errors: throw AppError (src/backend/lib/errors.ts); routes wrap handlers with handle() from lib/api.ts.
 * Data access: user-owned rows via supabase/server.ts (RLS); answer keys + atomic RPCs via supabase/admin.ts ONLY.
 */

export {};
