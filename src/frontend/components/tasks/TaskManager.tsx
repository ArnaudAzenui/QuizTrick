"use client";

import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "@frontend/lib/api-client";
import type { StudyTask } from "@shared/types";
import { TaskForm } from "./TaskForm";
import { TaskList } from "./TaskList";
import { formatMinutes, sortTasks, summarizeTasks } from "./tasks";

type Scope = "today" | "all";
type Load = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; tasks: StudyTask[] };

/**
 * Study tasks screen (FR-6.1 - FR-6.6, WBS 1.5.1).
 *
 * "Today" is the API's default scope: everything created today plus every
 * task still open, however old, so nothing unfinished drops off the list.
 * "All" adds the completed history. After a create, toggle or delete the
 * local array is updated in place and re-sorted the way the API sorts, so the
 * screen doesn't refetch and flicker for every click.
 */
export function TaskManager() {
  const [scope, setScope] = useState<Scope>("today");
  const [load, setLoad] = useState<Load>({ state: "loading" });

  const fetchTasks = useCallback(async (which: Scope) => {
    setLoad({ state: "loading" });
    try {
      setLoad({ state: "ready", tasks: await api.get<StudyTask[]>(`/api/tasks?scope=${which}`) });
    } catch (err) {
      setLoad({ state: "error", message: errorMessage(err, "We couldn't load your tasks. Please try again.") });
    }
  }, []);

  useEffect(() => {
    void fetchTasks(scope);
  }, [fetchTasks, scope]);

  function update(fn: (tasks: StudyTask[]) => StudyTask[]) {
    setLoad((prev) => (prev.state === "ready" ? { state: "ready", tasks: sortTasks(fn(prev.tasks)) } : prev));
  }

  const onCreated = (task: StudyTask) => update((tasks) => [task, ...tasks]);
  const onChanged = (task: StudyTask) => update((tasks) => tasks.map((t) => (t.taskId === task.taskId ? task : t)));
  const onDeleted = (taskId: string) => update((tasks) => tasks.filter((t) => t.taskId !== taskId));

  return (
    <div className="space-y-6">
      <TaskForm onCreated={onCreated} />

      <section aria-labelledby="task-list-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="task-list-heading" className="text-lg font-semibold">
            {scope === "today" ? "Today's tasks" : "All tasks"}
          </h2>
          <div role="group" aria-label="Which tasks to show" className="flex rounded-xl border border-border bg-surface p-0.5 text-sm">
            {(["today", "all"] as const).map((which) => (
              <button
                key={which}
                type="button"
                onClick={() => setScope(which)}
                aria-pressed={scope === which}
                className={`rounded-lg px-3 py-1.5 font-medium ${scope === which ? "bg-primary text-primary-fg" : "text-muted hover:text-fg"}`}
              >
                {which === "today" ? "Today" : "All"}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          {load.state === "loading" && (
            <p role="status" className="text-sm text-muted">
              Loading your tasks…
            </p>
          )}

          {load.state === "error" && (
            <div className="space-y-3">
              <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
                {load.message}
              </p>
              <button
                type="button"
                onClick={() => void fetchTasks(scope)}
                className="rounded-xl border border-border bg-surface px-4 py-2 text-sm font-medium hover:border-primary"
              >
                Try again
              </button>
            </div>
          )}

          {load.state === "ready" && <Summary tasks={load.tasks} scope={scope} />}

          {load.state === "ready" && load.tasks.length === 0 && (
            <div className="mt-3 rounded-2xl border border-dashed border-border p-6 text-center">
              <p className="font-medium">{scope === "today" ? "Nothing on the list for today" : "No tasks yet"}</p>
              <p className="mt-1 text-sm text-muted">
                {scope === "today" ? "Add a task above, or switch to All to see finished ones." : "Add your first study task above."}
              </p>
            </div>
          )}

          {load.state === "ready" && (
            <div className="mt-3">
              <TaskList tasks={load.tasks} onChanged={onChanged} onDeleted={onDeleted} />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Summary({ tasks, scope }: { tasks: StudyTask[]; scope: Scope }) {
  if (tasks.length === 0) return null;
  const { total, done, remainingMinutes } = summarizeTasks(tasks);
  const open = total - done;
  return (
    <p className="text-sm text-muted" aria-live="polite">
      {done} of {total} done
      {open > 0 && ` · about ${formatMinutes(remainingMinutes)} of study left`}
      {scope === "today" && open === 0 && " · all caught up"}
    </p>
  );
}
