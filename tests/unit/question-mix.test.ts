import { describe, expect, it } from "vitest";
import { generateQuizSchema } from "@backend/validation/schemas";
import { buildPrompt } from "@backend/services/quiz-generator/prompt";
import { parseGeneratedQuiz } from "@backend/services/quiz-generator/parser";
import { reviewAnswer } from "@frontend/components/quiz/QuizResults";
import { isCorrect } from "@backend/services/grading.service";

const textId = "11111111-1111-4111-8111-111111111111";
const statement = { type: "true_false", text: "Water contains oxygen.", options: ["True", "False"], correctOption: 0 };
const parse = (questions: unknown[], trueFalse = 1) => parseGeneratedQuiz(JSON.stringify({ questions }), { mcq: 0, shortAnswer: 0, trueFalse });

describe("custom question counts", () => {
  it("allows mixed quizzes and quizzes with a single type", () => {
    for (const questionMix of [
      { mcq: 2, trueFalse: 2, shortAnswer: 1 },
      { mcq: 0, trueFalse: 5, shortAnswer: 0 },
      { mcq: 5, trueFalse: 0, shortAnswer: 0 },
      { mcq: 0, trueFalse: 0, shortAnswer: 5 },
    ]) {
      expect(generateQuizSchema.safeParse({ textId, questionCount: 5, questionMix }).success).toBe(true);
    }
  });

  it.each([
    { mcq: 1, trueFalse: 1, shortAnswer: 1 },
    { mcq: -1, trueFalse: 6, shortAnswer: 0 },
    { mcq: 0.5, trueFalse: 4.5, shortAnswer: 0 },
    { mcq: 0, trueFalse: 0, shortAnswer: 0 },
    { mcq: 5, shortAnswer: 0 },
  ])("rejects invalid counts %j", questionMix => {
    expect(generateQuizSchema.safeParse({ textId, questionCount: 5, questionMix }).success).toBe(false);
  });

  it("uses the requested counts in the model instructions", () => {
    const mix = { mcq: 1, trueFalse: 3, shortAnswer: 1 };
    const prompt = buildPrompt("Notes", 5, mix);
    expect(prompt.mix).toEqual(mix);
    expect(prompt.system).toContain("exactly 3 true/false");
    expect(prompt.system).toContain("exactly 1 multiple-choice");
    expect(prompt.system).toContain("exactly 1 short-answer");
  });
});

describe("true/false generation and grading", () => {
  it("stores true/false as a choice question using the existing grader", () => {
    const [question] = parse([statement]);
    expect(question).toMatchObject({ type: "mcq", options: ["True", "False"], correct_option: 0 });
    const key = { type: question.type, correctOption: question.correct_option, expectedAnswer: null };
    expect(isCorrect(key, "0")).toBe(true);
    expect(isCorrect(key, "1")).toBe(false);
    expect(isCorrect(key, "")).toBe(false);
  });

  it("grades False as option 1", () => {
    const [question] = parse([{ ...statement, correctOption: 1 }]);
    expect(isCorrect({ type: question.type, correctOption: question.correct_option, expectedAnswer: null }, "1")).toBe(true);
  });

  it.each([
    { ...statement, correctOption: 2 },
    { ...statement, options: ["Yes", "No"] },
    { ...statement, options: ["False", "True"] },
    { ...statement, options: ["True", "False", "Maybe"] },
  ])("rejects malformed true/false questions", question => {
    expect(() => parse([question])).toThrow();
  });

  it("requires enough questions of each type and trims extras", () => {
    expect(() => parse([statement], 2)).toThrow();
    expect(parse([statement, { ...statement, text: "A second statement." }])).toHaveLength(1);
    expect(() => parseGeneratedQuiz(JSON.stringify({ questions: [statement] }), { mcq: 1, shortAnswer: 0, trueFalse: 0 })).toThrow();
  });
});

it("shows true/false answers without letter prefixes in reviews", () => {
  const question = {
    questionId: "q", quizId: "z", position: 1, type: "mcq" as const,
    text: "Statement", options: ["True", "False"], correctOption: 1, expectedAnswer: null,
  };
  expect(reviewAnswer(question, "0")).toBe("True");
  expect(reviewAnswer(question, "1")).toBe("False");
  expect(reviewAnswer(question, "")).toBe("Not answered");
});
