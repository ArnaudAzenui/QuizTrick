import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TaskForm } from "@frontend/components/tasks/TaskForm";
import { TaskList } from "@frontend/components/tasks/TaskList";
import { TaskManager } from "@frontend/components/tasks/TaskManager";
import { formatMinutes, sortTasks, summarizeTasks } from "@frontend/components/tasks/tasks";
import TasksPage from "@/app/(app)/tasks/page";
import { LIMITS } from "@shared/constants";
import type { StudyTask } from "@shared/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }));

function task(overrides: Partial<StudyTask>): StudyTask {
  return {
    taskId: "t-1",
    ownerId: "user-1",
    subject: "Biology",
    description: null,
    estimatedMinutes: 30,
    isComplete: false,
    createdAt: "2026-10-18T10:00:00Z",
    ...overrides,
  };
}

describe("formatMinutes", () => {
  it("shows minutes, whole hours, and hours with minutes", () => {
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(60)).toBe("1 h");
    expect(formatMinutes(90)).toBe("1 h 30 min");
    expect(formatMinutes(600)).toBe("10 h");
  });

  it("never renders NaN or a negative", () => {
    expect(formatMinutes(Number.NaN)).toBe("0 min");
    expect(formatMinutes(-5)).toBe("0 min");
  });
});

describe("summarizeTasks (FR-6.3, FR-6.6)", () => {
  it("counts done tasks and adds up the time left on the open ones only", () => {
    const summary = summarizeTasks([
      task({ taskId: "a", estimatedMinutes: 30 }),
      task({ taskId: "b", estimatedMinutes: 45, isComplete: true }),
      task({ taskId: "c", estimatedMinutes: 60 }),
    ]);
    expect(summary).toEqual({ total: 3, done: 1, remainingMinutes: 90 });
  });

  it("handles an empty list", () => {
    expect(summarizeTasks([])).toEqual({ total: 0, done: 0, remainingMinutes: 0 });
  });
});

describe("sortTasks", () => {
  it("puts open tasks first, then newest first, the way the API orders them", () => {
    const sorted = sortTasks([
      task({ taskId: "old-done", isComplete: true, createdAt: "2026-10-01T00:00:00Z" }),
      task({ taskId: "old-open", createdAt: "2026-10-02T00:00:00Z" }),
      task({ taskId: "new-done", isComplete: true, createdAt: "2026-10-18T00:00:00Z" }),
      task({ taskId: "new-open", createdAt: "2026-10-17T00:00:00Z" }),
    ]);
    expect(sorted.map((t) => t.taskId)).toEqual(["new-open", "old-open", "new-done", "old-done"]);
  });

  it("does not mutate its input", () => {
    const input = [task({ taskId: "b", isComplete: true }), task({ taskId: "a" })];
    const copy = [...input];
    sortTasks(input);
    expect(input).toEqual(copy);
  });
});

describe("TaskForm (FR-6.1, FR-6.2)", () => {
  const html = renderToStaticMarkup(<TaskForm onCreated={() => {}} />);

  it("has the three fields with the API's limits on them", () => {
    // React serialises the prop name as written (maxLength), so match case-insensitively.
    expect(html).toMatch(new RegExp(`<input[^>]*id="subject"[^>]*maxlength="${LIMITS.TASK_SUBJECT_MAX}"`, "i"));
    expect(html).toMatch(new RegExp(`<textarea[^>]*id="description"[^>]*maxlength="${LIMITS.TASK_DESCRIPTION_MAX}"`, "i"));
    expect(html).toMatch(new RegExp(`<input[^>]*id="estimatedMinutes"[^>]*type="number"[^>]*min="${LIMITS.TASK_MINUTES_MIN}"[^>]*max="${LIMITS.TASK_MINUTES_MAX}"`, "i"));
  });

  it("labels every field and starts with a sensible estimate", () => {
    for (const id of ["subject", "description", "estimatedMinutes"]) expect(html).toContain(`for="${id}"`);
    expect(html).toMatch(/<input[^>]*id="estimatedMinutes"[^>]*value="30"/);
    expect(html).toContain("Add task");
    expect(html).not.toContain('role="alert"');
  });
});

describe("TaskList (FR-6.3 - FR-6.5)", () => {
  it("renders each task with a complete checkbox and a delete button", () => {
    const html = renderToStaticMarkup(
      <TaskList tasks={[task({ taskId: "a", subject: "Read chapter 4", description: "pp. 80-95", estimatedMinutes: 90 })]} onChanged={() => {}} onDeleted={() => {}} />,
    );
    expect(html).toContain("Read chapter 4");
    expect(html).toContain("pp. 80-95");
    expect(html).toContain("1 h 30 min");
    expect(html).toMatch(/<input[^>]*id="done-a"[^>]*type="checkbox"/);
    expect(html).toContain('aria-label="Mark &quot;Read chapter 4&quot; as done"');
    expect(html).toContain('aria-label="Delete &quot;Read chapter 4&quot;"');
  });

  it("shows a completed task ticked and struck through", () => {
    const html = renderToStaticMarkup(<TaskList tasks={[task({ taskId: "b", isComplete: true })]} onChanged={() => {}} onDeleted={() => {}} />);
    expect(html).toMatch(/<input[^>]*type="checkbox"[^>]*checked=""/);
    expect(html).toContain("line-through");
    expect(html).toContain("· done");
  });

  it("renders nothing for an empty list, leaving the empty state to the parent", () => {
    expect(renderToStaticMarkup(<TaskList tasks={[]} onChanged={() => {}} onDeleted={() => {}} />)).toBe("");
  });
});

describe("tasks page", () => {
  it("replaces the placeholder with the form, the Today/All switch and a loading state", () => {
    const html = renderToStaticMarkup(<TasksPage />);
    expect(html).not.toContain("Coming soon");
    expect(html).toContain("Add task");
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("Loading your tasks");
  });

  it("manager starts on today's scope", () => {
    const html = renderToStaticMarkup(<TaskManager />);
    expect(html).toContain("Today&#x27;s tasks");
  });
});
