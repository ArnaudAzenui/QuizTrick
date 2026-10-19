"use client";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@frontend/lib/api-client";
import type { StudyTask } from "@shared/types";
import { formatElapsed } from "@shared/utils/format";
import { useTimer } from "./TimerProvider";
export function StudyTimer() {
  const timer = useTimer();
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [taskError, setTaskError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [confirmReset, setConfirmReset] = useState(false);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setTaskError("");
    void api.get<StudyTask[]>("/api/tasks?scope=all").then(data => { if (active) setTasks(data); })
      .catch(err => { if (active) setTaskError(errorMessage(err)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retry]);
  const locked = timer.running || timer.pending !== null || timer.saving;
  const button = "rounded-xl border border-border px-4 py-2 text-sm font-medium disabled:opacity-50";
  function reset() {
    if ((timer.running || timer.pending) && !confirmReset) { setConfirmReset(true); return; }
    timer.reset();
    setConfirmReset(false);
  }
  return <div className="mx-auto max-w-2xl space-y-6">
    <header><h1 className="text-2xl font-semibold">Study timer</h1></header>
    <section aria-label="Study timer controls" className="space-y-5 rounded-2xl border border-border bg-surface p-6">
      <fieldset disabled={locked} className="space-y-3">
        <legend className="text-sm font-medium">Timer mode</legend>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2"><input type="radio" name="timer-mode" value="countdown" checked={timer.mode === "countdown"} onChange={() => { setConfirmReset(false); timer.setMode("countdown"); }} />Countdown</label>
          <label className="flex items-center gap-2"><input type="radio" name="timer-mode" value="stopwatch" checked={timer.mode === "stopwatch"} onChange={() => { setConfirmReset(false); timer.setMode("stopwatch"); }} />Stopwatch (until stopped)</label>
        </div>
        {timer.mode === "countdown" && <div>
          <label htmlFor="countdown-minutes" className="block text-sm font-medium">Countdown duration (minutes)</label>
          <input id="countdown-minutes" type="number" min={1} max={1440} step={1} value={timer.durationMinutes}
            onChange={event => timer.setDurationMinutes(Number(event.target.value))}
            className="mt-2 w-full rounded-xl border border-border bg-surface px-3 py-2" />
          <p className="mt-1 text-sm text-muted">1 to 1,440 minutes. Stops automatically at zero and saves the session.</p>
        </div>}
      </fieldset>
      <p role="timer" aria-label={timer.mode === "countdown" ? "Remaining study time" : "Elapsed study time"} className="text-center text-5xl font-semibold tabular-nums">{formatElapsed(timer.displaySeconds)}</p>
      <div><label htmlFor="timer-task" className="block text-sm font-medium">Task (optional)</label>
        <select id="timer-task" value={timer.taskId} disabled={locked || loading} onChange={event => timer.setTaskId(event.target.value)} className="mt-2 w-full rounded-xl border border-border bg-surface px-3 py-2">
          <option value="">No linked task</option>
          {timer.taskId && !tasks.some(task => task.taskId === timer.taskId) && <option value={timer.taskId}>Selected task</option>}
          {tasks.map(task => <option key={task.taskId} value={task.taskId}>{task.subject}{task.isComplete ? " (completed)" : ""}</option>)}
        </select>
        {loading && <p role="status" className="mt-2 text-sm text-muted">Loading tasks...</p>}
        {taskError && <div className="mt-2 text-sm"><p role="alert">{taskError} You can still start without a task.</p><button type="button" className="underline" onClick={() => setRetry(value => value + 1)}>Retry loading tasks</button></div>}
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <button type="button" className={button} disabled={locked} onClick={() => { setConfirmReset(false); timer.start(); }}>Start</button>
        <button type="button" className={button} disabled={!timer.running} onClick={() => { setConfirmReset(false); timer.stop(); }}>Stop</button>
        <button type="button" className={button} disabled={timer.saving} onClick={reset}>Reset</button>
      </div>
      {confirmReset && <div className="space-y-2"><p role="alert">Reset and discard this unsaved session?</p><button type="button" className={button} onClick={reset}>Discard session</button> <button type="button" className={button} onClick={() => setConfirmReset(false)}>Keep session</button></div>}
      {timer.completed && <p role="status">Countdown complete! Your study time is up.</p>}
      {timer.saving && <p role="status">Saving study session...</p>}
      {timer.message && <p role={timer.saveError ? "alert" : "status"}>{timer.message}</p>}
      {timer.pending && !timer.saving && <div className="space-y-2"><p className="text-sm text-muted">Your stopped session is kept here while you navigate. Retry saving, or reset to discard it and start another session.</p><button type="button" className={button} onClick={timer.save}>Retry save</button></div>}
    </section>
  </div>;
}
