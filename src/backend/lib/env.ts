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
  ai: () => ({
    provider: process.env.AI_PROVIDER ?? "openai",
    apiKey: required("AI_API_KEY"),
    model: process.env.AI_MODEL ?? "gpt-4o-mini",
    baseUrl: process.env.AI_BASE_URL ?? "https://api.openai.com/v1",
  }),
};
