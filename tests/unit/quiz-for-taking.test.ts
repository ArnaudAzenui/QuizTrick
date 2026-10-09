import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ getUser: vi.fn() }));

/** Chainable stand-in for the user client's query builder; the terminal call is a mock. */
const query = vi.hoisted(() => ({ from: vi.fn(), select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() }));
/** Same for the admin client, which reads `questions` (no client SELECT policy). */
const admin = vi.hoisted(() => ({ from: vi.fn(), select: vi.fn(), eq: vi.fn(), order: vi.fn(), returns: vi.fn() }));

vi.mock("@backend/supabase/server", () => ({ createUserClient: async () => ({ auth, from: query.from }) }));
vi.mock("@backend/supabase/admin", () => ({ createAdminClient: () => ({ from: admin.from }) }));

import { getQuizForTaking } from "@backend/services/quiz.service";
import { GET } from "@/app/api/quizzes/[id]/route";
import { AppError } from "@backend/lib/errors";

const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
afterAll(() => quiet.mockRestore());

const QUIZ_ID = "22222222-2222-4222-8222-222222222222";
const TEXT_ID = "11111111-1111-4111-8111-111111111111";
const quizRow = {
  id: QUIZ_ID,
  owner_id: "user-1",
  text_id: TEXT_ID,
  question_count: 2,
  created_at: "2026-10-04T00:00:00Z",
  study_texts: { title: "Cells" },
};
// What the admin query returns: the public columns only. The keys are added in
// one test to prove that even if they arrived, they would not get out.
const questionRows = [
  { id: "q-1", quiz_id: QUIZ_ID, position: 1, type: "mcq", text: "Q1?", options: ["a", "b", "c", "d"] },
  { id: "q-2", quiz_id: QUIZ_ID, position: 2, type: "short_answer", text: "S?", options: [] },
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

beforeEach(() => {
  vi.clearAllMocks();
  for (const step of ["from", "select", "eq"] as const) query[step].mockImplementation(() => query);
  for (const step of ["from", "select", "eq", "order"] as const) admin[step].mockImplementation(() => admin);
  auth.getUser.mockResolvedValue({ data: { user: { id: "user-1", email: "s@school.edu" } }, error: null });
  query.maybeSingle.mockResolvedValue({ data: quizRow, error: null });
  admin.returns.mockResolvedValue({ data: questionRows, error: null });
});

describe("getQuizForTaking", () => {
  it("returns the quiz, titled after its text, with its questions in position order", async () => {
    const result = await getQuizForTaking(QUIZ_ID);

    expect(result.quiz).toEqual({
      quizId: QUIZ_ID,
      ownerId: "user-1",
      textId: TEXT_ID,
      questionCount: 2,
      createdAt: quizRow.created_at,
      title: "Cells",
    });
    expect(result.questions).toEqual([
      { questionId: "q-1", quizId: QUIZ_ID, position: 1, type: "mcq", text: "Q1?", options: ["a", "b", "c", "d"] },
      { questionId: "q-2", quizId: QUIZ_ID, position: 2, type: "short_answer", text: "S?", options: [] },
    ]);
    expect(admin.order).toHaveBeenCalledWith("position", { ascending: true });
  });

  it("never sends an answer key to the browser, even if one reaches the mapper", async () => {
    admin.returns.mockResolvedValue({
      data: questionRows.map((q) => ({ ...q, correct_option: 2, expected_answer: "mitochondria" })),
      error: null,
    });

    const json = JSON.stringify(await getQuizForTaking(QUIZ_ID));

    for (const leak of ["correctOption", "expectedAnswer", "correct_option", "expected_answer", "mitochondria"]) {
      expect(json).not.toContain(leak);
    }
  });

  it("selects only the public question columns from the database", async () => {
    await getQuizForTaking(QUIZ_ID);

    const [columns] = admin.select.mock.calls[0] as [string];
    expect(columns).not.toMatch(/correct_option|expected_answer/);
    expect(admin.from).toHaveBeenCalledWith("questions");
    expect(admin.eq).toHaveBeenCalledWith("quiz_id", QUIZ_ID);
  });

  it("checks ownership through the user client before touching the admin client", async () => {
    await getQuizForTaking(QUIZ_ID);

    expect(query.from).toHaveBeenCalledWith("quizzes");
    expect(query.eq).toHaveBeenCalledWith("owner_id", "user-1");
    expect(query.maybeSingle.mock.invocationCallOrder[0]).toBeLessThan(admin.from.mock.invocationCallOrder[0]);
  });

  it("treats a malformed id as NOT_FOUND without querying the database", async () => {
    const err = await caught(getQuizForTaking("not-a-uuid"));

    expect(err.code).toBe("NOT_FOUND");
    expect(err.status).toBe(404);
    expect(query.from).not.toHaveBeenCalled();
    expect(admin.from).not.toHaveBeenCalled();
  });

  it("treats someone else's quiz (or a missing one) as NOT_FOUND and never reads its questions", async () => {
    query.maybeSingle.mockResolvedValue({ data: null, error: null });

    const err = await caught(getQuizForTaking(QUIZ_ID));

    expect(err.code).toBe("NOT_FOUND");
    expect(admin.from).not.toHaveBeenCalled();
  });

  it("titles the quiz null when the join brings back no text", async () => {
    query.maybeSingle.mockResolvedValue({ data: { ...quizRow, study_texts: null }, error: null });

    const result = await getQuizForTaking(QUIZ_ID);

    expect(result.quiz.title).toBeNull();
  });

  it("returns an empty questions list rather than failing when none come back", async () => {
    admin.returns.mockResolvedValue({ data: null, error: null });

    const result = await getQuizForTaking(QUIZ_ID);

    expect(result.questions).toEqual([]);
  });

  it("maps a quiz lookup failure to INTERNAL without the database detail", async () => {
    query.maybeSingle.mockResolvedValue({ data: null, error: { code: "08006", message: "connection dropped" } });

    const err = await caught(getQuizForTaking(QUIZ_ID));

    expect(err.code).toBe("INTERNAL");
    expect(err.message).not.toContain("connection dropped");
    expect(admin.from).not.toHaveBeenCalled();
  });

  it("maps a question lookup failure to INTERNAL", async () => {
    admin.returns.mockResolvedValue({ data: null, error: { code: "08006", message: "connection dropped" } });

    const err = await caught(getQuizForTaking(QUIZ_ID));

    expect(err.code).toBe("INTERNAL");
    expect(err.message).not.toContain("connection dropped");
  });

  it("requires a signed-in user", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const err = await caught(getQuizForTaking(QUIZ_ID));

    expect(err.code).toBe("UNAUTHENTICATED");
    expect(admin.from).not.toHaveBeenCalled();
  });
});

describe("GET /api/quizzes/:id", () => {
  const call = (id: string) => GET(new Request(`http://localhost/api/quizzes/${id}`), { params: Promise.resolve({ id }) });

  it("returns 200 with QuizForTaking in the success envelope", async () => {
    const res = await call(QUIZ_ID);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.quiz.quizId).toBe(QUIZ_ID);
    expect(body.data.questions).toHaveLength(2);
    expect(JSON.stringify(body)).not.toMatch(/correctOption|expectedAnswer/);
  });

  it("returns 404 in the error envelope for a quiz that isn't the caller's", async () => {
    query.maybeSingle.mockResolvedValue({ data: null, error: null });

    const res = await call(QUIZ_ID);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
  });
});
