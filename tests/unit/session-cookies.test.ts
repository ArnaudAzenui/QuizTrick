import { afterEach, describe, expect, it, vi } from "vitest";
import { sessionCookieOptions } from "@backend/supabase/cookies";
import { LIMITS } from "@shared/constants";

const CAP = LIMITS.SESSION_MAX_DAYS * 24 * 60 * 60;
/** What @supabase/ssr actually asks for: roughly 400 days. */
const LIBRARY_DEFAULT = 34_560_000;

afterEach(() => vi.unstubAllEnvs());

describe("sessionCookieOptions", () => {
  it("closes the session cookie to JavaScript (it holds both tokens)", () => {
    expect(sessionCookieOptions({}).httpOnly).toBe(true);
  });

  it("caps the lifetime at SESSION_MAX_DAYS (FR-1.5, SEC-8)", () => {
    expect(sessionCookieOptions({ maxAge: LIBRARY_DEFAULT }).maxAge).toBe(CAP);
    expect(CAP).toBeLessThan(LIBRARY_DEFAULT);
  });

  it("only ever shortens — a shorter request is left alone", () => {
    expect(sessionCookieOptions({ maxAge: 60 }).maxAge).toBe(60);
  });

  // If capping rewrote this to a week, signOut would stop clearing the cookie.
  it("preserves a deletion (maxAge 0)", () => {
    expect(sessionCookieOptions({ maxAge: 0 }).maxAge).toBe(0);
  });

  it("preserves a deletion expressed as a past expiry", () => {
    const past = new Date(0);
    const out = sessionCookieOptions({ expires: past });
    expect(out.expires).toBe(past);
    expect(out.maxAge).toBeUndefined();
  });

  it("drops a stale expires when it has capped maxAge, so the two can't disagree", () => {
    const out = sessionCookieOptions({ maxAge: LIBRARY_DEFAULT, expires: new Date("2027-01-01") });
    expect(out.expires).toBeUndefined();
    expect(out.maxAge).toBe(CAP);
  });

  it("applies the cap when the library asks for neither", () => {
    expect(sessionCookieOptions({}).maxAge).toBe(CAP);
  });

  it("marks the cookie Secure outside development only", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(sessionCookieOptions({}).secure).toBe(true);
    vi.stubEnv("NODE_ENV", "development");
    // The dev server is plain HTTP; a Secure cookie would never come back.
    expect(sessionCookieOptions({}).secure).toBe(false);
  });

  it("keeps the options it isn't there to change", () => {
    expect(sessionCookieOptions({ path: "/", sameSite: "lax", domain: "example.test" })).toMatchObject({
      path: "/",
      sameSite: "lax",
      domain: "example.test",
    });
  });
});
