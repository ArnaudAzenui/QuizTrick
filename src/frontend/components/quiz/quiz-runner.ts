import { LIMITS, ROUTES } from "@shared/constants";
import type { AnswerInput, Attempt, PublicQuestion } from "@shared/types";

/** Answers in progress, keyed by question id (Arnaud's spec: "keep answers in state keyed by question id"). */
export type AnswerMap = Record<string, string>;

/** A question counts as answered once it has a choice, or non-blank short-answer text. */
export function isAnswered(answers: AnswerMap, questionId: string): boolean {
  return (answers[questionId] ?? "").trim().length > 0;
}

export function countAnswered(questions: PublicQuestion[], answers: AnswerMap): number {
  return questions.filter((q) => isAnswered(answers, q.questionId)).length;
}

/**
 * Builds the POST /api/quizzes/:id/attempts body (docs/API.md, FR-4.3).
 * MCQ answers are already the option index as a string ("0"-"3"). Short answers
 * are trimmed and capped at 200 characters. Unanswered questions are left out:
 * the server grades them as incorrect, so sending "" would add nothing.
 */
export function buildAttemptAnswers(questions: PublicQuestion[], answers: AnswerMap): AnswerInput[] {
  return questions
    .filter((q) => isAnswered(answers, q.questionId))
    .map((q) => {
      const raw = answers[q.questionId];
      const response = q.type === "short_answer" ? raw.trim().slice(0, LIMITS.SHORT_ANSWER_RESPONSE_MAX) : raw;
      return { questionId: q.questionId, response };
    });
}

/** "A", "B", "C", "D" for option labels. */
export function optionLetter(index: number): string {
  return String.fromCharCode(65 + index);
}

/**
 * Submits an attempt and returns the results page to open (FR-4.3, FR-4.6).
 * POST /api/quizzes/:id/attempts answers with the graded Attempt (201), and its
 * attemptId is what the results screen at /quizzes/[id]/results/[attemptId] loads.
 * `post` is the api client's post, passed in so this can be tested without a server.
 */
export async function submitAttempt(
  post: (path: string, body: unknown) => Promise<Attempt>,
  quizId: string,
  questions: PublicQuestion[],
  answers: AnswerMap,
  startedAt: string,
): Promise<string> {
  const attempt = await post(`/api/quizzes/${quizId}/attempts`, {
    startedAt: startedAt || undefined,
    answers: buildAttemptAnswers(questions, answers),
  });
  return ROUTES.results(quizId, attempt.attemptId);
}

/** What the leave-quiz guard needs to know about a click on a link. */
export type LinkClick = {
  href: string;
  target?: string | null;
  download?: boolean;
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
};

/**
 * True when a click on a link would take the student away from this quiz inside
 * the app (nav links, the logo, Back to my texts). beforeunload only covers reloads
 * and closing the tab, so in-app links need their own check. Clicks that open a new
 * tab or window, downloads, other sites, and links to this same page are left alone.
 */
export function leavesQuiz(click: LinkClick, currentUrl: string): boolean {
  if (click.button !== 0 || click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return false;
  if (click.download) return false;
  if (click.target && click.target !== "_self") return false;
  let to: URL;
  let here: URL;
  try {
    here = new URL(currentUrl);
    to = new URL(click.href, here);
  } catch {
    return false;
  }
  if (to.origin !== here.origin) return false;
  return to.pathname !== here.pathname || to.search !== here.search;
}
