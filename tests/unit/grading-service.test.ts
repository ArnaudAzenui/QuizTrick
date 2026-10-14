import { describe, expect, it } from "vitest";
import { calculateScore, gradeAttempt, isCorrect, normalizeAnswer } from "@backend/services/grading.service";
import { AppError } from "@backend/lib/errors";
import type { AnswerInput, Question } from "@shared/types";

const QUIZ_ID = "22222222-2222-4222-8222-222222222222";

function mcq(id: string, position: number, correctOption: number | null = 1): Question {
  return { questionId: id, quizId: QUIZ_ID, position, type: "mcq", text: `Q${position}?`, options: ["a", "b", "c", "d"], correctOption, expectedAnswer: null };
}

function shortAnswer(id: string, position: number, expectedAnswer: string | null): Question {
  return { questionId: id, quizId: QUIZ_ID, position, type: "short_answer", text: `S${position}?`, options: [], correctOption: null, expectedAnswer };
}

describe("normalizeAnswer (FR-4.4)", () => {
  it("lower-cases and trims", () => {
    expect(normalizeAnswer("  Paris ")).toBe("paris");
    expect(normalizeAnswer("MITOCHONDRIA")).toBe("mitochondria");
  });

  it("strips trailing sentence punctuation, so 'Paris.' matches 'paris'", () => {
    expect(normalizeAnswer("Paris.")).toBe("paris");
    expect(normalizeAnswer("Paris!")).toBe("paris");
    expect(normalizeAnswer("Paris?")).toBe("paris");
    expect(normalizeAnswer("Paris,")).toBe("paris");
    expect(normalizeAnswer("Paris;")).toBe("paris");
    expect(normalizeAnswer("Paris:")).toBe("paris");
    expect(normalizeAnswer("Paris…")).toBe("paris");
  });

  it("keeps stripping when punctuation and spaces alternate at the end", () => {
    expect(normalizeAnswer("Paris!. ")).toBe("paris");
    expect(normalizeAnswer("Paris . ! ")).toBe("paris");
    expect(normalizeAnswer("...")).toBe("");
  });

  it("leaves leading and inner punctuation alone", () => {
    expect(normalizeAnswer("3.14")).toBe("3.14");
    expect(normalizeAnswer("St. Louis")).toBe("st. louis");
    expect(normalizeAnswer("O'Brien")).toBe("o'brien");
    expect(normalizeAnswer("(Paris)")).toBe("(paris)");
    expect(normalizeAnswer("e-mail")).toBe("e-mail");
  });

  it("collapses runs of inner whitespace, including tabs and newlines", () => {
    expect(normalizeAnswer("New   York")).toBe("new york");
    expect(normalizeAnswer("New\tYork\n")).toBe("new york");
  });

  it("treats null, undefined and blank input as empty", () => {
    expect(normalizeAnswer(null)).toBe("");
    expect(normalizeAnswer(undefined)).toBe("");
    expect(normalizeAnswer("   ")).toBe("");
  });

  it("is idempotent", () => {
    for (const s of ["Paris.", "  New  York!! ", "3.14", "..."]) {
      expect(normalizeAnswer(normalizeAnswer(s))).toBe(normalizeAnswer(s));
    }
  });
});

describe("isCorrect — multiple choice (FR-4.3)", () => {
  const q = mcq("q-1", 1, 2);

  it("matches the correct option index given as a string", () => {
    expect(isCorrect(q, "2")).toBe(true);
    expect(isCorrect(q, "0")).toBe(false);
    expect(isCorrect(q, "1")).toBe(false);
    expect(isCorrect(q, "3")).toBe(false);
  });

  it("ignores surrounding whitespace but nothing else", () => {
    expect(isCorrect(q, " 2 ")).toBe(true);
    expect(isCorrect(q, "02")).toBe(false);
    expect(isCorrect(q, "2.")).toBe(false);
    expect(isCorrect(q, "c")).toBe(false);
    expect(isCorrect(q, "C")).toBe(false);
  });

  it("accepts option 0 as a real answer", () => {
    expect(isCorrect(mcq("q-0", 1, 0), "0")).toBe(true);
  });

  it("is never correct when unanswered", () => {
    expect(isCorrect(q, "")).toBe(false);
    expect(isCorrect(q, "   ")).toBe(false);
    expect(isCorrect(q, null)).toBe(false);
    expect(isCorrect(q, undefined)).toBe(false);
  });

  it("is never correct when the question has no answer key", () => {
    expect(isCorrect(mcq("q-x", 1, null), "0")).toBe(false);
    expect(isCorrect(mcq("q-x", 1, null), "")).toBe(false);
  });
});

