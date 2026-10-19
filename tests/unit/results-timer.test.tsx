import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ResultsReview, reviewAnswer } from "@frontend/components/quiz/QuizResults";
import { elapsedMilliseconds, finishSession, MAX_TIMER_MS } from "@frontend/components/timer/timer";
import { TimerProvider } from "@frontend/components/timer/TimerProvider";
import { StudyTimer } from "@frontend/components/timer/StudyTimer";
import type { AttemptReview, Question } from "@shared/types";

const question: Question = { questionId: "q1", quizId: "quiz1", position: 1, type: "mcq", text: "Capital of France?", options: ["Paris", "Rome", "Lima", "Oslo"], correctOption: 0, expectedAnswer: null };
const start = "2026-10-19T12:00:00.000Z";

describe("results review", () => {
  it("shows option text, unanswered responses and short answers safely", () => {
    expect(reviewAnswer(question, "0")).toBe("A. Paris");
    expect(reviewAnswer(question, "")).toBe("Not answered");
    expect(reviewAnswer(question, "9")).toBe("Invalid answer");
    expect(reviewAnswer({ ...question, type: "short_answer" }, "Paris.")).toBe("Paris.");
  });
  it("uses the server grade and score, sorts questions, and shows both answers", () => {
    const data: AttemptReview = {
      attempt: { attemptId: "attempt1", quizId: "quiz1", ownerId: "user1", startedAt: start, submittedAt: start, score: 50 },
      quiz: { quizId: "quiz1", textId: "text1", ownerId: "user1", title: "Geography", questionCount: 2, createdAt: start },
      items: [
        { question: { ...question, questionId: "q2", position: 2, type: "short_answer", text: "Name a city", expectedAnswer: "Paris", correctOption: null, options: [] }, response: "", isCorrect: false },
        { question, response: "0", isCorrect: true },
      ],
    };
    const html = renderToStaticMarkup(<ResultsReview data={data} />);
    expect(html).toContain("50%");
    expect(html).toContain("Correct");
    expect(html).toContain("Incorrect");
    expect(html).toContain("Not answered");
    expect(html).toContain("A. Paris");
    expect(html.indexOf("Capital of France?")).toBeLessThan(html.indexOf("Name a city"));
    expect(html).toContain("/quizzes/quiz1");
  });
});

describe("study timer contract", () => {
  it("accounts for time passing while ticks are suspended", () => {
    expect(elapsedMilliseconds(start, Date.parse(start) + 7265000)).toBe(7265000);
  });
  it("keeps timestamps fixed for retries and omits client duration and empty task", () => {
    expect(finishSession(start, Date.parse(start) + 65000, "")).toEqual({ startTime: start, endTime: "2026-10-19T12:01:05.000Z" });
    expect(finishSession(start, Date.parse(start) + 65000, "task1")).toEqual({ startTime: start, endTime: "2026-10-19T12:01:05.000Z", taskId: "task1" });
  });
  it("keeps sessions within the API 24 hour maximum and handles backward clock changes", () => {
    expect(elapsedMilliseconds(start, Date.parse(start) - 1000)).toBe(0);
    const session = finishSession(start, Date.parse(start) + MAX_TIMER_MS + 9000, "");
    expect(Date.parse(session.endTime) - Date.parse(start)).toBe(MAX_TIMER_MS);
  });
  it("renders accessible controls and an initial h:mm:ss display", () => {
    const html = renderToStaticMarkup(<TimerProvider><StudyTimer /></TimerProvider>);
    expect(html).toContain('role="timer"');
    expect(html).toContain("0:00:00");
    expect(html).toContain(">Start</button>");
    expect(html).toContain(">Stop</button>");
    expect(html).toContain(">Reset</button>");
    expect(html).toContain('for="timer-task"');
  });
});
