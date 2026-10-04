/**
 * Quizzes (WBS 1.4.3 / 1.4.4, owner: Arnaud).
 *
 *   - listQuizzesForText (FR-3.7)
 *
 * Still to build here:
 *   - getQuizForTaking - MUST strip correctOption / expectedAnswer before returning (SDD decision 2)
 *   - deleteQuiz (SEC-10)
 *
 * Errors: throw AppError (src/backend/lib/errors.ts); routes wrap handlers with handle() from lib/api.ts.
 * Data access: user-owned rows via supabase/server.ts (RLS); answer keys + atomic RPCs via supabase/admin.ts ONLY.
 */
import { AppError } from "@backend/lib/errors";
import { createUserClient } from "@backend/supabase/server";
import { toQuiz, type QuizRow } from "@backend/db/rows";
import { idSchema } from "@backend/validation/schemas";
import type { Quiz } from "@shared/types";
import { getCurrentUser } from "./auth.service";

const QUIZ_COLUMNS = "id, owner_id, text_id, question_count, created_at";

/** FR-3.7. Newest first. A text with no quizzes is [], a missing text is NOT_FOUND. */
export async function listQuizzesForText(textId: string): Promise<Quiz[]> {
  const textMissing = () => AppError.notFound("That study text");
  if (!idSchema.safeParse(textId).success) throw textMissing();

  const user = await getCurrentUser();
  const client = await createUserClient();

  // Only the title is needed — it labels every quiz — not the 20,000-character body.
  const { data: text, error: textError } = await client
    .from("study_texts")
    .select("id, title")
    .eq("id", textId)
    .eq("owner_id", user.userId)
    .maybeSingle<{ id: string; title: string | null }>();
  if (textError) {
    console.error("[quizzes] text lookup failed", textError.code, textError.message);
    throw AppError.internal("We couldn't load the quizzes for that text. Please try again.");
  }
  if (!text) throw textMissing();

  const { data, error } = await client
    .from("quizzes")
    .select(QUIZ_COLUMNS)
    .eq("text_id", textId)
    .eq("owner_id", user.userId)
    .order("created_at", { ascending: false })
    .returns<QuizRow[]>();
  if (error) {
    console.error("[quizzes] list failed", error.code, error.message);
    throw AppError.internal("We couldn't load the quizzes for that text. Please try again.");
  }
  return (data ?? []).map((r) => toQuiz(r, text.title));
}
