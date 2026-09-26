"use client";

import { useEffect, useState, type FormEvent } from "react";
import { api, ApiClientError, errorMessage } from "@frontend/lib/api-client";
import { FormField } from "@frontend/components/FormField";
import { LIMITS } from "@shared/constants";
import type { UserProfile } from "@shared/types";

export default function Page() {
  const [profile, setProfile] = useState<UserProfile>();
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  const [fieldError, setFieldError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setError(undefined);
    api.get<UserProfile>("/api/profile").then((data) => {
      if (active) { setProfile(data); setName(data.displayName); }
    }).catch((err: unknown) => { if (active) setError(errorMessage(err)); });
    return () => { active = false; };
  }, [attempt]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(undefined); setFieldError(undefined); setSaved(false);
    try {
      const data = await api.patch<UserProfile>("/api/profile", { displayName: name });
      setProfile(data); setName(data.displayName); setSaved(true);
    } catch (err) {
      if (err instanceof ApiClientError && err.fields?.displayName) setFieldError(err.fields.displayName);
      else setError(errorMessage(err));
    } finally { setBusy(false); }
  }

  return <div className="max-w-md">
    <h1 className="text-2xl font-semibold">Profile</h1>
    {error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}
    {!profile ? error ? <button className="mt-4 underline" onClick={() => setAttempt(attempt + 1)}>Try again</button> : <p role="status" className="mt-4">Loading profile...</p> : <>
      <dl className="mt-6"><dt className="text-sm font-medium">Email</dt><dd className="mt-1 text-muted">{profile.email}</dd></dl>
      <form onSubmit={save} className="mt-6 space-y-4">
        <FormField id="displayName" name="displayName" label="Display name" autoComplete="nickname" required maxLength={LIMITS.DISPLAY_NAME_MAX}
          value={name} onChange={(event) => { setName(event.target.value); setSaved(false); }} disabled={busy} error={fieldError} />
        <button type="submit" disabled={busy} className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-fg disabled:opacity-60">{busy ? "Saving..." : "Save display name"}</button>
        {saved && <p role="status">Your display name has been updated.</p>}
      </form>
    </>}
  </div>;
}
