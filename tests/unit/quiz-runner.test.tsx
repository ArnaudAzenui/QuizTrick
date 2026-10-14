import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QuizRunner } from "@frontend/components/quiz/QuizRunner";
import { buildAttemptAnswers, countAnswered, isAnswered, optionLetter } from "@frontend/components/quiz/quiz-runner";
import TakeQuizPage from "@/app/(app)/quizzes/[id]/page";
import { LIMITS } from "@shared/constants";
import type { PublicQuestion } from "@shared/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }));

const mcq: PublicQuestion = { questionId: "q1", quizId: "z", position: 1, type: "mcq", text: "Where is ATP made?", options: ["Nucleus", "Mitochondria", "Ribosome", "Golgi"] };
const short: PublicQuestion = { questionId: "q2", quizId: "z", position: 2, type: "short_answer", text: "Name the final electron acceptor.", options: [] };
const questions = [mcq, short];

describe("isAnswered / countAnswered", () => {
  it("counts a chosen option and non-blank text, but not whitespace", () => {
    expect(isAnswered({ q1: "0" }, "q1")).toBe(true);
    expect(isAnswered({ q2: "   " }, "q2")).toBe(false);
    expect(isAnswered({}, "q1")).toBe(false);
    expect(countAnswered(questions, { q1: "1", q2: "oxygen" })).toBe(2);
    expect(countAnswered(questions, { q1: "1", q2: " " })).toBe(1);
  });
});

describe("buildAttemptAnswers (FR-4.3, docs/API.md)", () => {
  it("sends MCQ answers as the option index string and trims short answers", () => {
    expect(buildAttemptAnswers(questions, { q1: "1", q2: "  oxygen  " })).toEqual([
      { questionId: "q1", response: "1" },
      { questionId: "q2", response: "oxygen" },
    ]);
  });

  it("leaves unanswered questions out, since the server grades them as incorrect", () => {
    expect(buildAttemptAnswers(questions, { q2: "   " })).toEqual([]);
    expect(buildAttemptAnswers(questions, { q1: "3" })).toEqual([{ questionId: "q1", response: "3" }]);
  });

  it("caps a short answer at the API limit", () => {
    const [answer] = buildAttemptAnswers([short], { q2: "x".repeat(LIMITS.SHORT_ANSWER_RESPONSE_MAX + 50) });
    expect(answer.response).toHaveLength(LIMITS.SHORT_ANSWER_RESPONSE_MAX);
  });

  it("keeps question order and sends each question at most once", () => {
    const out = buildAttemptAnswers(questions, { q2: "water", q1: "0" });
    expect(out.map((a) => a.questionId)).toEqual(["q1", "q2"]);
  });
});

describe("optionLetter", () => {
  it("labels options A to D", () => {
    expect([0, 1, 2, 3].map(optionLetter)).toEqual(["A", "B", "C", "D"]);
  });
});

describe("take-quiz page (FR-4.1)", () => {
  it("replaces the placeholder and starts in a loading state", async () => {
    const html = renderToStaticMarkup(await TakeQuizPage({ params: Promise.resolve({ id: "abc" }) }));
    expect(html).toContain("Loading your quiz");
    expect(html).not.toContain("Coming soon");
  });

  it("renders the runner on its own", () => {
    expect(renderToStaticMarkup(<QuizRunner quizId="abc" />)).toContain('role="status"');
  });
});
