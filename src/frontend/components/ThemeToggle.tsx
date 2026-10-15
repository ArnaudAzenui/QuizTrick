"use client";

import { useEffect, useState } from "react";


export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.dataset.theme === "dark");
  }, []);

  function toggleTheme() {
    const nextDark = document.documentElement.dataset.theme !== "dark";
    const theme = nextDark ? "dark" : "light";
    document.documentElement.dataset.theme = theme;
    setDark(nextDark);
    try {
      localStorage.setItem("quiztrick-theme", theme);
    } catch {
      // The toggle still works when browser storage is unavailable.
    }
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-fg hover:border-primary"
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
            <path d="M9 18h6M9 21h6M9 15c0-2-3-3-3-6a6 6 0 0 1 12 0c0 3-3 4-3 6" />
            <path d="M12 1v1M3 3l1 1M1 9h2M21 9h2M20 4l1-1" />
          </>
        )}
      </svg>
    </button>
  );
}