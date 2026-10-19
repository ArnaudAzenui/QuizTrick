import type { StudyTask } from "@shared/types";

/** "45 min", "1 h", "1 h 30 min". Whole minutes in, as the API stores them. */
export function formatMinutes(minutes: number): string {
  const m = Number.isFinite(minutes) ? Math.max(0, Math.round(minutes)) : 0;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${rest} min`;
  return rest === 0 ? `${h} h` : `${h} h ${rest} min`;
}

export interface TaskSummary {
  total: number;
  done: number;
  /** Estimated minutes still to do: the incomplete tasks only. */
  remainingMinutes: number;
}

/** The numbers above the list: how many are done, and how much time the rest adds up to. */
export function summarizeTasks(tasks: StudyTask[]): TaskSummary {
  let done = 0;
  let remainingMinutes = 0;
  for (const task of tasks) {
    if (task.isComplete) done += 1;
    else remainingMinutes += task.estimatedMinutes;
  }
  return { total: tasks.length, done, remainingMinutes };
}

/**
 * Where a task goes in the list after a change, matching the API's order
 * (incomplete first, then newest first) so a completed task moves down the
 * list without waiting for a refetch.
 */
export function sortTasks(tasks: StudyTask[]): StudyTask[] {
  return [...tasks].sort((a, b) => {
    if (a.isComplete !== b.isComplete) return a.isComplete ? 1 : -1;
    return b.createdAt.localeCompare(a.createdAt);
  });
}
