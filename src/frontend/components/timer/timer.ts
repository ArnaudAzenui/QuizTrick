import { LIMITS } from "@shared/constants";
export type TimerSession = { startTime: string; endTime: string; taskId?: string };
export const MAX_TIMER_MS = LIMITS.SESSION_MAX_SECONDS * 1000;
/** Longest countdown the form accepts: the same 24-hour session cap, in minutes (1440). */
export const MAX_COUNTDOWN_MINUTES = LIMITS.SESSION_MAX_SECONDS / 60;
/** Timestamp arithmetic stays accurate when background tabs throttle intervals. */
export function elapsedMilliseconds(startTime: string, now: number): number {
  return Math.min(MAX_TIMER_MS, Math.max(0, now - Date.parse(startTime)));
}
export function finishSession(startTime: string, now: number, taskId: string): TimerSession {
  return { startTime, endTime: new Date(Date.parse(startTime) + elapsedMilliseconds(startTime, now)).toISOString(), ...(taskId ? { taskId } : {}) };
}

export type TimerMode = "stopwatch" | "countdown";

export function timerLimitMilliseconds(mode: TimerMode, durationMinutes: number): number {
  return mode === "countdown" ? durationMinutes * 60 * 1000 : MAX_TIMER_MS;
}

export function timerDisplaySeconds(mode: TimerMode, durationMinutes: number, elapsedSeconds: number): number {
  return mode === "countdown" ? Math.max(0, durationMinutes * 60 - Math.floor(elapsedSeconds)) : Math.floor(elapsedSeconds);
}
