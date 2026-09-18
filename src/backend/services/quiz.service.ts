/**
 * Quizzes (WBS 1.4.3 / 1.4.4, owner: Arnaud) - NOT IMPLEMENTED YET.
 *
 * Functions to build here:
 *   - listQuizzesForText (FR-3.7)
 *   - getQuizForTaking - MUST strip correctOption / expectedAnswer before returning (SDD decision 2)
 *   - deleteQuiz (SEC-10)
 *
 * Errors: throw AppError (src/backend/lib/errors.ts); routes wrap handlers with handle() from lib/api.ts.
 * Data access: user-owned rows via supabase/server.ts (RLS); answer keys + atomic RPCs via supabase/admin.ts ONLY.
 */

export {};
