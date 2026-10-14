import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ getUser: vi.fn() }));

/**
 * Chainable stand-in for the supabase-js query builder. The builder itself is
 * awaitable (list/delete end on it), so `then` resolves to `result`.
 */
const query = vi.hoisted(() => {
  const q = {
    result: { data: null as unknown, error: null as unknown },
    from: vi.fn(), select: vi.fn(), insert: vi.fn(), delete: vi.fn(), eq: vi.fn(), order: vi.fn(), returns: vi.fn(),
    maybeSingle: vi.fn(), single: vi.fn(),
    then(resolve: (v: unknown) => unknown) {
      return Promise.resolve(q.result).then(resolve);
    },
  };
  return q;
});

vi.mock("@backend/supabase/server", () => ({ createUserClient: async () => ({ auth, from: query.from }) }));
// quiz.service also imports the admin client (for getQuizForTaking). Nothing
// under test here may use it — RLS alone scopes these reads — so a call fails loudly.
vi.mock("@backend/supabase/admin", () => ({
  createAdminClient: () => {
    throw new Error("the admin client must not be used by the text or quiz-list services");
  },
}));

import { AppError } from "@backend/lib/errors";
import { createText, deleteText, getText, listTexts } from "@backend/services/text.service";
import { listQuizzesForText } from "@backend/services/quiz.service";
import { POST } from "@/app/api/texts/route";

const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
afterAll(() => quiet.mockRestore());

const TEXT_ID = "11111111-1111-4111-8111-111111111111";
const body = "Cells are the basic unit of life. ".repeat(10);
const row = { id: TEXT_ID, owner_id: "user-1", title: "Cells", body: body.trim(), char_count: body.trim().length, created_at: "2026-10-01T00:00:00Z" };

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
  for (const step of ["from", "select", "insert", "delete", "eq", "order", "returns"] as const) query[step].mockImplementation(() => query);
  query.result = { data: [], error: null };
  auth.getUser.mockResolvedValue({ data: { user: { id: "user-1", email: "s@school.edu" } }, error: null });
  query.maybeSingle.mockResolvedValue({ data: row, error: null });
  query.single.mockResolvedValue({ data: row, error: null });
});

describe("createText", () => {
  it("stores the cleaned body with its code-point count, as the caller", async () => {
    const text = await createText({ title: "Cells", body: `\u0007  ${body}  ` });
    expect(query.from).toHaveBeenCalledWith("study_texts");
    expect(query.insert).toHaveBeenCalledWith({ owner_id: "user-1", title: "Cells", body: body.trim(), char_count: body.trim().length });
    expect(text.textId).toBe(TEXT_ID);
  });

  it("rejects text under 200 characters with a field error, before any database call", async () => {
    const err = await caught(createText({ title: null, body: "too short" }));
    expect(err.code).toBe("VALIDATION");
    expect(err.fields?.body).toContain("200");
    expect(query.from).not.toHaveBeenCalled();
  });

  it("returns 201 through the route", async () => {
    const res = await POST(new Request("http://localhost/api/texts", { method: "POST", body: JSON.stringify({ body }) }), undefined);
    expect(res.status).toBe(201);
  });
});

describe("listTexts", () => {
  it("returns summaries with quizCount, newest first", async () => {
    query.result = { data: [{ ...row, body: undefined, quizzes: [{ count: 3 }] }], error: null };
    const list = await listTexts();
    expect(query.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(list).toEqual([{ textId: TEXT_ID, ownerId: "user-1", title: "Cells", charCount: row.char_count, createdAt: row.created_at, quizCount: 3 }]);
  });
});

describe("getText / deleteText", () => {
  it("treats a malformed id as NOT_FOUND without querying", async () => {
    expect((await caught(getText("not-a-uuid"))).code).toBe("NOT_FOUND");
    expect((await caught(deleteText("not-a-uuid"))).code).toBe("NOT_FOUND");
    expect(query.from).not.toHaveBeenCalled();
  });

  it("reports someone else's or a missing text as NOT_FOUND", async () => {
    query.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect((await caught(getText(TEXT_ID))).code).toBe("NOT_FOUND");
    query.result = { data: [], error: null };
    expect((await caught(deleteText(TEXT_ID))).code).toBe("NOT_FOUND");
  });

  it("deletes the caller's text", async () => {
    query.result = { data: [{ id: TEXT_ID }], error: null };
    expect(await deleteText(TEXT_ID)).toEqual({ deleted: true });
    expect(query.eq).toHaveBeenCalledWith("owner_id", "user-1");
  });
});

describe("listQuizzesForText", () => {
  it("labels each quiz with the text's title", async () => {
    query.maybeSingle.mockResolvedValue({ data: { id: TEXT_ID, title: "Cells" }, error: null });
    query.result = { data: [{ id: "q1", owner_id: "user-1", text_id: TEXT_ID, question_count: 10, created_at: "2026-10-04T00:00:00Z" }], error: null };
    const quizzes = await listQuizzesForText(TEXT_ID);
    expect(quizzes).toEqual([{ quizId: "q1", ownerId: "user-1", textId: TEXT_ID, questionCount: 10, createdAt: "2026-10-04T00:00:00Z", title: "Cells" }]);
  });

  it("reports a missing text as NOT_FOUND rather than an empty list", async () => {
    query.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect((await caught(listQuizzesForText(TEXT_ID))).code).toBe("NOT_FOUND");
  });
});
