/**
 * Quiz generation pipeline (WBS 1.4.3, owner: Arnaud) - NOT IMPLEMENTED YET.
 *
 * Functions to build here:
 *   - generateQuiz(userId, textId, questionCount) - rate-limit check (SEC-6, 20/hr) -> buildPrompt -> AI provider call -> parseGeneratedQuiz -> persist atomically (FR-3.5, NFR-R2). Never store a partial quiz.
 *       Timing: LIMITS.GENERATION_TIMEOUT_MS (30 s) is ONE budget for the whole call including up to
 *       GENERATION_MAX_RETRIES retries - compute `deadline = Date.now() + budget` once and pass the
 *       remaining time to each provider call; skip the retry if what's left is too small to be useful.
 *
 * Errors: throw AppError (src/backend/lib/errors.ts); routes wrap handlers with handle() from lib/api.ts.
 * Data access: user-owned rows via supabase/server.ts (RLS); answer keys + atomic RPCs via supabase/admin.ts ONLY.
 */

export {};
