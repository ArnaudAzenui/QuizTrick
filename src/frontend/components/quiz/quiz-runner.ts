import { LIMITS } from "@shared/constants";
import type { AnswerInput, PublicQuestion } from "@shared/types";

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
