import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ getUser: vi.fn() }));

/** Chainable stand-in for the supabase-js query builder. */
const query = vi.hoisted(() => ({
  from: vi.fn(), select: vi.fn(), upsert: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(), single: vi.fn(),
}));

vi.mock("@backend/supabase/server", () => ({ createUserClient: async () => ({ auth, from: query.from }) }));
vi.mock("@backend/supabase/admin", () => ({
  createAdminClient: () => {
    throw new Error("the admin client must not be used by the preference service");
  },
}));

import { AppError } from "@backend/lib/errors";
import { getPreference, setTheme } from "@backend/services/preference.service";
import { GET, PUT } from "@/app/api/preferences/route";

const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
afterAll(() => quiet.mockRestore());

const row = { owner_id: "user-1", theme: "dark", updated_at: "2026-10-01T00:00:00Z" };

async function caught(p: Promise<unknown>): Promise<AppError> {
  try {
    await p;
  } catch (err) {
    expect(err).toBeInstanceOf(AppError);
    return err as AppError;
  }
  throw new Error("expected the call to throw");
}

function put(body: unknown) {
  return PUT(
    new Request("http://localhost/api/preferences", {
      method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    }),
    undefined,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const step of ["from", "select", "upsert", "eq"] as const) query[step].mockImplementation(() => query);
  auth.getUser.mockResolvedValue({ data: { user: { id: "user-1", email: "s@school.edu" } }, error: null });
  query.maybeSingle.mockResolvedValue({ data: row, error: null });
  query.single.mockResolvedValue({ data: row, error: null });
});

describe("getPreference", () => {
  it("returns the caller's saved theme", async () => {
    const pref = await getPreference();
    expect(query.from).toHaveBeenCalledWith("preferences");
    expect(query.eq).toHaveBeenCalledWith("owner_id", "user-1");
    expect(pref).toEqual({ ownerId: "user-1", theme: "dark", updatedAt: row.updated_at });
  });

  it("falls back to the light theme when the account has no row, and writes nothing", async () => {
    query.maybeSingle.mockResolvedValue({ data: null, error: null });
    const pref = await getPreference();
    expect(pref).toMatchObject({ ownerId: "user-1", theme: "light" });
    expect(query.upsert).not.toHaveBeenCalled();
  });

  it("hides the database error behind a student-facing message", async () => {
    query.maybeSingle.mockResolvedValue({ data: null, error: { code: "XX000", message: "boom" } });
    const err = await caught(getPreference());
    expect(err.code).toBe("INTERNAL");
    expect(err.message).not.toContain("boom");
  });

  it("refuses an unauthenticated caller before touching the table", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null }, error: { message: "no session" } });
    expect((await caught(getPreference())).code).toBe("UNAUTHENTICATED");
    expect(query.from).not.toHaveBeenCalled();
  });

  it("GET wraps the preference in the success envelope", async () => {
    const res = await GET(new Request("http://localhost/api/preferences"), undefined);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, data: { ownerId: "user-1", theme: "dark", updatedAt: row.updated_at } });
  });
});

describe("setTheme", () => {
  it("upserts the caller's own row, so an account with no row still saves", async () => {
    const pref = await setTheme({ theme: "dark" });
    expect(query.upsert).toHaveBeenCalledWith({ owner_id: "user-1", theme: "dark" }, { onConflict: "owner_id" });
    expect(pref).toMatchObject({ ownerId: "user-1", theme: "dark" });
  });

  it("hides the database error behind a student-facing message", async () => {
    query.single.mockResolvedValue({ data: null, error: { code: "42501", message: "rls boom" } });
    const err = await caught(setTheme({ theme: "light" }));
    expect(err.code).toBe("INTERNAL");
    expect(err.message).not.toContain("rls boom");
  });

  it("refuses an unauthenticated caller before touching the table", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null }, error: { message: "no session" } });
    expect((await caught(setTheme({ theme: "dark" }))).code).toBe("UNAUTHENTICATED");
    expect(query.upsert).not.toHaveBeenCalled();
  });
});

describe("PUT /api/preferences", () => {
  it("answers 200 with the saved preference", async () => {
    const res = await put({ theme: "dark" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.theme).toBe("dark");
  });

  it.each([{ theme: "blue" }, { theme: "" }, { theme: 1 }, {}, null, []])("rejects %j with a 400 and writes nothing", async (body) => {
    const res = await put(body);
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION");
    expect(query.upsert).not.toHaveBeenCalled();
  });

  it("explains the theme rule when the value is wrong", async () => {
    const res = await put({ theme: "blue" });
    expect((await res.json()).error.message).toBe("Theme must be light or dark.");
  });

  it("rejects a body that is not JSON", async () => {
    const res = await PUT(new Request("http://localhost/api/preferences", { method: "PUT", body: "{nope" }), undefined);
    expect(res.status).toBe(400);
  });

  it("ignores an owner id in the body: the row is always the caller's", async () => {
    await put({ theme: "light", ownerId: "someone-else", owner_id: "someone-else" });
    expect(query.upsert).toHaveBeenCalledWith({ owner_id: "user-1", theme: "light" }, { onConflict: "owner_id" });
  });
});
