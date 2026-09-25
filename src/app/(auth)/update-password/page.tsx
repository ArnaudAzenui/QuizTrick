"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiClientError, errorMessage } from "@frontend/lib/api-client";
import { LIMITS, ROUTES } from "@shared/constants";

/**
 * Set a new password after following a reset link (FR-1.7, WBS 1.4.1.2).
 *
 * Reached only from /auth/callback, which exchanges the emailed link for a
 * session first; the middleware turns anyone without one away. Deliberately
 * plain — the styled version belongs with the rest of the auth screens.
 */
export default function Page() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFieldError(null);
    setFormError(null);
    try {
      await api.post("/api/auth/update-password", { password });
      // replace(), not push(): the reset link is spent, so Back must not
      // return to a form that can no longer submit.
      router.replace(ROUTES.dashboard);
    } catch (err) {
      if (err instanceof ApiClientError && err.fields?.password) setFieldError(err.fields.password);
      else setFormError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
      <p className="mt-2 text-sm text-muted">
        Enter a new password for your account. You&apos;ll be signed in once it&apos;s saved.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
        <div>
          <label htmlFor="password" className="block text-sm font-medium">
            New password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={LIMITS.PASSWORD_MIN}
            maxLength={LIMITS.PASSWORD_MAX}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={fieldError ? true : undefined}
            aria-describedby={fieldError ? "password-error" : "password-hint"}
            className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 outline-none focus:border-primary"
          />
          <p id="password-hint" className="mt-1 text-xs text-muted">
            At least {LIMITS.PASSWORD_MIN} characters.
          </p>
          {fieldError && (
            <p id="password-error" role="alert" className="mt-1 text-sm text-danger">
              {fieldError}
            </p>
          )}
        </div>

        {formError && (
          <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            {formError}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save new password"}
        </button>
      </form>
    </div>
  );
}
