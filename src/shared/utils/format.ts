/** Formats elapsed seconds as h:mm:ss (FR-7.1). */
export function formatElapsed(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/**
 * Human-friendly date/time in the viewer's locale.
 *
 * CLIENT-ONLY. The output depends on the runtime's locale and time zone, so
 * calling it during server rendering (Vercel = UTC/en-US) and again in the
 * browser produces different strings and a React hydration mismatch. Call it
 * from a "use client" component — ideally after mount — never from a Server
 * Component. If you need a server-safe stamp, render the ISO string in a
 * <time dateTime={iso}> and format on the client.
 */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** Percent 0–100 to "80%". */
export function formatScore(score: number): string {
  return `${Math.round(score)}%`;
}