describe("isCorrect — short answer (FR-4.4)", () => {
  const q = shortAnswer("q-2", 2, "Paris");

  it("compares normalized text, so case and trailing punctuation don't matter", () => {
    expect(isCorrect(q, "Paris")).toBe(true);
    expect(isCorrect(q, "paris")).toBe(true);
    expect(isCorrect(q, "PARIS")).toBe(true);
    expect(isCorrect(q, "Paris.")).toBe(true);
    expect(isCorrect(q, "  paris!  ")).toBe(true);
  });

  it("normalizes the answer key too", () => {
    expect(isCorrect(shortAnswer("q-k", 1, "  Mitochondria. "), "mitochondria")).toBe(true);
    expect(isCorrect(shortAnswer("q-k", 1, "New  York"), "new york")).toBe(true);
  });

  it("rejects different, partial or padded text", () => {
    expect(isCorrect(q, "London")).toBe(false);
    expect(isCorrect(q, "Par")).toBe(false);
    expect(isCorrect(q, "Paris France")).toBe(false);
    expect(isCorrect(q, "The answer is Paris")).toBe(false);
  });

  it("is never correct when unanswered", () => {
    expect(isCorrect(q, "")).toBe(false);
    expect(isCorrect(q, "   ")).toBe(false);
    expect(isCorrect(q, ".")).toBe(false);
    expect(isCorrect(q, null)).toBe(false);
    expect(isCorrect(q, undefined)).toBe(false);
  });

  it("is never correct when the key is missing or blank, even for a blank response", () => {
    expect(isCorrect(shortAnswer("q-n", 1, null), "")).toBe(false);
    expect(isCorrect(shortAnswer("q-n", 1, null), "anything")).toBe(false);
    expect(isCorrect(shortAnswer("q-b", 1, "   "), "")).toBe(false);
    expect(isCorrect(shortAnswer("q-b", 1, "..."), "...")).toBe(false);
  });

  it("does not let an MCQ-style index match a short-answer key", () => {
    expect(isCorrect(shortAnswer("q-d", 1, "Paris"), "1")).toBe(false);
  });
});

