"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@frontend/lib/api-client";
import type { Preference } from "@shared/types";
import type { Theme } from "@shared/constants";

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;

  try {
    localStorage.setItem("quiztrick-theme", theme);
  } catch {
    // Theme changes still work when browser storage is blocked.
  }
}

export function ThemeToggle({ account = true }: { account?: boolean }) {
  const [dark, setDark] = useState(false);
  const [ready, setReady] = useState(!account);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const saveInProgress = useRef(false);

  useEffect(() => {
    let active = true;
    setDark(document.documentElement.dataset.theme === "dark");
    if (!account) return;

    setReady(false);
    setError("");

    async function loadTheme() {
      try {
        const preference = await api.get<Preference>("/api/preferences");
        if (!active) return;

        applyTheme(preference.theme);
        setDark(preference.theme === "dark");
        setReady(true);
      } catch {
        if (active) setError("Couldn't load your account theme.");
      }
    }

    void loadTheme();
    return () => { active = false; };
  }, [account, retry]);

  async function toggleTheme() {
    if (!ready || saveInProgress.current) return;

    const previous: Theme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    const theme = previous === "dark" ? "light" : "dark";

    applyTheme(theme);
    setDark(theme === "dark");
    setError("");
    if (!account) return;

    // Guard against a second click before React renders the disabled button.
    saveInProgress.current = true;
    setSaving(true);

    try {
      const preference = await api.put<Preference>("/api/preferences", { theme });
      applyTheme(preference.theme);
      setDark(preference.theme === "dark");
    } catch {
      applyTheme(previous);
      setDark(previous === "dark");
      setError("Couldn't save your theme. Please try again.");
    } finally {
      saveInProgress.current = false;
      setSaving(false);
    }
  }

  const label = dark ? "Switch to light mode" : "Switch to dark mode";
  let title = label;
  if (!ready) title = "Loading account theme";
  else if (saving) title = "Saving theme";

  return (
    <div className="flex max-w-xs flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => void toggleTheme()}
        disabled={!ready || saving}
        aria-label={label}
        aria-pressed={dark}
        aria-busy={!ready || saving}
        title={title}
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-fg hover:border-primary disabled:cursor-wait"
      >
        <svg
          aria-hidden="true"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {dark ? (
            <path d="M20.9 13.1A9 9 0 0 1 10.9 3.1a9 9 0 1 0 10 10Z" />
          ) : (
            <>
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5" />
            </>
          )}
        </svg>
      </button>

      {error && (
        <span role="alert" className="text-xs text-danger">
          {error}{" "}
          {!ready && (
            <button type="button" className="underline" onClick={() => setRetry(value => value + 1)}>
              Retry theme
            </button>
          )}
        </span>
      )}
    </div>
  );
}
