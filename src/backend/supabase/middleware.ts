import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { PROTECTED_PREFIXES, ROUTES } from "@shared/constants";
import { sessionCookieOptions } from "./cookies";

/**
 * Refreshes the Supabase session cookie on every request and enforces
 * FR-1.4: unauthenticated visitors hitting a protected path are redirected
 * to /login (with ?next= so they land where they intended after sign-in).
 * Called from src/middleware.ts.
 */
export async function updateSession(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));

  // Until the Supabase project exists (WBS 1.3.4.2) and .env.local is filled
  // in (WBS 1.3.4.4), skip auth so the skeleton runs out of the box — but only
  // in development. In production a missing config must fail CLOSED: protected
  // routes return 503 instead of silently becoming public (SEC-4, FR-1.4).
  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes("your-project") || supabaseUrl.includes("placeholder")) {
    if (process.env.NODE_ENV === "production" && isProtected) {
      console.error("[middleware] Supabase env vars missing or placeholder in production; refusing protected route", pathname);
      return new NextResponse("QuizTrick is not configured yet. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.", {
        status: 503,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, sessionCookieOptions(options)));
      },
    },
  });

  // getUser() validates the JWT with Supabase; do not use getSession() here.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthPage = pathname === ROUTES.login || pathname === ROUTES.register;

  // Redirects must carry any refreshed session cookies that getUser() set.
  const redirectWithCookies = (url: URL) => {
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  };

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = ROUTES.login;
    url.searchParams.set("next", pathname);
    return redirectWithCookies(url);
  }

  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = ROUTES.dashboard;
    url.search = "";
    return redirectWithCookies(url);
  }

  return response;
}
