"use client";

import { useState } from "react";
import { api, errorMessage } from "@frontend/lib/api-client";
import type { StudyTask } from "@shared/types";
import { formatDateTime } from "@shared/utils/format";
import { formatMinutes } from "./tasks";

interface TaskListProps {
  tasks: StudyTask[];
  onChanged: (task: StudyTask) => void;
  onDeleted: (taskId: string) => void;
}

/**
 * The task list with its per-row actions (FR-6.3 - FR-6.5, WBS 1.5.1).
 *
 * Mark complete is a checkbox that PATCHes isComplete; delete asks once,
 * inline, before DELETE. Each row keeps its own busy flag and error so one
 * failing request doesn't lock the whole list. The parent owns the array and
 * is told about each change, so the list and the summary stay in step.
 */
export function TaskList({ tasks, onChanged, onDeleted }: TaskListProps) {
  if (tasks.length === 0) return null;
  return (
    <ul className="space-y-3">
      {tasks.map((task) => (
        <TaskRow key={task.taskId} task={task} onChanged={onChanged} onDeleted={onDeleted} />
      ))}
    </ul>
  );
}

function TaskRow({ task, onChanged, onDeleted }: { task: StudyTask } & Pick<TaskListProps, "onChanged" | "onDeleted">) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();

  async function toggleComplete() {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      onChanged(await api.patch<StudyTask>(`/api/tasks/${task.taskId}`, { isComplete: !task.isComplete }));
    } catch (err) {
      setError(errorMessage(err, "We couldn't update that task. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      await api.delete(`/api/tasks/${task.taskId}`);
      onDeleted(task.taskId);
    } catch (err) {
      setError(errorMessage(err, "We couldn't delete that task. Please try again."));
      setBusy(false);
      setConfirming(false);
    }
  }

  const checkboxId = `done-${task.taskId}`;
  return (
    <li className={`rounded-2xl border border-border bg-surface p-4 ${task.isComplete ? "opacity-75" : ""}`}>
      <div className="flex items-start gap-3">
        <input
          id={checkboxId}
          type="checkbox"
          checked={task.isComplete}
          onChange={() => void toggleComplete()}
          disabled={busy}
          aria-label={task.isComplete ? `Mark "${task.subject}" as not done` : `Mark "${task.subject}" as done`}
          className="mt-1 h-5 w-5 shrink-0 accent-primary"
        />
        <div className="min-w-0 flex-1">
          <label htmlFor={checkboxId} className={`block cursor-pointer font-medium ${task.isComplete ? "line-through text-muted" : ""}`}>
            {task.subject}
          </label>
          {task.description && <p className="mt-1 whitespace-pre-line text-sm text-muted">{task.description}</p>}
          <p className="mt-1 text-xs text-muted">
            {formatMinutes(task.estimatedMinutes)} · added <time dateTime={task.createdAt}>{formatDateTime(task.createdAt)}</time>
            {task.isComplete && " · done"}
          </p>
        </div>
        {!confirming && (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={busy}
            aria-label={`Delete "${task.subject}"`}
            className="shrink-0 rounded-xl border border-border bg-surface px-3 py-1.5 text-sm text-muted hover:border-danger hover:text-danger disabled:opacity-60"
          >
            Delete
          </button>
        )}
      </div>

      {confirming && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium">Delete this task?</span>
          <button
            type="button"
            onClick={() => void remove()}
            disabled={busy}
            className="rounded-xl border border-danger bg-danger/10 px-4 py-2 text-sm font-medium text-danger hover:bg-danger/20 disabled:opacity-60"
          >
            {busy ? "Deleting…" : "Yes, delete"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={busy}
            className="rounded-xl border border-border bg-surface px-4 py-2 text-sm font-medium hover:border-primary disabled:opacity-60"
          >
            Keep it
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
    </li>
  );
}
