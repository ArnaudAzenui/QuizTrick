import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createUserClient } from "@backend/supabase/server";
import { ROUTES } from "@shared/constants";

/**
 * GET /auth/callback - where every link Supabase emails out lands (FR-1.1, FR-1.7).
 *
 * Handles both link styles, because which one arrives depends on the email
 * template and on whether "Confirm email" is enabled:
 *   - ?code=…                 PKCE, exchanged for a session
 *   - ?token_hash=…&type=…    the verify-OTP style used by the default templates
 *
 * On success the session cookie is set and the user continues to `next`.
 * On failure they land on /login with a reason, never on a blank page.
 */

/** Email link types Supabase may send here. Anything else is not a link we issued. */
const OTP_TYPES: readonly EmailOtpType[] = ["signup", "recovery", "invite", "email_change", "magiclink", "email"];

/**
 * `next` comes from a query string, so it is attacker-controlled: without this
 * the callback would redirect anywhere, and a phishing page could be reached
 * through a genuine quiztrick.app link. Only same-origin absolute paths pass.
 * "//evil.example" and "/\evil.example" are browser-protocol-relative URLs, not
 * local paths, which is why they are rejected alongside "https://…".
 */
function safeNext(raw: string | null): string | null {
  if (!raw || !raw.startsWith("/")) return null;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return null;
  return raw;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const params = url.searchParams;
  const next = safeNext(params.get("next")) ?? ROUTES.dashboard;

  const failure = (reason: string) =>
    NextResponse.redirect(new URL(`${ROUTES.login}?error=${reason}`, url.origin));

  // Supabase reports a dead link by redirecting here with error parameters
  // rather than by failing the exchange below.
  if (params.get("error")) {
    console.error("[auth/callback] link rejected upstream", params.get("error_code"), params.get("error_description"));
    return failure(params.get("error_code") === "otp_expired" ? "link_expired" : "link_invalid");
  }

  const supabase = await createUserClient();
  const tokenHash = params.get("token_hash");
  const type = params.get("type");
  const code = params.get("code");

  if (tokenHash && type) {
    if (!OTP_TYPES.includes(type as EmailOtpType)) return failure("link_invalid");
    const { error } = await supabase.auth.verifyOtp({ type: type as EmailOtpType, token_hash: tokenHash });
    if (error) {
      console.error("[auth/callback] verifyOtp failed", error.status, error.code);
      return failure(error.code === "otp_expired" ? "link_expired" : "link_invalid");
    }
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("[auth/callback] exchangeCodeForSession failed", error.status, error.code);
      return failure("link_invalid");
    }
  } else {
    // Someone opened /auth/callback directly.
    return failure("link_invalid");
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
