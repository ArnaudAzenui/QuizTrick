/**
 * Quizzes (WBS 1.4.3 / 1.4.4, owner: Arnaud).
 *
 *   - listQuizzesForText (FR-3.7)
 *   - getQuizForTaking (FR-4.1) - questions without correctOption / expectedAnswer (SDD decision 2)
 *
 * Still to build here:
 *   - deleteQuiz (SEC-10)
 *
 * Errors: throw AppError (src/backend/lib/errors.ts); routes wrap handlers with handle() from lib/api.ts.
 * Data access: user-owned rows via supabase/server.ts (RLS); answer keys + atomic RPCs via supabase/admin.ts ONLY.
 */
import { AppError } from "@backend/lib/errors";
import { createAdminClient } from "@backend/supabase/admin";
import { createUserClient } from "@backend/supabase/server";
import { toPublicQuestion, toQuiz, type PublicQuestionRow, type QuizRow } from "@backend/db/rows";
import { idSchema } from "@backend/validation/schemas";
import type { Quiz, QuizForTaking } from "@shared/types";
import { getCurrentUser } from "./auth.service";

const QUIZ_COLUMNS = "id, owner_id, text_id, question_count, created_at";
// No correct_option / expected_answer: what isn't selected can't leak.
const PUBLIC_QUESTION_COLUMNS = "id, quiz_id, position, type, text, options";

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

/**
 * FR-4.1. The quiz and its questions in order, with the answer keys stripped
 * (SDD decision 2): grading happens server-side on submit, never in the browser.
 *
 * Two clients, in this order. `questions` has no client SELECT policy, so the
 * questions can only be read with the admin client — which bypasses RLS. The
 * user-client read of the quiz is therefore the ownership check, and it must
 * succeed before the admin client is touched. Someone else's quiz is
 * NOT_FOUND, not FORBIDDEN, so the API never confirms that an id exists.
 */
export async function getQuizForTaking(quizId: string): Promise<QuizForTaking> {
  const quizMissing = () => AppError.notFound("That quiz");
  if (!idSchema.safeParse(quizId).success) throw quizMissing();

  const user = await getCurrentUser();
  const client = await createUserClient();

  // study_texts(title) follows quizzes.text_id, so the title comes back in the same query.
  const { data: quiz, error: quizError } = await client
    .from("quizzes")
    .select(`${QUIZ_COLUMNS}, study_texts(title)`)
    .eq("id", quizId)
    .eq("owner_id", user.userId)
    .maybeSingle<QuizRow & { study_texts: { title: string | null } | null }>();
  if (quizError) {
    console.error("[quizzes] quiz lookup failed", quizError.code, quizError.message);
    throw AppError.internal("We couldn't load that quiz. Please try again.");
  }
  if (!quiz) throw quizMissing();

  // Ownership is established above; only now is the admin client safe to use.
  const { data: questions, error: questionsError } = await createAdminClient()
    .from("questions")
    .select(PUBLIC_QUESTION_COLUMNS)
    .eq("quiz_id", quiz.id)
    .order("position", { ascending: true })
    .returns<PublicQuestionRow[]>();
  if (questionsError) {
    console.error("[quizzes] question lookup failed", questionsError.code, questionsError.message);
    throw AppError.internal("We couldn't load that quiz. Please try again.");
  }

  const { study_texts: text, ...row } = quiz;
  return {
    quiz: toQuiz(row, text?.title ?? null),
    questions: (questions ?? []).map(toPublicQuestion),
  };
}
