import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { updateSession } from "@backend/supabase/middleware";

const req = (path: string) => new NextRequest(new URL(path, "http://localhost:3000"));

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("updateSession without Supabase config (skeleton mode)", () => {
  it("lets every route through in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    expect((await updateSession(req("/dashboard"))).status).toBe(200);
    expect((await updateSession(req("/"))).status).toBe(200);
  });

  it("treats the .env.example placeholder URL as missing", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://your-project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "your-anon-key");
    expect((await updateSession(req("/texts"))).status).toBe(200);
  });

  it("fails CLOSED on protected routes in production (SEC-4)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    for (const path of ["/dashboard", "/texts/abc", "/quizzes/1/results/2", "/profile"]) {
      expect((await updateSession(req(path))).status, path).toBe(503);
    }
    spy.mockRestore();
  });

  it("still serves public routes in production so the misconfiguration is visible, not fatal", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://placeholder.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "placeholder");
    expect((await updateSession(req("/"))).status).toBe(200);
    expect((await updateSession(req("/login"))).status).toBe(200);
  });
});
