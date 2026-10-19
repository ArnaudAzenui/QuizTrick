/**
 * Attempts (WBS 1.4.4 / 1.6.1, owner: Arnaud).
 *
 *   - submitAttempt (FR-4.3 - FR-4.5, NFR-R3) - grade server-side with the answer keys,
 *     then store attempt + answers + score atomically through the submit_attempt RPC
 *   - getAttemptReview (FR-4.6) - the results screen: every question with its key,
 *     the student's response and isCorrect
 *
 * Still to build here:
 *   - listHistory (FR-5.1, FR-5.2, FR-5.4)
 *
 * Two clients, always in this order (same rule as quiz.service.ts): the user
 * client reads the quiz or attempt, which RLS limits to the caller's own rows,
 * and only once that read succeeds is the admin client used for `questions`
 * (no client policy, answer keys) and the RPC. Someone else's quiz or attempt
 * is NOT_FOUND, never FORBIDDEN, so the API does not confirm that an id exists.
 *
 * Errors: throw AppError (src/backend/lib/errors.ts); routes wrap handlers with handle() from lib/api.ts.
 * Data access: user-owned rows via supabase/server.ts (RLS); answer keys + atomic RPCs via supabase/admin.ts ONLY.
 */
import type { z } from "zod";
import { AppError } from "@backend/lib/errors";
import { createAdminClient } from "@backend/supabase/admin";
import { createUserClient } from "@backend/supabase/server";
import {
  toAttempt,
  toQuestion,
  toQuiz,
  type AnswerRecordRow,
  type AttemptRow,
  type QuestionRow,
  type QuizRow,
} from "@backend/db/rows";
import { idSchema, type submitAttemptSchema } from "@backend/validation/schemas";
import type { Attempt, AttemptReview } from "@shared/types";
import { getCurrentUser } from "./auth.service";
import { gradeAttempt } from "./grading.service";

const QUIZ_COLUMNS = "id, owner_id, text_id, question_count, created_at";
const QUESTION_COLUMNS = "id, quiz_id, position, type, text, options, correct_option, expected_answer";
const ATTEMPT_COLUMNS = "id, owner_id, quiz_id, started_at, submitted_at, score";
const ANSWER_COLUMNS = "id, attempt_id, question_id, response, is_correct";

type QuizWithTitle = QuizRow & { study_texts: { title: string | null } | null };

const quizMissing = () => AppError.notFound("That quiz");
const attemptMissing = () => AppError.notFound("That attempt");

/**
 * The quiz's questions WITH answer keys, in position order. Admin client:
 * `questions` has no client SELECT policy. Call only after ownership of the
 * quiz has been established through the user client.
 */
async function loadQuestionsWithKeys(quizId: string): Promise<QuestionRow[]> {
  const { data, error } = await createAdminClient()
    .from("questions")
    .select(QUESTION_COLUMNS)
    .eq("quiz_id", quizId)
    .order("position", { ascending: true })
    .returns<QuestionRow[]>();
  if (error) {
    console.error("[attempts] question lookup failed", error.code, error.message);
    throw AppError.internal("We couldn't load that quiz. Please try again.");
  }
  return data ?? [];
}

/**
 * FR-4.3 - FR-4.5, NFR-R3. Grades the submission against the answer keys and
 * stores the attempt, its answer records and the score in one transaction.
 *
 * submit_attempt REQUIRES exactly one record per question of the quiz, so
 * every question is passed, answered or not (gradeAttempt does this). The RPC
 * raises exactly three documented SQLSTATEs; each is mapped here and the raw
 * message is logged first, because all three mean the server built the
 * payload wrong rather than the student doing anything unusual.
 *
 * startedAt comes from the browser and is clamped to now() by the RPC, so the
 * stored attempt is read back rather than assembled here.
 */
