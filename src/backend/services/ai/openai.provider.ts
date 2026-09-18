/**
 * OpenAI-compatible provider (WBS 1.4.3.3) - NOT IMPLEMENTED YET.
 *
 * Functions to build here:
 *   - openAiProvider - implements AiProvider with fetch against {AI_BASE_URL}/chat/completions, JSON mode, timeout via AbortSignal. Works for OpenAI and for Gemini's OpenAI-compatible endpoint (see docs/SETUP.md).
 *
 * Errors: throw AppError (src/backend/lib/errors.ts); routes wrap handlers with handle() from lib/api.ts.
 * Data access: user-owned rows via supabase/server.ts (RLS); answer keys + atomic RPCs via supabase/admin.ts ONLY.
 */

export {};
