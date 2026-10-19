import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { AttemptReview, HistoryEntry } from "@shared/types";
import { HistoryAttempt, IncorrectAnswers } from "@frontend/components/history/ScoreHistory";

const mocks = vi.hoisted(() => ({ user: vi.fn(), from: vi.fn(), select: vi.fn(), eq: vi.fn(), order: vi.fn(), returns: vi.fn() }));
vi.mock("@backend/services/auth.service", () => ({ getCurrentUser: mocks.user }));
vi.mock("@backend/supabase/server", () => ({ createUserClient: async () => mocks }));
import { attemptDurationSeconds, listHistory } from "@backend/services/history.service";
import { GET } from "@/app/api/history/route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.mockResolvedValue({ userId: "user1" });
  for (const method of ["from", "select", "eq", "order"] as const) mocks[method].mockReturnValue(mocks);
});

const row = (id: string, quiz: string, score: number) => ({ id, quiz_id: quiz, score, started_at: "2026-10-19T11:55:00Z", submitted_at: "2026-10-19T12:00:00Z", quizzes: { study_texts: { title: "Biology" } } });

describe("history API", () => {
  it("reads saved scores for the current user, newest first, and flags tied best scores per quiz", async () => {
    mocks.returns.mockResolvedValue({ data: [row("a", "quiz1", 40), row("b", "quiz1", 80), row("c", "quiz1", 80), row("d", "quiz2", 0)], error: null });
    const history = await listHistory();
    expect(mocks.from).toHaveBeenCalledWith("attempts");
    expect(mocks.eq).toHaveBeenCalledWith("owner_id", "user1");
    expect(mocks.order).toHaveBeenCalledWith("submitted_at", { ascending: false });
    expect(history.map(entry => entry.isBest)).toEqual([false, true, true, true]);
    expect(history[0]).toEqual({ attemptId: "a", quizId: "quiz1", quizTitle: "Biology", score: 40, durationSeconds: 300, submittedAt: "2026-10-19T12:00:00Z", isBest: false });
  });
  it("returns an empty list when no attempts exist", async () => {
    mocks.returns.mockResolvedValue({ data: null, error: null });
    expect(await listHistory()).toEqual([]);
  });
  it("returns the API envelope", async () => {
    mocks.returns.mockResolvedValue({ data: [], error: null });
    const response = await GET(new Request("http://localhost/api/history"), undefined);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, data: [] });
  });
  it("does not query attempts before authentication succeeds", async () => {
    mocks.user.mockRejectedValue(new Error("No session"));
    await expect(listHistory()).rejects.toThrow("No session");
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("hides database details when reading fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.returns.mockResolvedValue({ data: null, error: { code: "DB", message: "private database details" } });
    try { await expect(listHistory()).rejects.toThrow("We couldn't load your score history."); }
    finally { log.mockRestore(); }
  });
});

describe("history review", () => {
  const question = { quizId: "quiz1", options: [], correctOption: null, expectedAnswer: null };
  const review: AttemptReview = {
    attempt: { attemptId: "a", quizId: "quiz1", ownerId: "user1", startedAt: "2026-10-19T12:00:00Z", submittedAt: "2026-10-19T12:01:00Z", score: 33 },
    quiz: { quizId: "quiz1", textId: "text1", ownerId: "user1", title: "Biology", questionCount: 3, createdAt: "2026-10-19T12:00:00Z" },
    items: [
    { question: { ...question, questionId: "correct", position: 1, text: "Already correct", type: "short_answer", expectedAnswer: "yes" }, response: "yes", isCorrect: true },
    { question: { ...question, questionId: "wrong", position: 2, text: "Capital?", type: "mcq", options: ["Paris", "Rome", "Lima", "Oslo"], correctOption: 0 }, response: "1", isCorrect: false },
    { question: { ...question, questionId: "blank", position: 3, text: "Missing answer", type: "short_answer", expectedAnswer: "Oxygen" }, response: "", isCorrect: false },
  ] };

  it("shows only mistakes, with the student's answer, correct answer and unanswered questions", () => {
    const html = renderToStaticMarkup(<IncorrectAnswers review={review} />);
    expect(html).not.toContain("Already correct");
    expect(html).toContain("B. Rome");
    expect(html).toContain("A. Paris");
    expect(html).toContain("Not answered");
    expect(html).toContain("Oxygen");
    expect(html.indexOf("Capital?")).toBeLessThan(html.indexOf("Missing answer"));
  });
  it("acknowledges a perfect attempt", () => {
    expect(renderToStaticMarkup(<IncorrectAnswers review={{ ...review, items: [review.items[0]] }} />)).toContain("You got every question right");
  });
  it("provides an accessible collapsed entry with score, date and best-score badge", () => {
    const entry: HistoryEntry = { attemptId: "a", quizId: "q", quizTitle: "Biology", score: 80, durationSeconds: 300, submittedAt: "2026-10-19T12:00:00Z", isBest: true };
    const html = renderToStaticMarkup(<HistoryAttempt entry={entry} />);
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-controls="attempt-a"');
    expect(html).toContain('id="attempt-a"');
    expect(html).toContain("80%");
    expect(html).toContain("Quiz study time: 0:05:00");
    expect(html).toContain("Best score");
    expect(html).toContain("Biology");
  });
});

describe("quiz study duration", () => {
  it("derives elapsed whole seconds from saved attempt timestamps", () => {
    expect(attemptDurationSeconds("2026-10-19T12:00:00Z", "2026-10-19T12:05:30.900Z")).toBe(330);
    expect(attemptDurationSeconds("2026-10-19T12:00:00Z", "2026-10-19T12:00:00Z")).toBe(0);
  });
  it("marks invalid or reversed timestamps unavailable", () => {
    expect(attemptDurationSeconds("invalid", "2026-10-19T12:00:00Z")).toBeNull();
    expect(attemptDurationSeconds("2026-10-19T12:05:00Z", "2026-10-19T12:00:00Z")).toBeNull();
  });
});
