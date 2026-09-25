/**
 * Server-side environment access. Import this ONLY from src/backend or
 * src/app/api — never from a client component (SEC-3).
 */
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable ${name}. See .env.example.`);
  return v;
}

export const env = {
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: () => required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  supabaseServiceRoleKey: () => required("SUPABASE_SERVICE_ROLE_KEY"),
  /**
   * Origin used to build the links Supabase emails out (confirmation, password
   * reset). Optional on purpose: when it is unset Supabase falls back to the
   * Site URL configured in the dashboard, which is a working answer. Making it
   * required would mean a missing Vercel variable takes registration down over
   * a setting that only decorates an email link (docs/SETUP.md §3).
   */
  appUrl: (): string | undefined => process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") || undefined,
  ai: () => ({
    provider: process.env.AI_PROVIDER ?? "openai",
    apiKey: required("AI_API_KEY"),
    model: process.env.AI_MODEL ?? "gpt-4o-mini",
    baseUrl: process.env.AI_BASE_URL ?? "https://api.openai.com/v1",
  }),
};
