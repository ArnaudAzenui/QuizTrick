import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ getUser: vi.fn() }));

/**
 * Chainable stand-in for the supabase-js query builder. The builder itself is
 * awaitable (the list ends on it), so `then` resolves to `result`.
 */
const query = vi.hoisted(() => {
  const q = {
    result: { data: null as unknown, error: null as unknown },
    from: vi.fn(), select: vi.fn(), insert: vi.fn(), eq: vi.fn(), order: vi.fn(), limit: vi.fn(), returns: vi.fn(),
    single: vi.fn(),
    then(resolve: (v: unknown) => unknown) {
      return Promise.resolve(q.result).then(resolve);
    },
  };
  return q;
});

vi.mock("@backend/supabase/server", () => ({ createUserClient: async () => ({ auth, from: query.from }) }));
vi.mock("@backend/supabase/admin", () => ({
  createAdminClient: () => {
    throw new Error("the admin client must not be used by the session service");
  },
}));

import { AppError } from "@backend/lib/errors";
import { listSessions, saveSession } from "@backend/services/session.service";
import { GET, POST } from "@/app/api/sessions/route";

const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
afterAll(() => quiet.mockRestore());

const TASK_ID = "22222222-2222-4222-8222-222222222222";
const row = {
  id: "33333333-3333-4333-8333-333333333333", owner_id: "user-1", task_id: TASK_ID,
  start_time: "2026-10-01T10:00:00Z", end_time: "2026-10-01T10:30:00Z", duration_seconds: 1800,
  created_at: "2026-10-01T10:30:01Z",
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

/** A finished session that ended a minute ago, so it passes the not-from-the-future checks. */
function recentBody(extra: Record<string, unknown> = {}) {
  const end = Date.now() - 60_000;
  return { startTime: new Date(end - 30 * 60_000).toISOString(), endTime: new Date(end).toISOString(), ...extra };
}

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/sessions", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    }),
    undefined,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const step of ["from", "select", "insert", "eq", "order", "limit", "returns"] as const) {
    query[step].mockImplementation(() => query);
  }
  query.result = { data: [row], error: null };
  auth.getUser.mockResolvedValue({ data: { user: { id: "user-1", email: "s@school.edu" } }, error: null });
  query.single.mockResolvedValue({ data: row, error: null });
});

describe("listSessions", () => {
  it("returns the caller's 20 newest sessions, newest first, as StudySession objects", async () => {
    const sessions = await listSessions();
    expect(query.from).toHaveBeenCalledWith("study_sessions");
    expect(query.eq).toHaveBeenCalledWith("owner_id", "user-1");
    expect(query.order).toHaveBeenCalledWith("start_time", { ascending: false });
    expect(query.limit).toHaveBeenCalledWith(20);
    expect(sessions).toEqual([
      {
        sessionId: row.id, ownerId: "user-1", taskId: TASK_ID,
        startTime: row.start_time, endTime: row.end_time, durationSeconds: 1800,
      },
    ]);
  });

  it("returns an empty list for a user with no sessions", async () => {
    query.result = { data: [], error: null };
    expect(await listSessions()).toEqual([]);
  });

  it("keeps a session that is still open, with a null endTime", async () => {
    query.result = { data: [{ ...row, task_id: null, end_time: null, duration_seconds: 0 }], error: null };
    expect(await listSessions()).toMatchObject([{ taskId: null, endTime: null, durationSeconds: 0 }]);
  });

  it("hides the database error behind a student-facing message", async () => {
    query.result = { data: null, error: { code: "XX000", message: "boom" } };
    const err = await caught(listSessions());
    expect(err.code).toBe("INTERNAL");
    expect(err.message).not.toContain("boom");
  });

  it("refuses an unauthenticated caller before touching the table", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null }, error: { message: "no session" } });
    expect((await caught(listSessions())).code).toBe("UNAUTHENTICATED");
    expect(query.from).not.toHaveBeenCalled();
  });

  it("GET wraps the list in the success envelope", async () => {
    const res = await GET(new Request("http://localhost/api/sessions"), undefined);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toHaveLength(1);
  });
});

