import { beforeEach, describe, expect, it, vi } from "vitest";
const { signInWithPassword, signUp } = vi.hoisted(() => ({ signInWithPassword: vi.fn(), signUp: vi.fn() }));
vi.mock("@backend/supabase/server", () => ({ createUserClient: async () => ({ auth: { signInWithPassword, signUp } }) }));
import { POST as login } from "@/app/api/auth/login/route";
import { POST as register } from "@/app/api/auth/register/route";
const request = (body: unknown) => new Request("http://localhost/api/auth/login", { method: "POST", body: JSON.stringify(body) });
const credentials = { email: "student@example.com", password: "password123" };
beforeEach(() => vi.clearAllMocks());
describe("authentication endpoints", () => {
  it("rejects invalid input before contacting Supabase", async () => {
    expect((await login(request({ email: "invalid", password: "" }), undefined)).status).toBe(400);
    expect(signInWithPassword).not.toHaveBeenCalled();
  });
  it("returns the user without leaking session tokens", async () => {
    signInWithPassword.mockResolvedValue({ data: { user: { id: "user-1", email: credentials.email }, session: { access_token: "secret" } }, error: null });
    const response = await login(request(credentials), undefined);
    expect(await response.json()).toEqual({ ok: true, data: { userId: "user-1", email: credentials.email } });
  });
  it("rejects invalid credentials with a safe message", async () => {
    signInWithPassword.mockResolvedValue({ data: {}, error: { status: 400, message: "private details" } });
    const response = await login(request(credentials), undefined);
    expect(response.status).toBe(401);
    expect(await response.text()).not.toContain("private details");
  });
  it("preserves rate limiting", async () => {
    signInWithPassword.mockResolvedValue({ data: {}, error: { status: 429 } });
    expect((await login(request(credentials), undefined)).status).toBe(429);
  });
  it("requires confirmation when signup has no session", async () => {
    signUp.mockResolvedValue({ data: { user: { id: "user-1" }, session: null }, error: null });
    const response = await register(request(credentials), undefined);
    expect(response.status).toBe(201);
    expect((await response.json()).data.needsEmailConfirmation).toBe(true);
  });
});
