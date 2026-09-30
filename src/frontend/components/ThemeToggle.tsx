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
      aria-label="Dark mode"
      aria-pressed={dark}
      className="fixed bottom-4 right-4 z-50 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-fg shadow-md hover:border-primary"
    >
      {dark ? "Light mode" : "Dark mode"}
    </button>
  );
}