export async function submitAttempt(quizId: string, input: z.output<typeof submitAttemptSchema>): Promise<Attempt> {
  if (!idSchema.safeParse(quizId).success) throw quizMissing();

  const user = await getCurrentUser();
  const client = await createUserClient();

  // The ownership check: RLS turns someone else's quiz into "no row".
  const { data: quiz, error: quizError } = await client
    .from("quizzes")
    .select("id")
    .eq("id", quizId)
    .eq("owner_id", user.userId)
    .maybeSingle<{ id: string }>();
  if (quizError) {
    console.error("[attempts] quiz lookup failed", quizError.code, quizError.message);
    throw AppError.internal("We couldn't submit your quiz. Please try again.");
  }
  if (!quiz) throw quizMissing();

  const questions = (await loadQuestionsWithKeys(quizId)).map(toQuestion);
  const graded = gradeAttempt(questions, input.answers);

  const admin = createAdminClient();
  const { data: attemptId, error: rpcError } = await admin.rpc("submit_attempt", {
    p_owner_id: user.userId,
    p_quiz_id: quizId,
    p_started_at: input.startedAt ?? null,
    p_score: graded.score,
    p_answers: graded.answers.map((a) => ({ question_id: a.questionId, response: a.response, is_correct: a.isCorrect })),
  });
  if (rpcError || typeof attemptId !== "string") {
    console.error("[attempts] submit_attempt failed", rpcError?.code, rpcError?.message);
    // P0002: the quiz vanished between the ownership check and the insert.
    if (rpcError?.code === "P0002") throw quizMissing();
    // 23503 / 23514: an answer from another quiz, a duplicate, the wrong count
    // or a bad score. gradeAttempt guards all of these, so reaching here means
    // the two have drifted apart.
    if (rpcError?.code === "23503" || rpcError?.code === "23514") {
      throw AppError.validation("Those answers don't match this quiz. Reload the quiz and try again.");
    }
    throw AppError.internal("We couldn't submit your quiz. Please try again.");
  }

  const { data: attempt, error: readError } = await client
    .from("attempts")
    .select(ATTEMPT_COLUMNS)
    .eq("id", attemptId)
    .eq("owner_id", user.userId)
    .maybeSingle<AttemptRow>();
  if (readError || !attempt) {
    // The attempt IS stored at this point; the student just can't be shown it.
    console.error("[attempts] stored attempt could not be read back", attemptId, readError?.code, readError?.message);
    throw AppError.internal("Your quiz was submitted, but the score couldn't be loaded. Check your history.");
  }
  return toAttempt(attempt);
}

/**
 * FR-4.6. The results screen: the attempt, its quiz, and one item per question
 * in position order carrying the full question (answer key included), the
 * student's response and whether it was correct.
 *
 * The answer key is sent on purpose: the attempt is already submitted and
 * graded, so there is nothing left to protect (SDD decision 2 covers the
 * taking screen, not the review).
 */
export async function getAttemptReview(attemptId: string): Promise<AttemptReview> {
  if (!idSchema.safeParse(attemptId).success) throw attemptMissing();

  const user = await getCurrentUser();
  const client = await createUserClient();

  const { data: attempt, error: attemptError } = await client
    .from("attempts")
    .select(ATTEMPT_COLUMNS)
    .eq("id", attemptId)
    .eq("owner_id", user.userId)
    .maybeSingle<AttemptRow>();
  if (attemptError) {
    console.error("[attempts] attempt lookup failed", attemptError.code, attemptError.message);
    throw AppError.internal("We couldn't load those results. Please try again.");
  }
  if (!attempt) throw attemptMissing();

  // study_texts(title) follows quizzes.text_id, as in getQuizForTaking.
  const { data: quiz, error: quizError } = await client
    .from("quizzes")
    .select(`${QUIZ_COLUMNS}, study_texts(title)`)
    .eq("id", attempt.quiz_id)
    .eq("owner_id", user.userId)
    .maybeSingle<QuizWithTitle>();
  if (quizError) {
    console.error("[attempts] quiz lookup failed", quizError.code, quizError.message);
    throw AppError.internal("We couldn't load those results. Please try again.");
  }
  if (!quiz) throw attemptMissing();

  // Ownership established twice over; the admin client is safe from here.
  const questions = await loadQuestionsWithKeys(quiz.id);
  const { data: records, error: recordsError } = await createAdminClient()
    .from("answer_records")
    .select(ANSWER_COLUMNS)
    .eq("attempt_id", attempt.id)
    .returns<AnswerRecordRow[]>();
  if (recordsError) {
    console.error("[attempts] answer lookup failed", recordsError.code, recordsError.message);
    throw AppError.internal("We couldn't load those results. Please try again.");
  }

  // submit_attempt stores one record per question, so a missing one can only
  // mean the quiz was regenerated or edited underneath this attempt. Show the
  // question as unanswered rather than failing the whole page.
  const byQuestion = new Map((records ?? []).map((r) => [r.question_id, r]));
  const { study_texts: text, ...quizRow } = quiz;
  return {
    attempt: toAttempt(attempt),
    quiz: toQuiz(quizRow, text?.title ?? null),
    items: questions.map((q) => {
      const record = byQuestion.get(q.id);
      return { question: toQuestion(q), response: record?.response ?? "", isCorrect: record?.is_correct ?? false };
    }),
  };
}
