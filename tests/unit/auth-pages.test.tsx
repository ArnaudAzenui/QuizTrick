import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AuthForm } from "@frontend/components/AuthForm";
import { FormField } from "@frontend/components/FormField";
import LoginPage from "@/app/(auth)/login/page";
import { loginDestination } from "@shared/auth-navigation";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));

describe("auth pages", () => {
  it.each(["link_expired", "link_invalid"])("renders a helpful message for %s", async (error) => {
    const page = await LoginPage({ searchParams: Promise.resolve({ error, next: "/texts?sort=new" }) });
    expect(page.props.next).toBe("/texts?sort=new");
    const html = renderToStaticMarkup(page);
    expect(html).toContain(error === "link_expired" ? "This link has expired." : "This link is invalid");
    expect(html).toContain('name="email"');
    expect(html).toContain('name="password"');
    expect(html).toContain('href="/forgot-password"');
  });
  it("renders registration fields and a reset form without a password", () => {
    const registration = renderToStaticMarkup(<AuthForm mode="register" />);
    expect(registration).toMatch(/<input[^>]*id="displayName"[^>]*required=""/);
    expect(registration).toMatch(/<input[^>]*id="confirmPassword"[^>]*required=""/);
    const login = renderToStaticMarkup(<AuthForm mode="login" />);
    expect(login).not.toContain('name="confirmPassword"');
    expect(login).toContain('href="/register"');
    const reset = renderToStaticMarkup(<AuthForm mode="reset" />);
    expect(reset).toContain('name="email"');
    expect(reset).not.toContain('name="password"');
  });
  it("associates field errors with the email input", () => {
    const html = renderToStaticMarkup(<FormField id="email" label="Email" error="Already registered" />);
    expect(html).toContain('aria-describedby="email-error"');
    expect(html).toContain('id="email-error" role="alert"');
  });
});

describe("login return destinations", () => {
  it("preserves local paths, queries and fragments", () => {
    expect(loginDestination("/texts?sort=new#saved")).toBe("/texts?sort=new#saved");
  });
  it.each([undefined, "", "https://evil.example", "//evil.example", "/\\evil.example", "/\n/evil.example", "javascript:alert(1)"])("rejects unsafe destination %j", (next) => {
    expect(loginDestination(next)).toBe("/dashboard");
  });
});
