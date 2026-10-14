/**
 * Quiz generation pipeline (WBS 1.4.3, FR-3.1 – FR-3.9).
 *
 *   generateQuiz: load the caller's text -> rate-limit check (SEC-6) -> buildPrompt
 *   -> AI provider -> parseGeneratedQuiz -> create_quiz_with_questions (atomic, NFR-R2)
 *
 * Timing: LIMITS.GENERATION_TIMEOUT_MS is ONE budget for the whole call,
 * retries included. The deadline is fixed once and each provider call gets
 * only what is left; a retry is skipped when too little remains to be useful.
 *
 * Errors: throw AppError (src/backend/lib/errors.ts); routes wrap handlers with handle() from lib/api.ts.
 * Data access: the text and the returned quiz through the user client (RLS);
 * the rate-limit table and the atomic insert through the admin client ONLY.
 */
import type { z } from "zod";
import { AppError } from "@backend/lib/errors";
import { createAdminClient } from "@backend/supabase/admin";
import { createUserClient } from "@backend/supabase/server";
import { toQuiz, type QuizRow } from "@backend/db/rows";
import type { generateQuizSchema } from "@backend/validation/schemas";
import { getAiProvider } from "@backend/services/ai";
import { getCurrentUser } from "@backend/services/auth.service";
import { findOwnedText } from "@backend/services/text.service";
import { LIMITS } from "@shared/constants";
import type { Quiz } from "@shared/types";
import { buildPrompt } from "./prompt";
import { parseGeneratedQuiz, QuizOutputRejected, type GeneratedQuestion } from "./parser";

/** Below this, a retry would almost certainly time out; fail with what we have instead. */
const MIN_ATTEMPT_MS = 5_000;

const QUIZ_COLUMNS = "id, owner_id, text_id, question_count, created_at";

/**
 * SEC-6. Counted before the request is logged, and logged before the provider
 * is called, so every attempt — successful or not — uses up quota.
 */
async function enforceRateLimit(userId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: recent, error: countError } = await admin.rpc("count_recent_generations", { p_owner_id: userId });
  if (countError) {
    console.error("[generator] count_recent_generations failed", countError.code, countError.message);
    throw AppError.internal();
  }
  if (typeof recent === "number" && recent >= LIMITS.GENERATIONS_PER_HOUR) {
    throw AppError.rateLimited(
      `You can generate up to ${LIMITS.GENERATIONS_PER_HOUR} quizzes an hour. Please wait a little and try again.`,
    );
  }

  const { error: logError } = await admin.from("generation_requests").insert({ owner_id: userId });
  if (logError) {
    console.error("[generator] could not record generation request", logError.code, logError.message);
    throw AppError.internal();
  }
}

/** Calls the model until a reply passes the parser or the budget runs out. */
async function requestQuestions(text: string, questionCount: number): Promise<GeneratedQuestion[]> {
  const provider = getAiProvider();
  const prompt = buildPrompt(text, questionCount);
  const deadline = Date.now() + LIMITS.GENERATION_TIMEOUT_MS;
  let lastError: AppError = AppError.aiUnavailable();

  for (let attempt = 1; attempt <= 1 + LIMITS.GENERATION_MAX_RETRIES; attempt++) {
    const remaining = deadline - Date.now();
    if (attempt > 1 && remaining < MIN_ATTEMPT_MS) break;

    try {
      const raw = await provider.complete({ system: prompt.system, user: prompt.user, jsonMode: true, timeoutMs: remaining });
      return parseGeneratedQuiz(raw, prompt.mix);
    } catch (err) {
      if (err instanceof QuizOutputRejected) {
        console.error(`[generator] attempt ${attempt} rejected: ${err.reason}`);
      } else if (err instanceof AppError && (err.code === "AI_UNAVAILABLE" || err.code === "AI_BAD_OUTPUT")) {
        console.error(`[generator] attempt ${attempt} failed: ${err.code}`);
      } else {
        throw err;
      }
      lastError = err;
    }
  }
  throw lastError;
}

/** NFR-R2: the quiz and all its questions land together or not at all. */
async function saveQuiz(userId: string, textId: string, questions: GeneratedQuestion[]): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("create_quiz_with_questions", {
    p_owner_id: userId,
    p_text_id: textId,
    p_questions: questions,
  });

  if (error || typeof data !== "string") {
    console.error("[generator] create_quiz_with_questions failed", error?.code, error?.message);
    // P0002: the text was deleted while the model was writing.
    if (error?.code === "P0002") throw AppError.notFound("That study text");
    // 23514: the database rejected a question the parser let through — the two
    // have drifted apart. To the student it is still an unusable quiz.
    if (error?.code === "23514") throw AppError.aiBadOutput();
    throw AppError.internal("We couldn't save your quiz. Please try generating again.");
  }
  return data;
}

export async function generateQuiz(input: z.infer<typeof generateQuizSchema>): Promise<Quiz> {
  const user = await getCurrentUser();
  // Before the rate limit, so a stale or mistyped id doesn't cost quota.
  const text = await findOwnedText(user.userId, input.textId);
  await enforceRateLimit(user.userId);

  const questions = await requestQuestions(text.body, input.questionCount);
  const quizId = await saveQuiz(user.userId, text.textId, questions);

  const client = await createUserClient();
  const { data, error } = await client.from("quizzes").select(QUIZ_COLUMNS).eq("id", quizId).single<QuizRow>();
  if (error || !data) {
    // The quiz is saved; only the read-back failed. It will appear in the list.
    console.error("[generator] read-back of new quiz failed", quizId, error?.code, error?.message);
    throw AppError.internal("Your quiz was created but couldn't be loaded. Refresh the page to see it.");
  }
  return toQuiz(data, text.title);
}
