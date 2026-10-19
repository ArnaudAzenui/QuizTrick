import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ getUser: vi.fn() }));

/** Chainable stand-in for the user client's query builder; maybeSingle is the terminal call. */
const query = vi.hoisted(() => ({ from: vi.fn(), select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() }));
/** The admin client reads `questions` and `answer_records` (returns) and calls the RPC. */
const admin = vi.hoisted(() => ({ from: vi.fn(), select: vi.fn(), eq: vi.fn(), order: vi.fn(), returns: vi.fn(), rpc: vi.fn() }));

vi.mock("@backend/supabase/server", () => ({ createUserClient: async () => ({ auth, from: query.from }) }));
vi.mock("@backend/supabase/admin", () => ({ createAdminClient: () => ({ from: admin.from, rpc: admin.rpc }) }));

import { getAttemptReview, submitAttempt } from "@backend/services/attempt.service";
import { POST } from "@/app/api/quizzes/[id]/attempts/route";
import { GET } from "@/app/api/attempts/[id]/route";
import { AppError } from "@backend/lib/errors";

const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
afterAll(() => quiet.mockRestore());

const QUIZ_ID = "22222222-2222-4222-8222-222222222222";
const TEXT_ID = "11111111-1111-4111-8111-111111111111";
const ATTEMPT_ID = "33333333-3333-4333-8333-333333333333";
const Q1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const Q2 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";
const Q3 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3";

const quizRow = { id: QUIZ_ID, owner_id: "user-1", text_id: TEXT_ID, question_count: 3, created_at: "2026-10-04T00:00:00Z", study_texts: { title: "Cells" } };
const attemptRow = { id: ATTEMPT_ID, owner_id: "user-1", quiz_id: QUIZ_ID, started_at: "2026-10-18T10:00:00Z", submitted_at: "2026-10-18T10:05:00Z", score: 67 };
const questionRows = [
  { id: Q1, quiz_id: QUIZ_ID, position: 1, type: "mcq", text: "Where is ATP made?", options: ["Nucleus", "Mitochondria", "Ribosome", "Golgi"], correct_option: 1, expected_answer: null },
  { id: Q2, quiz_id: QUIZ_ID, position: 2, type: "short_answer", text: "Final electron acceptor?", options: [], correct_option: null, expected_answer: "Oxygen" },
  { id: Q3, quiz_id: QUIZ_ID, position: 3, type: "mcq", text: "Prokaryote DNA region?", options: ["Nucleus", "Nucleoid", "Vacuole", "Lysosome"], correct_option: 1, expected_answer: null },
];
const answerRows = [
  { id: "r-1", attempt_id: ATTEMPT_ID, question_id: Q1, response: "1", is_correct: true },
  { id: "r-2", attempt_id: ATTEMPT_ID, question_id: Q2, response: "oxygen.", is_correct: true },
  { id: "r-3", attempt_id: ATTEMPT_ID, question_id: Q3, response: "", is_correct: false },
];

async function caught(p: Promise<unknown>): Promise<AppError> {
  try {
    await p;
  } catch (err) {
    expect(err).toBeInstanceOf(AppError);
    return err as AppError;
  }
  throw new Error("expected the call to throw");
}

