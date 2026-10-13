/**
 * Grading - pure functions, prime unit-test target (WBS 1.4.4.2, owner: Arnaud).
 *
 *   - normalizeAnswer - lowercase, trim, strip trailing punctuation (FR-4.4)
 *   - isCorrect(question, response) (FR-4.3, FR-4.4)
 *   - gradeAttempt(questions, answers) (FR-4.5)
 *   - calculateScore -> integer percent 0-100 (FR-4.5)
 *
 * Nothing here touches the database or the request. submitAttempt
 * (attempt.service.ts) loads the questions with their answer keys, calls
 * gradeAttempt, and hands the result to the submit_attempt RPC, which requires
 * exactly one record per question of the quiz. gradeAttempt therefore always
 * returns one record per question, in question order, with unanswered ones
 * graded as incorrect (docs/API.md).
 *
 * Errors: throw AppError (src/backend/lib/errors.ts); routes wrap handlers with handle() from lib/api.ts.
 */
import { AppError } from "@backend/lib/errors";
import type { AnswerInput, Question } from "@shared/types";

/** One graded answer, in the shape the submit_attempt RPC stores (answer_records). */
export interface GradedAnswer {
  questionId: string;
  /** The student's response as submitted; "" when the question was not answered. */
  response: string;
  isCorrect: boolean;
}

export interface GradedAttempt {
  /** One entry per question of the quiz, in question order. */
  answers: GradedAnswer[];
  correctCount: number;
  totalCount: number;
  /** Integer percent 0-100. */
  score: number;
}

/**
 * Sentence punctuation that a student may type after a short answer without
 * changing its meaning: "Paris." / "Paris!" / "Paris?" all mean "Paris".
 * Brackets and quotes are deliberately not here; "(Paris" is not an answer.
 */
const TRAILING_PUNCTUATION = /[.,;:!?…]+$/u;

/**
 * FR-4.4. Puts a short answer (or its key) into a comparable form: lower case,
 * surrounding whitespace removed, trailing punctuation removed, and runs of
 * inner whitespace collapsed to one space so "New  York" matches "new york".
 * Repeats until stable so "Paris!. " and "paris" meet in the middle.
 */
export function normalizeAnswer(raw: string | null | undefined): string {
  let value = (raw ?? "").toLowerCase().replace(/\s+/gu, " ").trim();
  for (;;) {
    const stripped = value.replace(TRAILING_PUNCTUATION, "").trimEnd();
    if (stripped === value) return value;
    value = stripped;
  }
}

/**
 * FR-4.3 / FR-4.4. Whether a response answers the question correctly.
 *
 * MCQ: the response is the option index as a string ("0"-"3", docs/API.md)
 * and must name exactly the correct option. Short answer: normalized text must
 * match the normalized key. A missing or blank response is never correct, and
 * a question with no answer key cannot be answered correctly either.
 */
export function isCorrect(question: Pick<Question, "type" | "correctOption" | "expectedAnswer">, response: string | null | undefined): boolean {
  if (response == null) return false;

  if (question.type === "mcq") {
    if (question.correctOption == null) return false;
    return response.trim() === String(question.correctOption);
  }

  const expected = normalizeAnswer(question.expectedAnswer);
  if (expected.length === 0) return false;
  return normalizeAnswer(response) === expected;
}

/**
 * FR-4.5. Integer percent of correct answers, 0-100, matching the
 * `score between 0 and 100` check on attempts. A quiz with no questions
 * scores 0 rather than dividing by zero.
 */
export function calculateScore(correctCount: number, totalCount: number): number {
  if (!Number.isFinite(correctCount) || !Number.isFinite(totalCount) || totalCount <= 0) return 0;
  const percent = Math.round((correctCount / totalCount) * 100);
  return Math.min(100, Math.max(0, percent));
}

/**
 * FR-4.5. Grades a whole submission against the quiz's questions.
 *
 * Returns exactly one record per question, in the order the questions were
 * given (position order when loaded from the database). A question with no
 * submitted answer gets response "" and isCorrect false. Question ids are
 * matched case-insensitively, which is how submitAttemptSchema already
 * lower-cases them; when the same question somehow appears twice, the first
 * answer counts.
 *
 * An answer naming a question that is not in `questions` is a VALIDATION
 * error: it means the client sent an id from another quiz (or an invented
 * one), and that should be a 400 here rather than a foreign-key failure
 * inside the RPC.
 */
export function gradeAttempt(questions: Question[], answers: AnswerInput[]): GradedAttempt {
  const known = new Set(questions.map((q) => q.questionId.toLowerCase()));
  const byQuestion = new Map<string, string>();
  for (const answer of answers) {
    const id = answer.questionId.toLowerCase();
    if (!known.has(id)) {
      throw AppError.validation("One of the answers does not belong to this quiz. Reload the quiz and try again.");
    }
    if (!byQuestion.has(id)) byQuestion.set(id, answer.response ?? "");
  }

  const graded = questions.map<GradedAnswer>((question) => {
    const response = byQuestion.get(question.questionId.toLowerCase()) ?? "";
    return { questionId: question.questionId, response, isCorrect: isCorrect(question, response) };
  });

  const correctCount = graded.filter((a) => a.isCorrect).length;
  return { answers: graded, correctCount, totalCount: questions.length, score: calculateScore(correctCount, questions.length) };
}
