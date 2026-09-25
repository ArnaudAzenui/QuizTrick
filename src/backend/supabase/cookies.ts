import type { CookieOptions } from "@supabase/ssr";
import { LIMITS } from "@shared/constants";

/** FR-1.5 / SEC-8: seven days, in seconds. */
const MAX_SESSION_SECONDS = LIMITS.SESSION_MAX_DAYS * 24 * 60 * 60;

/**
 * Hardens the cookie options @supabase/ssr hands us before we write them.
 * Applied in BOTH places a session cookie is set — supabase/server.ts and
 * supabase/middleware.ts — because a cookie rewritten by one of them with
 * weaker options would quietly undo the other.
 *
 * Three changes to the library's defaults:
 *
 *   httpOnly  The cookie holds the access token, the refresh token and the
 *             whole user object. Left readable, any script on the page can
 *             lift a complete session. The library omits this so its browser
 *             client can read the session; nothing in QuizTrick uses that
 *             client (see frontend/lib/supabase-browser.ts) and all data goes
 *             through /api, so we lose nothing by closing it.
 *
 *   secure    Only outside development, where the dev server is plain HTTP
 *             and a Secure cookie would never be sent back.
 *
 *   maxAge    Capped at SESSION_MAX_DAYS. The library asks for roughly 400
 *             days, so `LIMITS.SESSION_MAX_DAYS` documented a rule that
 *             nothing enforced. Note this is time since the cookie was last
 *             written, and the middleware rewrites it on every request — so
 *             it expires after seven days of INACTIVITY, not seven days
 *             absolute. It also binds only the browser: it cannot shorten the
 *             life of a refresh token already copied elsewhere. That limit
 *             lives in Supabase → Authentication → Sessions.
 */
export function sessionCookieOptions(options: CookieOptions): CookieOptions {
  const hardened: CookieOptions = {
    ...options,
    httpOnly: true,
    secure: process.env.NODE_ENV !== "development",
  };

  if (typeof options.maxAge === "number") {
    // Only ever shortens. A deletion arrives as maxAge 0 and must stay 0.
    hardened.maxAge = Math.min(options.maxAge, MAX_SESSION_SECONDS);
    // Next recomputes Expires from maxAge; a left-over Expires would contradict it.
    delete hardened.expires;
  } else if (!options.expires) {
    hardened.maxAge = MAX_SESSION_SECONDS;
  }
  // An explicit `expires` with no maxAge is left alone: that is how a cookie
  // gets deleted by being dated into the past.

  return hardened;
}
