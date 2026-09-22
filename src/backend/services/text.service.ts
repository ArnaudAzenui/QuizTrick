/**
 * Study texts (WBS 1.4.2) - NOT IMPLEMENTED YET.
 *
 * Functions to build here:
 *   - listTexts (FR-2.6)
 *   - createText - validate + clean via @shared/utils/text, then insert (FR-2.4, FR-2.5)
 *       Store the cleaned body and the charCount that validateStudyText() returned.
 *       Both count code points, which is what the `char_count = char_length(body)`
 *       check in migration 0002 compares against — never String.length.
 *   - getText
 *   - deleteText (SEC-10)
 *
 * Errors: throw AppError (src/backend/lib/errors.ts); routes wrap handlers with handle() from lib/api.ts.
 * Data access: user-owned rows via supabase/server.ts (RLS); answer keys + atomic RPCs via supabase/admin.ts ONLY.
 */

export {};