function post(body: unknown) {
  return POST(new Request(`http://localhost/api/quizzes/${QUIZ_ID}/attempts`, { method: "POST", body: JSON.stringify(body) }), {
    params: Promise.resolve({ id: QUIZ_ID }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const step of ["from", "select", "eq"] as const) query[step].mockImplementation(() => query);
  for (const step of ["from", "select", "eq", "order"] as const) admin[step].mockImplementation(() => admin);
  auth.getUser.mockResolvedValue({ data: { user: { id: "user-1", email: "s@school.edu" } }, error: null });
  admin.returns.mockResolvedValue({ data: questionRows, error: null });
  admin.rpc.mockResolvedValue({ data: ATTEMPT_ID, error: null });
});

describe("submitAttempt (FR-4.3 - FR-4.5, NFR-R3)", () => {
  beforeEach(() => {
    // 1st maybeSingle: the quiz ownership check. 2nd: reading the stored attempt back.
    query.maybeSingle.mockResolvedValueOnce({ data: { id: QUIZ_ID }, error: null }).mockResolvedValueOnce({ data: attemptRow, error: null });
  });

  it("grades with the answer keys and stores one record per question through the RPC", async () => {
    const attempt = await submitAttempt(QUIZ_ID, {
      startedAt: "2026-10-18T10:00:00Z",
      answers: [
        { questionId: Q1, response: "1" },
        { questionId: Q2, response: "Oxygen." },
        { questionId: Q3, response: "0" },
      ],
    });

    expect(admin.rpc).toHaveBeenCalledWith("submit_attempt", {
      p_owner_id: "user-1",
      p_quiz_id: QUIZ_ID,
      p_started_at: "2026-10-18T10:00:00Z",
      p_score: 67,
      p_answers: [
        { question_id: Q1, response: "1", is_correct: true },
        { question_id: Q2, response: "Oxygen.", is_correct: true },
        { question_id: Q3, response: "0", is_correct: false },
      ],
    });
    expect(attempt).toEqual({ attemptId: ATTEMPT_ID, ownerId: "user-1", quizId: QUIZ_ID, startedAt: attemptRow.started_at, submittedAt: attemptRow.submitted_at, score: 67 });
  });

  it("passes unanswered questions as empty, incorrect records so the RPC's one-per-question rule holds", async () => {
    await submitAttempt(QUIZ_ID, { answers: [{ questionId: Q2, response: "oxygen" }] });

    const payload = admin.rpc.mock.calls[0][1] as { p_answers: unknown[]; p_score: number; p_started_at: unknown };
    expect(payload.p_answers).toEqual([
      { question_id: Q1, response: "", is_correct: false },
      { question_id: Q2, response: "oxygen", is_correct: true },
      { question_id: Q3, response: "", is_correct: false },
    ]);
    expect(payload.p_score).toBe(33);
    expect(payload.p_started_at).toBeNull();
  });

  it("reads the questions with their keys through the admin client, in position order", async () => {
    await submitAttempt(QUIZ_ID, { answers: [{ questionId: Q1, response: "1" }] });

    expect(admin.from).toHaveBeenCalledWith("questions");
    expect(admin.select.mock.calls[0][0]).toMatch(/correct_option/);
    expect(admin.select.mock.calls[0][0]).toMatch(/expected_answer/);
    expect(admin.eq).toHaveBeenCalledWith("quiz_id", QUIZ_ID);
    expect(admin.order).toHaveBeenCalledWith("position", { ascending: true });
  });

  it("checks ownership through the user client before touching the admin client", async () => {
    await submitAttempt(QUIZ_ID, { answers: [{ questionId: Q1, response: "1" }] });

    expect(query.from).toHaveBeenCalledWith("quizzes");
    expect(query.eq).toHaveBeenCalledWith("owner_id", "user-1");
    expect(query.maybeSingle.mock.invocationCallOrder[0]).toBeLessThan(admin.from.mock.invocationCallOrder[0]);
  });

  it("treats a malformed quiz id as NOT_FOUND without querying the database", async () => {
    query.maybeSingle.mockReset();
    const err = await caught(submitAttempt("not-a-uuid", { answers: [{ questionId: Q1, response: "1" }] }));

    expect(err.code).toBe("NOT_FOUND");
    expect(query.from).not.toHaveBeenCalled();
    expect(admin.from).not.toHaveBeenCalled();
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("treats someone else's quiz as NOT_FOUND and never reads its answer keys", async () => {
    query.maybeSingle.mockReset().mockResolvedValue({ data: null, error: null });
    const err = await caught(submitAttempt(QUIZ_ID, { answers: [{ questionId: Q1, response: "1" }] }));

    expect(err.code).toBe("NOT_FOUND");
    expect(err.status).toBe(404);
    expect(admin.from).not.toHaveBeenCalled();
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("rejects an answer for a question outside the quiz before anything is stored", async () => {
    const err = await caught(submitAttempt(QUIZ_ID, { answers: [{ questionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", response: "1" }] }));

    expect(err.code).toBe("VALIDATION");
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("maps the RPC's documented errors: P0002 -> NOT_FOUND, 23514 / 23503 -> VALIDATION, anything else -> INTERNAL", async () => {
    const answers = [{ questionId: Q1, response: "1" }];

    admin.rpc.mockResolvedValueOnce({ data: null, error: { code: "P0002", message: "quiz not found for owner" } });
    expect((await caught(submitAttempt(QUIZ_ID, { answers }))).code).toBe("NOT_FOUND");

    query.maybeSingle.mockReset().mockResolvedValue({ data: { id: QUIZ_ID }, error: null });
    admin.rpc.mockResolvedValueOnce({ data: null, error: { code: "23514", message: "expected 3 answer records" } });
    expect((await caught(submitAttempt(QUIZ_ID, { answers }))).code).toBe("VALIDATION");

    admin.rpc.mockResolvedValueOnce({ data: null, error: { code: "23503", message: "outside this quiz" } });
    expect((await caught(submitAttempt(QUIZ_ID, { answers }))).code).toBe("VALIDATION");

    admin.rpc.mockResolvedValueOnce({ data: null, error: { code: "XX000", message: "disk on fire" } });
    const err = await caught(submitAttempt(QUIZ_ID, { answers }));
    expect(err.code).toBe("INTERNAL");
    expect(err.message).not.toContain("disk");
  });

  it("tells the student the attempt was saved when only the read-back fails", async () => {
    query.maybeSingle.mockReset().mockResolvedValueOnce({ data: { id: QUIZ_ID }, error: null }).mockResolvedValueOnce({ data: null, error: null });
    const err = await caught(submitAttempt(QUIZ_ID, { answers: [{ questionId: Q1, response: "1" }] }));

    expect(err.code).toBe("INTERNAL");
    expect(err.message).toMatch(/submitted/);
    expect(admin.rpc).toHaveBeenCalledTimes(1);
  });

  it("POST /api/quizzes/:id/attempts returns 201 with the Attempt and no answer key", async () => {
    const res = await post({ answers: [{ questionId: Q1, response: "1" }, { questionId: Q2, response: "oxygen" }] });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data).toMatchObject({ attemptId: ATTEMPT_ID, quizId: QUIZ_ID, score: 67 });
    expect(JSON.stringify(json)).not.toMatch(/correct_option|expected_answer|correctOption|expectedAnswer|Oxygen/);
  });

  it("POST drops a startedAt from the future rather than rejecting the submission", async () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const res = await post({ startedAt: future, answers: [{ questionId: Q1, response: "1" }] });

    expect(res.status).toBe(201);
    expect((admin.rpc.mock.calls[0][1] as { p_started_at: unknown }).p_started_at).toBeNull();
  });

  it("POST rejects a malformed body with VALIDATION before any lookup", async () => {
    query.maybeSingle.mockReset();
    const res = await post({ answers: [{ questionId: Q1, response: "1" }, { questionId: Q1, response: "2" }] });

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION");
    expect(query.from).not.toHaveBeenCalled();
    expect(admin.rpc).not.toHaveBeenCalled();
  });
});

describe("getAttemptReview (FR-4.6)", () => {
  beforeEach(() => {
    // 1st maybeSingle: the attempt. 2nd: its quiz with the text title.
    query.maybeSingle.mockResolvedValueOnce({ data: attemptRow, error: null }).mockResolvedValueOnce({ data: quizRow, error: null });
    // 1st returns: questions with keys. 2nd: the answer records.
    admin.returns.mockReset().mockResolvedValueOnce({ data: questionRows, error: null }).mockResolvedValueOnce({ data: answerRows, error: null });
  });

  it("returns the attempt, the titled quiz, and every question with its key, response and isCorrect", async () => {
    const review = await getAttemptReview(ATTEMPT_ID);

    expect(review.attempt).toEqual({ attemptId: ATTEMPT_ID, ownerId: "user-1", quizId: QUIZ_ID, startedAt: attemptRow.started_at, submittedAt: attemptRow.submitted_at, score: 67 });
    expect(review.quiz).toEqual({ quizId: QUIZ_ID, ownerId: "user-1", textId: TEXT_ID, questionCount: 3, createdAt: quizRow.created_at, title: "Cells" });
    expect(review.items.map((i) => i.question.questionId)).toEqual([Q1, Q2, Q3]);
    expect(review.items[0]).toEqual({
      question: { questionId: Q1, quizId: QUIZ_ID, position: 1, type: "mcq", text: "Where is ATP made?", options: ["Nucleus", "Mitochondria", "Ribosome", "Golgi"], correctOption: 1, expectedAnswer: null },
      response: "1",
      isCorrect: true,
    });
    expect(review.items[1]).toMatchObject({ question: { expectedAnswer: "Oxygen" }, response: "oxygen.", isCorrect: true });
    expect(review.items[2]).toMatchObject({ response: "", isCorrect: false });
  });

  it("shows a question with no stored record as unanswered instead of failing", async () => {
    admin.returns.mockReset().mockResolvedValueOnce({ data: questionRows, error: null }).mockResolvedValueOnce({ data: answerRows.slice(0, 1), error: null });
    const review = await getAttemptReview(ATTEMPT_ID);

    expect(review.items).toHaveLength(3);
    expect(review.items[1]).toMatchObject({ response: "", isCorrect: false });
  });

  it("reads the attempt and quiz through the user client before the admin client", async () => {
    await getAttemptReview(ATTEMPT_ID);

    expect(query.from).toHaveBeenCalledWith("attempts");
    expect(query.from).toHaveBeenCalledWith("quizzes");
    expect(query.eq).toHaveBeenCalledWith("owner_id", "user-1");
    expect(query.maybeSingle.mock.invocationCallOrder[1]).toBeLessThan(admin.from.mock.invocationCallOrder[0]);
    expect(admin.from).toHaveBeenCalledWith("questions");
    expect(admin.from).toHaveBeenCalledWith("answer_records");
    expect(admin.eq).toHaveBeenCalledWith("attempt_id", ATTEMPT_ID);
  });

  it("treats a malformed id as NOT_FOUND without querying the database", async () => {
    query.maybeSingle.mockReset();
    const err = await caught(getAttemptReview("nope"));

    expect(err.code).toBe("NOT_FOUND");
    expect(query.from).not.toHaveBeenCalled();
    expect(admin.from).not.toHaveBeenCalled();
  });

  it("treats someone else's attempt as NOT_FOUND and never reads the answer keys", async () => {
    query.maybeSingle.mockReset().mockResolvedValue({ data: null, error: null });
    const err = await caught(getAttemptReview(ATTEMPT_ID));

    expect(err.code).toBe("NOT_FOUND");
    expect(err.status).toBe(404);
    expect(admin.from).not.toHaveBeenCalled();
  });

  it("is NOT_FOUND when the attempt exists but its quiz is gone", async () => {
    query.maybeSingle.mockReset().mockResolvedValueOnce({ data: attemptRow, error: null }).mockResolvedValueOnce({ data: null, error: null });
    const err = await caught(getAttemptReview(ATTEMPT_ID));

    expect(err.code).toBe("NOT_FOUND");
    expect(admin.from).not.toHaveBeenCalled();
  });

  it("GET /api/attempts/:id returns the review in the envelope", async () => {
    const res = await GET(new Request(`http://localhost/api/attempts/${ATTEMPT_ID}`), { params: Promise.resolve({ id: ATTEMPT_ID }) });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.attempt.score).toBe(67);
    expect(json.data.items).toHaveLength(3);
    expect(json.data.items[1].question.expectedAnswer).toBe("Oxygen");
  });
});
