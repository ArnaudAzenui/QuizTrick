/**
 * Formats elapsed seconds as h:mm:ss (FR-7.1).
 *
 * Non-finite input reads as 0 rather than rendering "NaN:NaN:NaN" in the timer:
 * this runs every second off a value derived from Date arithmetic, and one bad
 * subtraction should not put garbage on screen (NFR-U2).
 */
export function formatElapsed(totalSeconds: number): string {
  const s = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
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

/** Percent 0–100 to "80%". Clamped, so a bad score never renders as "NaN%". */
export function formatScore(score: number): string {
  if (!Number.isFinite(score)) return "0%";
  return `${Math.min(100, Math.max(0, Math.round(score)))}%`;
}
