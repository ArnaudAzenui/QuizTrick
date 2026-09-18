/**
 * AI response validation (WBS 1.4.3.4, owner: Arnaud) - NOT IMPLEMENTED YET.
 *
 * Functions to build here:
 *   - parseGeneratedQuiz(raw) - JSON parse + schema checks: question counts, exactly 4 options, exactly 1 correct, non-empty text, short answers <= 50 chars. Throw AppError.aiBadOutput() on failure (FR-3.4).
 *
 * Errors: throw AppError (src/backend/lib/errors.ts); routes wrap handlers with handle() from lib/api.ts.
 * Data access: user-owned rows via supabase/server.ts (RLS); answer keys + atomic RPCs via supabase/admin.ts ONLY.
 */

export {};
