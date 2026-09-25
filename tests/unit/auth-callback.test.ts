import { beforeEach, afterAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { verifyOtp, exchangeCodeForSession } = vi.hoisted(() => ({
  verifyOtp: vi.fn(),
  exchangeCodeForSession: vi.fn(),
}));
vi.mock("@backend/supabase/server", () => ({
  createUserClient: async () => ({ auth: { verifyOtp, exchangeCodeForSession } }),
}));

import { GET } from "@/app/auth/callback/route";

const call = (query: string) => GET(new NextRequest(new URL(`/auth/callback${query}`, "http://localhost:3000")));
const location = async (query: string) => (await call(query)).headers.get("location");

const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
afterAll(() => quiet.mockRestore());

beforeEach(() => {
  vi.clearAllMocks();
  verifyOtp.mockResolvedValue({ error: null });
  exchangeCodeForSession.mockResolvedValue({ error: null });
});

describe("GET /auth/callback", () => {
  it("exchanges a PKCE code and continues to the default destination", async () => {
    expect(await location("?code=real-code")).toBe("http://localhost:3000/dashboard");
    expect(exchangeCodeForSession).toHaveBeenCalledWith("real-code");
  });

  it("verifies a token_hash link and honours a same-origin next", async () => {
    expect(await location("?token_hash=abc&type=recovery&next=%2Fupdate-password")).toBe(
      "http://localhost:3000/update-password",
    );
    expect(verifyOtp).toHaveBeenCalledWith({ type: "recovery", token_hash: "abc" });
  });

  // The reason safeNext() exists: `next` arrives from a query string, so
  // without this a link on our own domain would forward to an attacker's.
  it.each([
    ["an absolute https URL", "https://evil.example/phish"],
    ["an absolute http URL", "http://evil.example"],
    ["a protocol-relative URL", "//evil.example"],
    ["a backslash-escaped URL", "/\\evil.example"],
    ["an encoded protocol-relative URL", "%2F%2Fevil.example"],
  ])("never redirects off-origin: %s", async (_label, next) => {
    const target = await location(`?code=real-code&next=${encodeURIComponent(next)}`);
    expect(target).toBe("http://localhost:3000/dashboard");
    expect(new URL(target!).origin).toBe("http://localhost:3000");
  });

  it("sends a dead link to /login rather than a blank page", async () => {
    expect(await location("?error=access_denied&error_code=otp_expired")).toBe(
      "http://localhost:3000/login?error=link_expired",
    );
    expect(await location("?error=access_denied&error_code=something_else")).toBe(
      "http://localhost:3000/login?error=link_invalid",
    );
  });

  it("reports an expired token_hash as expired, not merely invalid", async () => {
    verifyOtp.mockResolvedValue({ error: { status: 403, code: "otp_expired" } });
    expect(await location("?token_hash=abc&type=recovery")).toBe("http://localhost:3000/login?error=link_expired");
  });

  it("rejects a token type we never issue, without calling Supabase", async () => {
    expect(await location("?token_hash=abc&type=../../etc/passwd")).toBe(
      "http://localhost:3000/login?error=link_invalid",
    );
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("rejects a bare visit to the callback", async () => {
    expect(await location("")).toBe("http://localhost:3000/login?error=link_invalid");
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("reports a failed code exchange as an invalid link", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: { status: 400, code: "flow_state_not_found" } });
    expect(await location("?code=stale")).toBe("http://localhost:3000/login?error=link_invalid");
  });
});
