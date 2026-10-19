import { TaskManager } from "@frontend/components/tasks/TaskManager";

/** Study tasks: add, today's list, mark complete, delete (FR-6.1 - FR-6.6, WBS 1.5.1). */
export default function Page() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Study tasks</h1>
      <p className="mt-2 text-sm text-muted">Plan what to study and how long it should take. Unfinished tasks stay on today&apos;s list until you tick them off.</p>
      <div className="mt-6">
        <TaskManager />
      </div>
    </div>
  );
}
