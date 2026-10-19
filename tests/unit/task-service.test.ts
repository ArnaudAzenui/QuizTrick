import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ getUser: vi.fn() }));

/**
 * Chainable stand-in for the supabase-js query builder. The builder itself is
 * awaitable (list/delete end on it), so `then` resolves to `result`.
 */
const query = vi.hoisted(() => {
  const q = {
    result: { data: null as unknown, error: null as unknown },
    from: vi.fn(), select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn(), eq: vi.fn(), or: vi.fn(),
    order: vi.fn(), returns: vi.fn(), maybeSingle: vi.fn(), single: vi.fn(),
    then(resolve: (v: unknown) => unknown) {
      return Promise.resolve(q.result).then(resolve);
    },
  };
  return q;
});

vi.mock("@backend/supabase/server", () => ({ createUserClient: async () => ({ auth, from: query.from }) }));
vi.mock("@backend/supabase/admin", () => ({
  createAdminClient: () => {
    throw new Error("the admin client must not be used by the task service");
  },
}));

import { AppError } from "@backend/lib/errors";
import { createTask, deleteTask, listTasks, updateTask } from "@backend/services/task.service";
import { GET, POST } from "@/app/api/tasks/route";
import { PATCH } from "@/app/api/tasks/[id]/route";

const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
afterAll(() => quiet.mockRestore());

const TASK_ID = "22222222-2222-4222-8222-222222222222";
const row = {
  id: TASK_ID, owner_id: "user-1", subject: "Biology", description: "Chapter 3",
  estimated_minutes: 30, is_complete: false, created_at: "2026-10-01T00:00:00Z",
};

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
  for (const step of ["from", "select", "insert", "update", "delete", "eq", "or", "order", "returns"] as const) {
    query[step].mockImplementation(() => query);
  }
  query.result = { data: [row], error: null };
  auth.getUser.mockResolvedValue({ data: { user: { id: "user-1", email: "s@school.edu" } }, error: null });
  query.maybeSingle.mockResolvedValue({ data: row, error: null });
  query.single.mockResolvedValue({ data: row, error: null });
});

describe("listTasks", () => {
  it("today keeps every incomplete task, however old, plus anything created since midnight UTC", async () => {
    const tasks = await listTasks("today");
    expect(query.eq).toHaveBeenCalledWith("owner_id", "user-1");
    const filter = query.or.mock.calls[0][0] as string;
    expect(filter).toMatch(/^is_complete\.eq\.false,created_at\.gte\."\d{4}-\d{2}-\d{2}T00:00:00\.000Z"$/);
    expect(tasks[0]).toMatchObject({ taskId: TASK_ID, estimatedMinutes: 30, isComplete: false });
  });

  it("all applies no date or completion filter", async () => {
    await listTasks("all");
    expect(query.or).not.toHaveBeenCalled();
  });

  it("defaults to today through the route and rejects an unknown scope", async () => {
    await GET(new Request("http://localhost/api/tasks"), undefined);
    expect(query.or).toHaveBeenCalled();

    const res = await GET(new Request("http://localhost/api/tasks?scope=week"), undefined);
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION");
  });

  it("hides the database error behind a student-facing message", async () => {
    query.result = { data: null, error: { code: "XX000", message: "boom" } };
    const err = await caught(listTasks("all"));
    expect(err.code).toBe("INTERNAL");
    expect(err.message).not.toContain("boom");
  });
});

describe("createTask", () => {
  it("inserts as the caller and returns 201 through the route", async () => {
    const res = await POST(
      new Request("http://localhost/api/tasks", { method: "POST", body: JSON.stringify({ subject: " Biology ", estimatedMinutes: "30" }) }),
      undefined,
    );
    expect(res.status).toBe(201);
    expect(query.insert).toHaveBeenCalledWith({ owner_id: "user-1", subject: "Biology", description: null, estimated_minutes: 30 });
  });

  it("maps a check-constraint failure to VALIDATION", async () => {
    query.single.mockResolvedValue({ data: null, error: { code: "23514", message: "check" } });
    const err = await caught(createTask({ subject: "Bio", description: null, estimatedMinutes: 30 }));
    expect(err.code).toBe("VALIDATION");
  });
});

describe("updateTask", () => {
  it("sends only the fields that were provided", async () => {
    await updateTask(TASK_ID, { isComplete: true });
    expect(query.update).toHaveBeenCalledWith({ is_complete: true });
    expect(query.eq).toHaveBeenCalledWith("id", TASK_ID);
    expect(query.eq).toHaveBeenCalledWith("owner_id", "user-1");
  });

  it("clears the description when the body sends null", async () => {
    const res = await PATCH(
      new Request(`http://localhost/api/tasks/${TASK_ID}`, { method: "PATCH", body: JSON.stringify({ description: null }) }),
      { params: Promise.resolve({ id: TASK_ID }) },
    );
    expect(res.status).toBe(200);
    expect(query.update).toHaveBeenCalledWith({ description: null });
  });

  it("an empty body changes nothing and returns the task", async () => {
    const task = await updateTask(TASK_ID, {});
    expect(query.update).not.toHaveBeenCalled();
    expect(task.taskId).toBe(TASK_ID);
  });

  it("someone else's task (no row back) is NOT_FOUND", async () => {
    query.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect((await caught(updateTask(TASK_ID, { subject: "X" }))).code).toBe("NOT_FOUND");
  });

  it("a malformed id is NOT_FOUND without touching the database", async () => {
    expect((await caught(updateTask("not-a-uuid", { subject: "X" }))).code).toBe("NOT_FOUND");
    expect(query.from).not.toHaveBeenCalled();
  });
});

describe("deleteTask", () => {
  it("deletes the caller's task", async () => {
    query.result = { data: [{ id: TASK_ID }], error: null };
    expect(await deleteTask(TASK_ID)).toEqual({ deleted: true });
    expect(query.delete).toHaveBeenCalled();
  });

  it("nothing deleted is NOT_FOUND", async () => {
    query.result = { data: [], error: null };
    expect((await caught(deleteTask(TASK_ID))).code).toBe("NOT_FOUND");
  });

  it("a malformed id is NOT_FOUND without touching the database", async () => {
    expect((await caught(deleteTask("nope"))).code).toBe("NOT_FOUND");
    expect(query.from).not.toHaveBeenCalled();
  });
});
