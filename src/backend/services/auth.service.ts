/**
 * Authentication (WBS 1.4.1).
 *
 *   - registerUser (FR-1.1, FR-1.2)
 *   - loginUser (FR-1.3)
 *   - logoutUser (FR-1.3, SEC-8)
 *   - requestPasswordReset (FR-1.7)
 *   - updatePassword - sets a new one from the session /auth/callback established (FR-1.7)
 *   - getCurrentUser - reads the Supabase session; used by API routes and server components (FR-1.4, FR-1.5)
 *
 * Errors: throw AppError (src/backend/lib/errors.ts); routes wrap handlers with handle() from lib/api.ts.
 * Data access: user-owned rows via supabase/server.ts (RLS); answer keys + atomic RPCs via supabase/admin.ts ONLY.
 *
 * Nothing here ever echoes a Supabase error message to the client: they name
 * internal states ("Email not confirmed", "Invalid login credentials") and are
 * not written for students (NFR-U2, SEC-3).
 */
import type { z } from "zod";
import { AppError } from "@backend/lib/errors";
import { env } from "@backend/lib/env";
import { createUserClient } from "@backend/supabase/server";
import { loginSchema, registerSchema, resetPasswordSchema, updatePasswordSchema } from "@backend/validation/schemas";
import { ROUTES } from "@shared/constants";

/**
 * Where Supabase's emailed links land; the callback exchanges the code for a
 * session. Returns undefined when NEXT_PUBLIC_APP_URL is unset, which tells
 * Supabase to use the dashboard's Site URL instead of failing the request.
 */
function callbackUrl(next?: string): string | undefined {
  const origin = env.appUrl();
  if (!origin) return undefined;
  const base = `${origin}${ROUTES.authCallback}`;
  return next ? `${base}?next=${encodeURIComponent(next)}` : base;
}

export async function loginUser(input: z.infer<typeof loginSchema>) {
  const client = await createUserClient();
  const { data, error } = await client.auth.signInWithPassword(input);
  if (error?.status === 429) throw AppError.rateLimited("Too many attempts. Please try again later.");
  if (error || !data.user || !data.session) throw AppError.unauthenticated("Check your email and password and confirm your email if required.");
  // Supabase types User.email as optional (phone / anonymous sign-ins have none).
  // Falling back to the submitted address keeps the documented { userId, email }
  // contract a string rather than dropping the key from the JSON.
  return { userId: data.user.id, email: data.user.email ?? input.email };
}

/**
 * A deliberate trade: telling the caller the address is taken lets anyone probe
 * which emails have accounts, but a student who forgot they registered would
 * otherwise wait for a confirmation email that is never sent (FR-1.1).
 * /api/auth/reset-password stays silent, so that route can't be probed.
 */
const alreadyRegistered = () =>
  new AppError("CONFLICT", "That email is already registered. Try logging in instead.", {
    email: "That email is already registered.",
  });

export async function registerUser(input: z.infer<typeof registerSchema>) {
  const client = await createUserClient();
  const { data, error } = await client.auth.signUp({
    email: input.email, password: input.password,
    options: { data: { display_name: input.displayName ?? "" }, emailRedirectTo: callbackUrl() },
  });
  if (error?.status === 429) throw AppError.rateLimited("Too many attempts. Please try again later.");
  if (error?.code === "weak_password") {
    throw AppError.validation("Choose a stronger password.", { password: "Choose a stronger password." });
  }
  if (error?.code === "user_already_exists") throw alreadyRegistered();
  if (error || !data.user) throw AppError.validation("Unable to create your account. Try logging in if you already registered.");
  // The same duplicate, reported the other way. Supabase hides an existing
  // account behind a success response — but ONLY while email confirmation is
  // enabled, since with it off there is no email to hide behind and it returns
  // user_already_exists instead. The tell is an empty identities array. Both
  // are checked so this endpoint answers the same way in either configuration,
  // rather than changing behaviour when someone flips a dashboard setting.
  if ((data.user.identities?.length ?? 1) === 0) throw alreadyRegistered();
  return { userId: data.user.id, needsEmailConfirmation: !data.session };
}

/**
 * SEC-8. Ends the session in THIS browser only; other devices stay signed in,
 * which is what a student expects after logging out of a lab machine.
 * Pass scope 'global' instead to revoke every refresh token for the account.
 */
export async function logoutUser() {
  const client = await createUserClient();
  const { error } = await client.auth.signOut({ scope: "local" });
  // The cookie is cleared either way, so a failure here leaves the browser
  // signed out regardless. Reporting it would only invite the user to click
  // "log out" again on a session that is already gone.
  if (error) console.error("[auth] signOut reported an error; session cleared anyway", error.message);
  return { loggedOut: true };
}

/**
 * FR-1.7. Always reports success, whether or not the address has an account —
 * the response is the same either way, so the form can't be used to find out
 * who is registered. Failures are logged, not surfaced.
 */
export async function requestPasswordReset(input: z.infer<typeof resetPasswordSchema>) {
  const client = await createUserClient();
  const { error } = await client.auth.resetPasswordForEmail(input.email, {
    redirectTo: callbackUrl(ROUTES.updatePassword),
  });
  if (error) console.error("[auth] resetPasswordForEmail failed", error.status, error.message);
  return { sent: true };
}

/**
 * FR-1.7, second half. Runs against whatever session /auth/callback established
 * from the reset link, so the caller has already proved they control the
 * mailbox — that is what stands in for the old password here.
 *
 * An expired or already-used link leaves no session, which is why this reports
 * UNAUTHENTICATED in the link's terms rather than "please sign in": the user
 * followed a link, they did not walk into a login form.
 */
export async function updatePassword(input: z.infer<typeof updatePasswordSchema>) {
  const client = await createUserClient();
  const { data, error: sessionError } = await client.auth.getUser();
  if (sessionError || !data.user) {
    throw AppError.unauthenticated("That reset link has expired or has already been used. Request a new one.");
  }

  const { error } = await client.auth.updateUser({ password: input.password });
  if (error?.status === 429) throw AppError.rateLimited("Too many attempts. Please try again later.");
  if (error?.code === "weak_password") {
    throw AppError.validation("Choose a stronger password.", { password: "Choose a stronger password." });
  }
  // Supabase rejects reusing the current password when that policy is enabled.
  if (error?.code === "same_password") {
    throw AppError.validation("Choose a password you haven't used before.", {
      password: "Choose a password you haven't used before.",
    });
  }
  if (error) {
    console.error("[auth] updateUser(password) failed", error.status, error.code);
    throw AppError.internal("We couldn't change your password. Please request a new reset link.");
  }
  return { updated: true };
}

export interface CurrentUser {
  userId: string;
  email: string;
}

/**
 * FR-1.4, FR-1.5. The identity every other service starts from.
 *
 * getUser() and not getSession(): getSession() decodes whatever JWT is in the
 * cookie and believes it, while getUser() has Supabase verify it. A forged or
 * expired cookie has to fail here, because the value it carries becomes the
 * owner_id that RLS and the service-role client trust.
 */
export async function getCurrentUser(): Promise<CurrentUser> {
  const client = await createUserClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw AppError.unauthenticated();
  return { userId: data.user.id, email: data.user.email ?? "" };
}
