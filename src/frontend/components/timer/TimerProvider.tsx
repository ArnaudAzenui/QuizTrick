"use client";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { api, errorMessage } from "@frontend/lib/api-client";
import type { StudySession } from "@shared/types";
import { formatElapsed } from "@shared/utils/format";
import { ROUTES } from "@shared/constants";
import { elapsedMilliseconds, finishSession, MAX_COUNTDOWN_MINUTES, timerLimitMilliseconds, timerDisplaySeconds, type TimerMode, type TimerSession } from "./timer";

type TimerContextValue = {
  mode: TimerMode; setMode: (mode: TimerMode) => void; durationMinutes: number; setDurationMinutes: (minutes: number) => void; displaySeconds: number; completed: boolean;
  running: boolean; elapsedSeconds: number; taskId: string; setTaskId: (id: string) => void;
  pending: TimerSession | null; saving: boolean; message: string; saveError: boolean;
  start: () => void; stop: () => void; reset: () => void; save: () => void;
};
const TimerContext = createContext<TimerContextValue | null>(null);
export function TimerProvider({ children }: { children: ReactNode }) {
  const [mode, updateMode] = useState<TimerMode>("stopwatch");
  const [durationMinutes, updateDurationMinutes] = useState(25);
  const [completed, setCompleted] = useState(false);
  const limit = timerLimitMilliseconds(mode, durationMinutes);
  const [startTime, setStartTime] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [taskId, setTaskId] = useState("");
  const [pending, setPending] = useState<TimerSession | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [saveError, setSaveError] = useState(false);
  const savingRef = useRef(false);
  const runningRef = useRef<string | null>(null);
  async function saveSession(session: TimerSession) {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setMessage("");
    setSaveError(false);
    try {
      await api.post<StudySession>("/api/sessions", session);
      setPending(null);
      setMessage("Study session saved.");
    } catch (err) { setSaveError(true); setMessage(errorMessage(err)); }
    finally { savingRef.current = false; setSaving(false); }
  }
  function stop() {
    const started = runningRef.current;
    if (!started) return;
    runningRef.current = null;
    const session = finishSession(started, Math.min(Date.now(), Date.parse(started) + limit), taskId);
    setElapsedSeconds(elapsedMilliseconds(started, Date.parse(session.endTime)) / 1000);
    setStartTime(null);
    setPending(session);
    void saveSession(session);
  }
  useEffect(() => {
    if (!startTime) return;
    const tick = () => {
      const elapsed = Math.min(limit, elapsedMilliseconds(startTime, Date.now()));
      setElapsedSeconds(Math.floor(elapsed / 1000));
      if (elapsed >= limit && runningRef.current === startTime) {
        runningRef.current = null;
        const session = finishSession(startTime, Date.parse(startTime) + limit, taskId);
        setCompleted(mode === "countdown");
        setStartTime(null);
        setPending(session);
        void saveSession(session);
      }
    };
    tick();
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [startTime, taskId, limit, mode]);
  function start() {
    if (runningRef.current || pending || savingRef.current) return;
    const started = new Date().toISOString();
    runningRef.current = started;
    setStartTime(started);
    setCompleted(false);
    setElapsedSeconds(0);
    setMessage("");
    setSaveError(false);
  }
  function reset() {
    if (savingRef.current) return;
    runningRef.current = null;
    setStartTime(null);
    setCompleted(false);
    setElapsedSeconds(0);
    setPending(null);
    setMessage("");
    setSaveError(false);
  }
  function setMode(next: TimerMode) {
    if (runningRef.current || pending || savingRef.current) return;
    reset();
    updateMode(next);
  }
  function setDurationMinutes(minutes: number) {
    if (runningRef.current || pending || savingRef.current) return;
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > MAX_COUNTDOWN_MINUTES) return;
    reset();
    updateDurationMinutes(minutes);
  }
  return <TimerContext.Provider value={{ mode, setMode, durationMinutes, setDurationMinutes, completed, displaySeconds: timerDisplaySeconds(mode, durationMinutes, elapsedSeconds), running: startTime !== null, elapsedSeconds, taskId, setTaskId, pending, saving, message, saveError, start, stop, reset, save: () => { if (pending) void saveSession(pending); } }}>{children}</TimerContext.Provider>;
}
export function useTimer() {
  const context = useContext(TimerContext);
  if (!context) throw new Error("useTimer requires TimerProvider");
  return context;
}
export function TimerIndicator() {
  const timer = useTimer();
  if (!timer.running && !timer.pending && !timer.message && !timer.saving) return null;
  return <Link href={ROUTES.timer} className="text-sm text-primary">{timer.mode === "countdown" ? "Countdown" : "Stopwatch"} {formatElapsed(timer.displaySeconds)}{timer.saving ? " - Saving..." : timer.pending ? " - Unsaved" : timer.running ? " - Running" : " - Stopped"}</Link>;
}
