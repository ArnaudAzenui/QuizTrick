import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ getUser: vi.fn() }));

/** A chainable stand-in for the supabase-js query builder. */
const query = vi.hoisted(() => {
  const q = {
    from: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
  };
  for (const step of ["from", "select", "update", "eq"] as const) q[step].mockImplementation(() => q);
  return q;
});

vi.mock("@backend/supabase/server", () => ({
  createUserClient: async () => ({ auth, from: query.from }),
}));

import { AppError } from "@backend/lib/errors";
import { getProfile, updateDisplayName } from "@backend/services/profile.service";
import { GET, PATCH } from "@/app/api/profile/route";

const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
afterAll(() => quiet.mockRestore());

const row = { id: "user-1", email: "old@school.edu", display_name: "Sam", created_at: "2026-09-01T00:00:00Z" };
const signedIn = { data: { user: { id: "user-1", email: "student@school.edu" } }, error: null };

async function caught(fn: () => Promise<unknown>): Promise<AppError> {
  try {
    await fn();
  } catch (err) {
    expect(err).toBeInstanceOf(AppError);
    return err as AppError;
  }
  throw new Error("expected the call to throw");
}

const patch = (body: unknown) =>
  PATCH(new Request("http://localhost/api/profile", { method: "PATCH", body: JSON.stringify(body) }), undefined);

beforeEach(() => {
  vi.clearAllMocks();
  for (const step of ["from", "select", "update", "eq"] as const) query[step].mockImplementation(() => query);
  auth.getUser.mockResolvedValue(signedIn);
  query.maybeSingle.mockResolvedValue({ data: row, error: null });
});

describe("getProfile", () => {
  it("reads the caller's own row and maps it to camelCase", async () => {
    const profile = await getProfile();
    expect(query.from).toHaveBeenCalledWith("profiles");
    expect(query.eq).toHaveBeenCalledWith("id", "user-1");
    expect(profile).toEqual({
      userId: "user-1",
      email: "student@school.edu",
      displayName: "Sam",
      createdAt: "2026-09-01T00:00:00Z",
    });
  });

  // profiles.email is only written at signup; auth holds the current address.
  it("prefers the auth email over the copy stored at signup", async () => {
    expect((await getProfile()).email).toBe("student@school.edu");
  });

  it("falls back to the stored email when auth has none", async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    expect((await getProfile()).email).toBe("old@school.edu");
  });

  it("rejects a signed-out caller before touching the table", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null }, error: { status: 401 } });
    expect((await caught(getProfile)).code).toBe("UNAUTHENTICATED");
    expect(query.from).not.toHaveBeenCalled();
  });

  it("reports a missing row as NOT_FOUND", async () => {
    query.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect((await caught(getProfile)).code).toBe("NOT_FOUND");
  });

  it("hides database errors behind a generic INTERNAL", async () => {
    query.maybeSingle.mockResolvedValue({ data: null, error: { code: "08006", message: "connection failure" } });
    const err = await caught(getProfile);
    expect(err.code).toBe("INTERNAL");
    expect(err.message).not.toContain("connection");
  });
});

describe("updateDisplayName", () => {
  it("writes display_name only, on the caller's row, and returns the updated profile", async () => {
    query.maybeSingle.mockResolvedValue({ data: { ...row, display_name: "Samira" }, error: null });
    const profile = await updateDisplayName({ displayName: "Samira" });
    expect(query.update).toHaveBeenCalledWith({ display_name: "Samira" });
    expect(query.eq).toHaveBeenCalledWith("id", "user-1");
    expect(profile.displayName).toBe("Samira");
  });

  it("reports an RLS-filtered or missing row as NOT_FOUND", async () => {
    query.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect((await caught(() => updateDisplayName({ displayName: "Samira" }))).code).toBe("NOT_FOUND");
  });

  it("maps the database length check to a field-level VALIDATION error", async () => {
    query.maybeSingle.mockResolvedValue({ data: null, error: { code: "23514", message: "profiles_display_name_len" } });
    const err = await caught(() => updateDisplayName({ displayName: "x" }));
    expect(err.code).toBe("VALIDATION");
    expect(err.fields?.displayName).toBeTruthy();
  });

  it("hides other database errors behind INTERNAL", async () => {
    query.maybeSingle.mockResolvedValue({ data: null, error: { code: "42501", message: "permission denied" } });
    expect((await caught(() => updateDisplayName({ displayName: "Samira" }))).code).toBe("INTERNAL");
  });
});

describe("/api/profile route", () => {
  it("GET returns the profile in the success envelope", async () => {
    const res = await GET(new Request("http://localhost/api/profile"), undefined);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, data: { userId: "user-1", displayName: "Sam" } });
  });

  it("GET returns 401 for a signed-out caller", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null }, error: { status: 401 } });
    const res = await GET(new Request("http://localhost/api/profile"), undefined);
    expect(res.status).toBe(401);
  });

  it("PATCH trims the name before saving", async () => {
    const res = await patch({ displayName: "  Samira  " });
    expect(res.status).toBe(200);
    expect(query.update).toHaveBeenCalledWith({ display_name: "Samira" });
  });

  it.each([
    ["an empty name", { displayName: "   " }],
    ["a name over the limit", { displayName: "x".repeat(61) }],
    ["a missing name", {}],
  ])("PATCH rejects %s with 400 and never writes", async (_label, body) => {
    const res = await patch(body);
    expect(res.status).toBe(400);
    expect((await res.json()).error.fields.displayName).toBeTruthy();
    expect(query.update).not.toHaveBeenCalled();
  });

  it("PATCH ignores attempts to write other columns", async () => {
    await patch({ displayName: "Samira", email: "attacker@evil.example", id: "user-2" });
    expect(query.update).toHaveBeenCalledWith({ display_name: "Samira" });
  });
});
