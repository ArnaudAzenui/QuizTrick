const isDev = process.env.NODE_ENV === "development";

/**
 * Content-Security-Policy (SEC-1, SEC-5).
 *
 * `script-src` still allows 'unsafe-inline' because Next's hydration bootstrap
 * is an inline script; removing it means generating a per-request nonce in the
 * middleware and threading it through. Worth doing later — the value even as it
 * stands is that an injected `<script src="https://evil.example">` won't load,
 * and neither will an exfiltration `fetch()` to anywhere but our own origin and
 * Supabase. `frame-ancestors` is the header version of X-Frame-Options.
 */
function contentSecurityPolicy() {
  // next.config.mjs is evaluated at BUILD time, so NEXT_PUBLIC_SUPABASE_URL may
  // not be set yet (it is on Vercel; it isn't for a bare `next build`). The
  // wildcards make the policy correct either way — getting this wrong doesn't
  // fail the build, it blocks every Supabase call at runtime. The exact project
  // URL is added too whenever the build does know it.
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const connect = [
    "'self'",
    "https://*.supabase.co",
    "wss://*.supabase.co", // realtime socket, same host
    supabase,
    supabase.replace(/^https:/, "wss:"),
    isDev ? "ws://localhost:*" : "",
  ].filter((v, i, all) => v && all.indexOf(v) === i);

  return [
    "default-src 'self'",
    // 'unsafe-eval' is only needed by the dev-mode React refresh runtime.
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src ${connect.join(" ")}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Don't advertise the framework and version to scanners (SEC-1).
  poweredByHeader: false,
  // Security headers (SEC-1, SEC-5). HSTS is applied by Vercel automatically on HTTPS.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Content-Security-Policy", value: contentSecurityPolicy() },
          // QuizTrick asks for none of these; deny them up front.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
