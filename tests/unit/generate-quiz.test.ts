import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ getUser: vi.fn() }));

/** Chainable stand-in for the user client's query builder; the terminal calls are mocks. */
const query = vi.hoisted(() => {
  const q = { from: vi.fn(), select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(), single: vi.fn() };
  return q;
});
const admin = vi.hoisted(() => ({ rpc: vi.fn(), insert: vi.fn(), from: vi.fn() }));
const complete = vi.hoisted(() => vi.fn());

vi.mock("@backend/supabase/server", () => ({ createUserClient: async () => ({ auth, from: query.from }) }));
vi.mock("@backend/supabase/admin", () => ({ createAdminClient: () => ({ rpc: admin.rpc, from: admin.from }) }));
vi.mock("@backend/services/ai", () => ({ getAiProvider: () => ({ name: "mock", complete }) }));

import { generateQuiz } from "@backend/services/quiz-generator";
import { POST } from "@/app/api/generate/route";
import { AppError } from "@backend/lib/errors";

const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
afterAll(() => quiet.mockRestore());

const TEXT_ID = "11111111-1111-4111-8111-111111111111";
const QUIZ_ID = "22222222-2222-4222-8222-222222222222";
const textRow = { id: TEXT_ID, owner_id: "user-1", title: "Cells", body: "x".repeat(300), char_count: 300, created_at: "2026-10-01T00:00:00Z" };
const quizRow = { id: QUIZ_ID, owner_id: "user-1", text_id: TEXT_ID, question_count: 5, created_at: "2026-10-04T00:00:00Z" };

// 5 questions -> 4 mcq + 1 short answer (70/30, rounded).
const goodReply = JSON.stringify({
  questions: [
    ...[1, 2, 3, 4].map((n) => ({ type: "mcq", text: `Q${n}?`, options: ["a", "b", "c", "d"], correctOption: 0 })),
    { type: "short_answer", text: "S?", expectedAnswer: "mitochondria" },
  ],
});

async function caught(p: Promise<unknown>): Promise<AppError> {
  try {
    await p;
  } catch (err) {
    expect(err).toBeInstanceOf(AppError);
    return err as AppError;
  }
  throw new Error("expected the call to throw");
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const step of ["from", "select", "eq"] as const) query[step].mockImplementation(() => query);
  auth.getUser.mockResolvedValue({ data: { user: { id: "user-1", email: "s@school.edu" } }, error: null });
  query.maybeSingle.mockResolvedValue({ data: textRow, error: null });
  query.single.mockResolvedValue({ data: quizRow, error: null });
  admin.from.mockImplementation(() => ({ insert: admin.insert }));
  admin.insert.mockResolvedValue({ error: null });
  admin.rpc.mockImplementation(async (fn: string) =>
    fn === "count_recent_generations" ? { data: 0, error: null } : { data: QUIZ_ID, error: null },
  );
  complete.mockResolvedValue(goodReply);
});

describe("generateQuiz", () => {
  it("generates, saves atomically and returns the new quiz titled after its text", async () => {
    const quiz = await generateQuiz({ textId: TEXT_ID, questionCount: 5 });
    expect(quiz).toEqual({ quizId: QUIZ_ID, ownerId: "user-1", textId: TEXT_ID, questionCount: 5, createdAt: quizRow.created_at, title: "Cells" });

    expect(admin.from).toHaveBeenCalledWith("generation_requests");
    expect(admin.insert).toHaveBeenCalledWith({ owner_id: "user-1" });
    const save = admin.rpc.mock.calls.find(([fn]) => fn === "create_quiz_with_questions")!;
    expect(save[1].p_owner_id).toBe("user-1");
    expect(save[1].p_text_id).toBe(TEXT_ID);
    expect(save[1].p_questions).toHaveLength(5);
    expect(save[1].p_questions[4]).toMatchObject({ position: 5, type: "short_answer", expected_answer: "mitochondria" });
  });

  it("sends the text to the model inside the fence and asks for JSON", async () => {
    await generateQuiz({ textId: TEXT_ID, questionCount: 5 });
    const req = complete.mock.calls[0][0];
    expect(req.user).toContain(textRow.body);
    expect(req.jsonMode).toBe(true);
    expect(req.timeoutMs).toBeLessThanOrEqual(30_000);
  });

  it("checks the text before the rate limit, so a bad id costs no quota", async () => {
    query.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect((await caught(generateQuiz({ textId: TEXT_ID, questionCount: 5 }))).code).toBe("NOT_FOUND");
    expect(admin.rpc).not.toHaveBeenCalled();
    expect(complete).not.toHaveBeenCalled();
  });

  it("refuses the 21st generation in an hour without calling the model", async () => {
    admin.rpc.mockResolvedValue({ data: 20, error: null });
    expect((await caught(generateQuiz({ textId: TEXT_ID, questionCount: 5 }))).code).toBe("RATE_LIMITED");
    expect(admin.insert).not.toHaveBeenCalled();
    expect(complete).not.toHaveBeenCalled();
  });

  it("retries an unusable reply and succeeds on a later attempt", async () => {
    complete.mockResolvedValueOnce("not json").mockResolvedValueOnce(goodReply);
    await generateQuiz({ textId: TEXT_ID, questionCount: 5 });
    expect(complete).toHaveBeenCalledTimes(2);
  });

  it("gives up after the retries with AI_BAD_OUTPUT and stores nothing", async () => {
    complete.mockResolvedValue("not json");
    expect((await caught(generateQuiz({ textId: TEXT_ID, questionCount: 5 }))).code).toBe("AI_BAD_OUTPUT");
    expect(complete).toHaveBeenCalledTimes(3);
    expect(admin.rpc).not.toHaveBeenCalledWith("create_quiz_with_questions", expect.anything());
  });

  it("reports a provider outage as AI_UNAVAILABLE", async () => {
    complete.mockRejectedValue(AppError.aiUnavailable());
    expect((await caught(generateQuiz({ textId: TEXT_ID, questionCount: 5 }))).code).toBe("AI_UNAVAILABLE");
  });

  it("maps a text deleted mid-generation to NOT_FOUND", async () => {
    admin.rpc.mockImplementation(async (fn: string) =>
      fn === "count_recent_generations" ? { data: 0, error: null } : { data: null, error: { code: "P0002", message: "gone" } },
    );
    expect((await caught(generateQuiz({ textId: TEXT_ID, questionCount: 5 }))).code).toBe("NOT_FOUND");
  });
});

describe("POST /api/generate", () => {
  const post = (body: unknown) => POST(new Request("http://localhost/api/generate", { method: "POST", body: JSON.stringify(body) }), undefined);

  it("returns 201 with the quiz in the envelope", async () => {
    const res = await post({ textId: TEXT_ID, questionCount: "5" });
    expect(res.status).toBe(201);
    expect((await res.json()).data.quizId).toBe(QUIZ_ID);
  });

  it("rejects an unsupported question count with 400", async () => {
    const res = await post({ textId: TEXT_ID, questionCount: 7 });
    expect(res.status).toBe(400);
    expect(complete).not.toHaveBeenCalled();
  });
});
