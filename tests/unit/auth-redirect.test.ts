import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { updateSession } from "@backend/supabase/middleware";

vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }) }));
afterEach(() => vi.unstubAllEnvs());

it("preserves the protected page's query string in the login return path", async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-key");
  const response = await updateSession(new NextRequest("http://localhost/texts?sort=new&page=2"));
  const destination = new URL(response.headers.get("location")!);
  expect(destination.pathname).toBe("/login");
  expect(destination.searchParams.get("next")).toBe("/texts?sort=new&page=2");
  expect([...destination.searchParams.keys()]).toEqual(["next"]);
});
