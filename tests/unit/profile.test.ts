import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn(), select: vi.fn(), update: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() }));
vi.mock("@backend/supabase/server", () => ({ createUserClient: async () => ({ auth: { getUser: db.getUser }, from: db.from }) }));
import { GET, PATCH } from "@/app/api/profile/route";

const row = { id: "user-1", email: "student@example.com", display_name: "Student", created_at: "2026-09-01T00:00:00Z" };
const request = (body?: unknown) => new Request("http://localhost/api/profile", body === undefined ? undefined : { method: "PATCH", body: JSON.stringify(body) });

beforeEach(() => {
  vi.clearAllMocks();
  db.getUser.mockResolvedValue({ data: { user: { id: row.id, email: row.email } }, error: null });
  for (const method of [db.from, db.select, db.update, db.eq]) method.mockReturnValue(db);
  db.maybeSingle.mockResolvedValue({ data: row, error: null });
});

describe("profile endpoints", () => {
  it("returns the authenticated user's mapped profile", async () => {
    const response = await GET(request(), undefined);
    expect(await response.json()).toEqual({ ok: true, data: { userId: row.id, email: row.email, displayName: row.display_name, createdAt: row.created_at } });
    expect(db.eq).toHaveBeenCalledWith("id", "user-1");
  });
  it.each(["GET", "PATCH"])("requires authentication for %s", async (method) => {
    db.getUser.mockResolvedValue({ data: { user: null }, error: null });
    const response = method === "GET" ? await GET(request(), undefined) : await PATCH(request({ displayName: "New" }), undefined);
    expect(response.status).toBe(401);
    expect(db.from).not.toHaveBeenCalled();
  });
  it("only changes display_name on the authenticated user's row", async () => {
    db.maybeSingle.mockResolvedValue({ data: { ...row, display_name: "New name" }, error: null });
    const response = await PATCH(request({ displayName: "  New name  ", userId: "someone-else", email: "other@example.com" }), undefined);
    expect(response.status).toBe(200);
    expect((await response.json()).data.displayName).toBe("New name");
    expect(db.update).toHaveBeenCalledWith({ display_name: "New name" });
    expect(db.eq).toHaveBeenCalledWith("id", "user-1");
  });
  it.each(["", "   ", "x".repeat(61)])("rejects invalid display name %j", async (displayName) => {
    const response = await PATCH(request({ displayName }), undefined);
    expect(response.status).toBe(400);
    expect((await response.json()).error.fields.displayName).toBeTruthy();
    expect(db.update).not.toHaveBeenCalled();
  });
  it("returns 404 for a missing profile", async () => {
    db.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect((await GET(request(), undefined)).status).toBe(404);
  });
  it.each(["GET", "PATCH"])("hides database errors on %s", async (method) => {
    db.maybeSingle.mockResolvedValue({ data: null, error: { message: "private database details" } });
    const response = method === "GET" ? await GET(request(), undefined) : await PATCH(request({ displayName: "New" }), undefined);
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("private database details");
  });
});
