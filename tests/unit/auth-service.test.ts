import { beforeEach, afterAll, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  signUp: vi.fn(),
  signOut: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
  getUser: vi.fn(),
}));
vi.mock("@backend/supabase/server", () => ({ createUserClient: async () => ({ auth }) }));

import { AppError } from "@backend/lib/errors";
import {
  getCurrentUser,
  logoutUser,
  registerUser,
  requestPasswordReset,
  updatePassword,
} from "@backend/services/auth.service";

const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
afterAll(() => quiet.mockRestore());

const signedIn = { data: { user: { id: "user-1", email: "student@school.edu" } }, error: null };
const credentials = { email: "student@school.edu", password: "password123" };

/** Runs fn and returns the AppError it threw, failing the test if it didn't throw. */
async function caught(fn: () => Promise<unknown>): Promise<AppError> {
  try {
    await fn();
  } catch (err) {
    expect(err).toBeInstanceOf(AppError);
    return err as AppError;
  }
  throw new Error("expected the call to throw");
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.signOut.mockResolvedValue({ error: null });
  auth.resetPasswordForEmail.mockResolvedValue({ error: null });
  auth.updateUser.mockResolvedValue({ error: null });
  auth.getUser.mockResolvedValue(signedIn);
});

describe("registerUser", () => {
  // Supabase reports a duplicate one way with email confirmation off and the
  // other way with it on. Both must reach the caller as the same 409, or the
  // API changes behaviour when someone flips a dashboard setting.
  it("reports an explicit user_already_exists as CONFLICT", async () => {
    auth.signUp.mockResolvedValue({ data: {}, error: { status: 422, code: "user_already_exists" } });
    const err = await caught(() => registerUser(credentials));
    expect(err.code).toBe("CONFLICT");
    expect(err.status).toBe(409);
    expect(err.fields?.email).toBeTruthy();
  });

  it("reports the obfuscated duplicate (empty identities) as the same CONFLICT", async () => {
    auth.signUp.mockResolvedValue({
      data: { user: { id: "user-1", identities: [] }, session: null },
      error: null,
    });
    expect((await caught(() => registerUser(credentials))).status).toBe(409);
  });

  it("does not mistake a genuine new signup for a duplicate", async () => {
    auth.signUp.mockResolvedValue({
      data: { user: { id: "user-1", identities: [{ id: "i1" }] }, session: null },
      error: null,
    });
    await expect(registerUser(credentials)).resolves.toEqual({ userId: "user-1", needsEmailConfirmation: true });
  });

  it("surfaces a weak password on the password field", async () => {
    auth.signUp.mockResolvedValue({ data: {}, error: { status: 422, code: "weak_password" } });
    const err = await caught(() => registerUser(credentials));
    expect(err.code).toBe("VALIDATION");
    expect(err.fields?.password).toBeTruthy();
  });
});

describe("logoutUser", () => {
  it("ends only this browser's session (SEC-8)", async () => {
    await logoutUser();
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("still reports success when Supabase errors, because the cookie is gone anyway", async () => {
    auth.signOut.mockResolvedValue({ error: { message: "network down" } });
    await expect(logoutUser()).resolves.toEqual({ loggedOut: true });
  });
});

describe("requestPasswordReset", () => {
  it("answers identically whether or not the address has an account", async () => {
    const forKnown = await requestPasswordReset({ email: "known@school.edu" });
    auth.resetPasswordForEmail.mockResolvedValue({ error: { status: 400, message: "User not found" } });
    const forUnknown = await requestPasswordReset({ email: "nobody@school.edu" });
    expect(forKnown).toEqual({ sent: true });
    expect(forUnknown).toEqual(forKnown);
  });
});

describe("updatePassword", () => {
  it("refuses when the link left no session", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null }, error: { status: 401 } });
    const err = await caught(() => updatePassword({ password: "brand-new-pass" }));
    expect(err.code).toBe("UNAUTHENTICATED");
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("updates the password when the session is valid", async () => {
    await expect(updatePassword({ password: "brand-new-pass" })).resolves.toEqual({ updated: true });
    expect(auth.updateUser).toHaveBeenCalledWith({ password: "brand-new-pass" });
  });

  it("puts a reused-password rejection on the password field", async () => {
    auth.updateUser.mockResolvedValue({ error: { status: 422, code: "same_password" } });
    expect((await caught(() => updatePassword({ password: "brand-new-pass" }))).fields?.password).toBeTruthy();
  });

  it("never echoes Supabase's wording for an unexpected failure", async () => {
    auth.updateUser.mockResolvedValue({ error: { status: 500, code: "x", message: "internal detail" } });
    expect((await caught(() => updatePassword({ password: "brand-new-pass" }))).message).not.toContain("internal detail");
  });
});

describe("getCurrentUser", () => {
  it("returns the verified identity", async () => {
    await expect(getCurrentUser()).resolves.toEqual({ userId: "user-1", email: "student@school.edu" });
  });

  it("rejects a cookie Supabase will not vouch for", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null }, error: { status: 401 } });
    expect((await caught(() => getCurrentUser())).code).toBe("UNAUTHENTICATED");
  });
});