describe("calculateScore (FR-4.5)", () => {
  it("returns an integer percent", () => {
    expect(calculateScore(0, 10)).toBe(0);
    expect(calculateScore(10, 10)).toBe(100);
    expect(calculateScore(7, 10)).toBe(70);
    expect(calculateScore(3, 5)).toBe(60);
    expect(calculateScore(11, 15)).toBe(73);
  });

  it("rounds to the nearest whole number", () => {
    expect(calculateScore(2, 3)).toBe(67);
    expect(calculateScore(1, 3)).toBe(33);
    expect(calculateScore(1, 8)).toBe(13);
    expect(calculateScore(1, 6)).toBe(17);
  });

  it("scores an empty quiz as 0 instead of dividing by zero", () => {
    expect(calculateScore(0, 0)).toBe(0);
    expect(calculateScore(3, 0)).toBe(0);
  });

  it("stays inside the database's 0-100 check for bad input", () => {
    expect(calculateScore(-1, 10)).toBe(0);
    expect(calculateScore(12, 10)).toBe(100);
    expect(calculateScore(Number.NaN, 10)).toBe(0);
    expect(calculateScore(5, Number.POSITIVE_INFINITY)).toBe(0);
    expect(calculateScore(5, -5)).toBe(0);
  });

  it("only ever returns an integer, over every count a quiz can have", () => {
    for (let total = 1; total <= 30; total++) {
      for (let correct = 0; correct <= total; correct++) {
        const score = calculateScore(correct, total);
        expect(Number.isInteger(score)).toBe(true);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe("gradeAttempt (FR-4.5)", () => {
  const questions: Question[] = [
    mcq("q-1", 1, 0),
    mcq("q-2", 2, 3),
    shortAnswer("q-3", 3, "Mitochondria"),
    shortAnswer("q-4", 4, "oxygen"),
    mcq("q-5", 5, 1),
  ];

  it("grades every question and scores the attempt", () => {
    const answers: AnswerInput[] = [
      { questionId: "q-1", response: "0" }, // right
      { questionId: "q-2", response: "1" }, // wrong
      { questionId: "q-3", response: "mitochondria." }, // right
      { questionId: "q-4", response: "carbon dioxide" }, // wrong
      { questionId: "q-5", response: "1" }, // right
    ];
    const result = gradeAttempt(questions, answers);
    expect(result.answers.map((a) => a.isCorrect)).toEqual([true, false, true, false, true]);
    expect(result.correctCount).toBe(3);
    expect(result.totalCount).toBe(5);
    expect(result.score).toBe(60);
  });

  it("returns exactly one record per question, in question order, whatever order the answers arrive in", () => {
    const answers: AnswerInput[] = [
      { questionId: "q-5", response: "1" },
      { questionId: "q-1", response: "0" },
      { questionId: "q-3", response: "Mitochondria" },
    ];
    const result = gradeAttempt(questions, answers);
    expect(result.answers).toHaveLength(questions.length);
    expect(result.answers.map((a) => a.questionId)).toEqual(["q-1", "q-2", "q-3", "q-4", "q-5"]);
  });

  it("grades unanswered questions as incorrect with an empty response", () => {
    const result = gradeAttempt(questions, [{ questionId: "q-1", response: "0" }]);
    expect(result.answers[1]).toEqual({ questionId: "q-2", response: "", isCorrect: false });
    expect(result.answers[3]).toEqual({ questionId: "q-4", response: "", isCorrect: false });
    expect(result.correctCount).toBe(1);
    expect(result.score).toBe(20);
  });

  it("keeps the student's response exactly as submitted", () => {
    const result = gradeAttempt(questions, [{ questionId: "q-3", response: "  MITOCHONDRIA! " }]);
    expect(result.answers[2]).toEqual({ questionId: "q-3", response: "  MITOCHONDRIA! ", isCorrect: true });
  });

  it("handles an empty submission: all incorrect, score 0", () => {
    const result = gradeAttempt(questions, []);
    expect(result.answers.every((a) => a.response === "" && !a.isCorrect)).toBe(true);
    expect(result.correctCount).toBe(0);
    expect(result.score).toBe(0);
  });

  it("handles a quiz with no questions without dividing by zero", () => {
    expect(gradeAttempt([], [])).toEqual({ answers: [], correctCount: 0, totalCount: 0, score: 0 });
  });

  it("scores 100 when everything is right", () => {
    const result = gradeAttempt(questions, [
      { questionId: "q-1", response: "0" },
      { questionId: "q-2", response: "3" },
      { questionId: "q-3", response: "mitochondria" },
      { questionId: "q-4", response: "Oxygen." },
      { questionId: "q-5", response: "1" },
    ]);
    expect(result.score).toBe(100);
    expect(result.correctCount).toBe(5);
  });

  it("matches question ids case-insensitively, the way submitAttemptSchema lower-cases them", () => {
    const upper: Question[] = [mcq("ABCDEF00-0000-4000-8000-000000000001", 1, 2)];
    const result = gradeAttempt(upper, [{ questionId: "abcdef00-0000-4000-8000-000000000001", response: "2" }]);
    expect(result.answers[0]).toEqual({ questionId: "ABCDEF00-0000-4000-8000-000000000001", response: "2", isCorrect: true });
  });

  it("counts the first answer when a question id is repeated", () => {
    const result = gradeAttempt(questions, [
      { questionId: "q-1", response: "0" },
      { questionId: "q-1", response: "3" },
    ]);
    expect(result.answers).toHaveLength(questions.length);
    expect(result.answers[0]).toEqual({ questionId: "q-1", response: "0", isCorrect: true });
  });

  it("rejects an answer for a question that is not in the quiz as a validation error", () => {
    let caught: unknown;
    try {
      gradeAttempt(questions, [{ questionId: "q-1", response: "0" }, { questionId: "q-99", response: "0" }]);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(AppError);
    expect((caught as AppError).code).toBe("VALIDATION");
    expect((caught as AppError).status).toBe(400);
  });

  it("does not mutate its inputs", () => {
    const qs = structuredClone(questions);
    const answers: AnswerInput[] = [{ questionId: "q-3", response: "Mitochondria." }];
    const before = structuredClone(answers);
    gradeAttempt(qs, answers);
    expect(qs).toEqual(questions);
    expect(answers).toEqual(before);
  });

  it("never awards a question whose answer key is missing", () => {
    const broken: Question[] = [mcq("b-1", 1, null), shortAnswer("b-2", 2, null)];
    const result = gradeAttempt(broken, [
      { questionId: "b-1", response: "0" },
      { questionId: "b-2", response: "" },
    ]);
    expect(result.answers.map((a) => a.isCorrect)).toEqual([false, false]);
    expect(result.score).toBe(0);
  });
});
