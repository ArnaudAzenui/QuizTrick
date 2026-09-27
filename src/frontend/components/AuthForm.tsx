"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiClientError, errorMessage } from "@frontend/lib/api-client";
import { LIMITS, ROUTES } from "@shared/constants";
import { loginDestination, loginLinkError } from "@shared/auth-navigation";
import { FormField } from "./FormField";

type Mode = "login" | "register" | "reset";
const titles: Record<Mode, string> = { login: "Log in", register: "Create account", reset: "Forgot password" };

export function AuthForm({ mode, next, linkError }: { mode: Mode; next?: string; linkError?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const notice = loginLinkError(linkError);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "");
    const password = String(data.get("password") ?? "");
    setFields({}); setError(undefined);
    if (mode === "register") {
      const errors: Record<string, string> = {};
      if (!String(data.get("displayName") ?? "").trim()) errors.displayName = "Enter a display name.";
      if (password !== String(data.get("confirmPassword") ?? "")) errors.confirmPassword = "Passwords do not match.";
      if (Object.keys(errors).length) { setFields(errors); return; }
    }
    setBusy(true);
    try {
      if (mode === "reset") {
        await api.post("/api/auth/reset-password", { email });
        setMessage("If an account exists for this email, you'll receive a password reset link. Check your inbox.");
      } else if (mode === "register") {
        const result = await api.post<{ needsEmailConfirmation: boolean }>("/api/auth/register", {
          email, password, displayName: String(data.get("displayName") ?? ""),
        });
        if (result.needsEmailConfirmation) setMessage("Check your inbox to confirm your email.");
        else { router.replace(ROUTES.dashboard); router.refresh(); }
      } else {
        await api.post("/api/auth/login", { email, password });
        router.replace(loginDestination(next)); router.refresh();
      }
    } catch (err) {
      const errors = err instanceof ApiClientError ? { ...err.fields } : {};
      if (mode === "register" && err instanceof ApiClientError && err.status === 409) errors.email ??= err.message;
      setFields(errors);
      setError(Object.keys(errors).length ? undefined : errorMessage(err));
    } finally { setBusy(false); }
  }

  return <div className="mx-auto max-w-sm">
    <h1 className="text-2xl font-semibold tracking-tight">{titles[mode]}</h1>
    {notice && <p role="alert" className="mt-4 text-sm text-danger">{notice}</p>}
    {mode === "reset" && <p className="mt-2 text-sm text-muted">Enter your email to request a password reset link.</p>}
    {message ? <p role="status" className="mt-6">{message}</p> : <form onSubmit={submit} className="mt-6 space-y-4">
      <fieldset disabled={busy} className="space-y-4">
        {mode === "register" && <FormField id="displayName" name="displayName" label="Display name" autoComplete="nickname" required maxLength={LIMITS.DISPLAY_NAME_MAX} error={fields.displayName} />}
        <FormField id="email" name="email" label="Email" type="email" autoComplete="email" required maxLength={LIMITS.EMAIL_MAX} error={fields.email} />
        {mode !== "reset" && <FormField id="password" name="password" label="Password" type="password" required
          autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "register" ? LIMITS.PASSWORD_MIN : 1}
          maxLength={mode === "register" ? LIMITS.PASSWORD_MAX : undefined} error={fields.password} />}
        {mode === "register" && <FormField id="confirmPassword" name="confirmPassword" label="Confirm password" type="password" required
          autoComplete="new-password" maxLength={LIMITS.PASSWORD_MAX} error={fields.confirmPassword} />}
        {mode === "register" && <p className="text-xs text-muted">Use at least {LIMITS.PASSWORD_MIN} characters for your password.</p>}
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <button type="submit" disabled={busy} className="w-full rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-fg disabled:opacity-60">
          {busy ? "Please wait..." : mode === "reset" ? "Send reset link" : titles[mode]}
        </button>
      </fieldset>
    </form>}
    <div className="mt-6 flex flex-wrap gap-4 text-sm underline">
      {mode === "login" ? <><Link href={ROUTES.register}>Create account</Link><Link href={ROUTES.forgotPassword}>Forgot password?</Link></> : <Link href={ROUTES.login}>Back to login</Link>}
    </div>
  </div>;
}