describe("saveSession", () => {
  // The shape createSessionSchema produces: taskId defaulted, duration derived.
  const input = {
    taskId: TASK_ID as string | null,
    startTime: "2026-10-01T10:00:00Z",
    endTime: "2026-10-01T10:30:00Z",
    durationSeconds: 1800,
  };

  it("inserts the caller's own session with the schema-derived duration", async () => {
    const saved = await saveSession(input);
    expect(query.insert).toHaveBeenCalledWith({
      owner_id: "user-1", task_id: TASK_ID,
      start_time: input.startTime, end_time: input.endTime, duration_seconds: 1800,
    });
    expect(saved).toMatchObject({ sessionId: row.id, durationSeconds: 1800 });
  });

  it("stores a session with no task as task_id null", async () => {
    await saveSession({ ...input, taskId: null });
    expect(query.insert.mock.calls[0][0]).toMatchObject({ task_id: null });
  });

  it("maps P0002 (someone else's or a deleted task) to NOT_FOUND", async () => {
    query.single.mockResolvedValue({ data: null, error: { code: "P0002", message: "study task not found for this user" } });
    const err = await caught(saveSession(input));
    expect(err.code).toBe("NOT_FOUND");
    expect(err.message).not.toContain("study task not found for this user");
  });

  it("maps a 23514 trigger rejection to VALIDATION", async () => {
    query.single.mockResolvedValue({ data: null, error: { code: "23514", message: "session start time cannot be in the future" } });
    const err = await caught(saveSession(input));
    expect(err.code).toBe("VALIDATION");
    expect(err.message).not.toContain("cannot be in the future");
  });

  it("hides any other database error behind a student-facing message", async () => {
    query.single.mockResolvedValue({ data: null, error: { code: "XX000", message: "boom" } });
    const err = await caught(saveSession(input));
    expect(err.code).toBe("INTERNAL");
    expect(err.message).not.toContain("boom");
  });

  it("refuses an unauthenticated caller before touching the table", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null }, error: { message: "no session" } });
    expect((await caught(saveSession(input))).code).toBe("UNAUTHENTICATED");
    expect(query.insert).not.toHaveBeenCalled();
  });
});

describe("POST /api/sessions", () => {
  it("answers 201 with the saved session", async () => {
    const res = await post(recentBody({ taskId: TASK_ID }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.sessionId).toBe(row.id);
  });

  it("ignores a client-sent durationSeconds", async () => {
    const res = await post(recentBody({ durationSeconds: 999_999 }));
    expect(res.status).toBe(201);
    // The stored value is the server's own arithmetic (30 min), not the client's.
    expect(query.insert.mock.calls[0][0]).toMatchObject({ duration_seconds: 1800 });
    expect(JSON.stringify(query.insert.mock.calls[0][0])).not.toContain("999999");
  });

  it("rejects an end before the start with a 400 and writes nothing", async () => {
    const { startTime, endTime } = recentBody();
    const res = await post({ startTime: endTime, endTime: startTime });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION");
    expect(query.insert).not.toHaveBeenCalled();
  });

  it("rejects a malformed task id with a 400 and writes nothing", async () => {
    const res = await post(recentBody({ taskId: "not-a-uuid" }));
    expect(res.status).toBe(400);
    expect(query.insert).not.toHaveBeenCalled();
  });

  it("rejects a body that is not JSON", async () => {
    const res = await POST(new Request("http://localhost/api/sessions", { method: "POST", body: "{nope" }), undefined);
    expect(res.status).toBe(400);
  });

  it("answers 404 when the database says the task isn't the caller's", async () => {
    query.single.mockResolvedValue({ data: null, error: { code: "P0002", message: "x" } });
    const res = await post(recentBody({ taskId: TASK_ID }));
    expect(res.status).toBe(404);
  });
});
