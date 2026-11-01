import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ getUser: vi.fn() }));

/** Chainable stand-in for the user client's query builder; `select` is the terminal call here. */
const query = vi.hoisted(() => ({ from: vi.fn(), delete: vi.fn(), eq: vi.fn(), select: vi.fn() }));

vi.mock("@backend/supabase/server", () => ({ createUserClient: async () => ({ auth, from: query.from }) }));
vi.mock("@backend/supabase/admin", () => ({
  createAdminClient: () => {
    throw new Error("the admin client must not be used to delete a quiz");
  },
}));

import { AppError } from "@backend/lib/errors";
import { deleteQuiz } from "@backend/services/quiz.service";
import { DELETE } from "@/app/api/quizzes/[id]/route";

const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
afterAll(() => quiet.mockRestore());

const QUIZ_ID = "22222222-2222-4222-8222-222222222222";

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
  for (const step of ["from", "delete", "eq"] as const) query[step].mockImplementation(() => query);
  auth.getUser.mockResolvedValue({ data: { user: { id: "user-1", email: "s@school.edu" } }, error: null });
  query.select.mockResolvedValue({ data: [{ id: QUIZ_ID }], error: null });
});

describe("deleteQuiz", () => {
  it("deletes the caller's own quiz and reports it", async () => {
    expect(await deleteQuiz(QUIZ_ID)).toEqual({ deleted: true });

    expect(query.from).toHaveBeenCalledWith("quizzes");
    expect(query.delete).toHaveBeenCalledTimes(1);
    expect(query.eq).toHaveBeenCalledWith("id", QUIZ_ID);
    expect(query.eq).toHaveBeenCalledWith("owner_id", "user-1");
  });

  it("treats someone else's quiz (or a missing one) as NOT_FOUND", async () => {
    query.select.mockResolvedValue({ data: [], error: null });

    const err = await caught(deleteQuiz(QUIZ_ID));

    expect(err.code).toBe("NOT_FOUND");
    expect(err.status).toBe(404);
  });

  it("treats a malformed id as NOT_FOUND without querying the database", async () => {
    const err = await caught(deleteQuiz("not-a-uuid"));

    expect(err.code).toBe("NOT_FOUND");
    expect(query.from).not.toHaveBeenCalled();
  });

  it("maps a database failure to INTERNAL without the database detail", async () => {
    query.select.mockResolvedValue({ data: null, error: { code: "08006", message: "connection dropped" } });

    const err = await caught(deleteQuiz(QUIZ_ID));

    expect(err.code).toBe("INTERNAL");
    expect(err.message).not.toContain("connection dropped");
  });

  it("requires a signed-in user and never touches the table otherwise", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const err = await caught(deleteQuiz(QUIZ_ID));

    expect(err.code).toBe("UNAUTHENTICATED");
    expect(query.from).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/quizzes/:id", () => {
  const call = (id: string) =>
    DELETE(new Request(`http://localhost/api/quizzes/${id}`, { method: "DELETE" }), { params: Promise.resolve({ id }) });

  it("returns 200 with { deleted: true } in the success envelope", async () => {
    const res = await call(QUIZ_ID);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, data: { deleted: true } });
  });

  it("returns 404 in the error envelope for a quiz that isn't the caller's", async () => {
    query.select.mockResolvedValue({ data: [], error: null });

    const res = await call(QUIZ_ID);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 401 when nobody is signed in", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const res = await call(QUIZ_ID);

    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHENTICATED");
  });
});
