/**
 * Attempts (WBS 1.4.4 / 1.6.1) - NOT IMPLEMENTED YET.
 *
 * Functions to build here:
 *   - submitAttempt - atomic: grade server-side with answer keys, store attempt + answers + score in one transaction/RPC (FR-4.5, NFR-R3)
 *       The submit_attempt RPC REQUIRES exactly one record per question of the quiz, all belonging to that quiz.
 *       So: load all questions (admin client), grade every one — unanswered => { response: "", is_correct: false } —
 *       and pass the full list.
 *       Error codes (migration 0002 narrowed these to exactly three):
 *         P0002 -> AppError.notFound("That quiz")   — quiz missing or not the caller's
 *         23503 -> AppError.validation(...)          — an answer names a question from another quiz
 *         23514 -> AppError.validation(...)          — wrong number of answers, a duplicate, or a bad score
 *       All three mean the server built the payload wrong, so log the raw message before mapping.
 *       startedAt from the browser is clamped to now() by the RPC; don't re-derive it here.
 *   - getAttemptReview (FR-4.6)
 *   - listHistory (FR-5.1, FR-5.2, FR-5.4)
 *
 * Errors: throw AppError (src/backend/lib/errors.ts); routes wrap handlers with handle() from lib/api.ts.
 * Data access: user-owned rows via supabase/server.ts (RLS); answer keys + atomic RPCs via supabase/admin.ts ONLY.
 */

export {};
