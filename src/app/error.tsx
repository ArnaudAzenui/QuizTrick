"use client";

import { useEffect } from "react";

/** Global error boundary — plain-language message, never a stack trace (NFR-U2, NFR-A2, NFR-A3). */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="max-w-md text-muted">QuizTrick hit a problem loading this page. Reloading usually fixes it; if not, sign in again and retry.</p>
      <button onClick={reset} className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-fg">
        Try again
      </button>
    </div>
  );
}
