"use client";

import { useState, type FormEvent } from "react";
import { api, ApiClientError, errorMessage } from "@frontend/lib/api-client";
import { FormField } from "@frontend/components/FormField";
import { LIMITS } from "@shared/constants";
import type { StudyTask } from "@shared/types";

const DEFAULT_MINUTES = 30;

/**
 * Create a study task (FR-6.1, FR-6.2, WBS 1.5.1).
 *
 * The three fields mirror POST /api/tasks: subject (required), description
 * (optional), estimated minutes (whole number). The limits come from
 * @shared/constants so the maxLength / min / max on the inputs match what the
 * server checks; a server-side field error still lands under its field.
 */
export function TaskForm({ onCreated }: { onCreated: (task: StudyTask) => void }) {
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [minutes, setMinutes] = useState(String(DEFAULT_MINUTES));
  const [fields, setFields] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState(false);

  function reset() {
    setSubject("");
    setDescription("");
    setMinutes(String(DEFAULT_MINUTES));
    setFields({});
    setFormError(undefined);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setFields({});
    setFormError(undefined);

    // The same checks the API runs, so the common mistakes are caught without a round trip.
    const next: Record<string, string> = {};
    if (!subject.trim()) next.subject = "Enter a subject for the task.";
    const n = Number(minutes);
    if (!/^\d+$/.test(minutes.trim()) || n < LIMITS.TASK_MINUTES_MIN || n > LIMITS.TASK_MINUTES_MAX) {
      next.estimatedMinutes = `Estimated time must be a whole number from ${LIMITS.TASK_MINUTES_MIN} to ${LIMITS.TASK_MINUTES_MAX} minutes.`;
    }
    if (Object.keys(next).length > 0) {
      setFields(next);
      return;
    }

    setBusy(true);
    try {
      const task = await api.post<StudyTask>("/api/tasks", {
        subject: subject.trim(),
        description: description.trim() || null,
        estimatedMinutes: n,
      });
      reset();
      onCreated(task);
    } catch (err) {
      const serverFields = err instanceof ApiClientError ? err.fields : undefined;
      if (serverFields && Object.keys(serverFields).length > 0) setFields(serverFields);
      else setFormError(errorMessage(err, "We couldn't save your task. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="rounded-2xl border border-border bg-surface p-4" noValidate>
      <h2 className="text-lg font-semibold">Add a task</h2>
      <p className="mt-1 text-sm text-muted">What are you studying, and how long do you expect it to take?</p>

      <div className="mt-4 space-y-4">
        <FormField
          id="subject"
          name="subject"
          label="Subject"
          placeholder="e.g. BIO-110 Chapter 4 review"
          required
          maxLength={LIMITS.TASK_SUBJECT_MAX}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          disabled={busy}
          error={fields.subject}
        />

        <div>
          <label htmlFor="description" className="block text-sm font-medium">
            Description (optional)
          </label>
          <textarea
            id="description"
            name="description"
            rows={2}
            maxLength={LIMITS.TASK_DESCRIPTION_MAX}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={busy}
            placeholder="Pages, topics, or what 'done' looks like"
            aria-invalid={fields.description ? true : undefined}
            aria-describedby={fields.description ? "description-error description-count" : "description-count"}
            className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm focus:border-primary"
          />
          <p id="description-count" className="mt-1 text-xs text-muted">
            {description.length} / {LIMITS.TASK_DESCRIPTION_MAX} characters
          </p>
          {fields.description && (
            <p id="description-error" role="alert" className="mt-1 text-sm text-danger">
              {fields.description}
            </p>
          )}
        </div>

        <div className="max-w-xs">
          <FormField
            id="estimatedMinutes"
            name="estimatedMinutes"
            label="Estimated time (minutes)"
            type="number"
            inputMode="numeric"
            required
            min={LIMITS.TASK_MINUTES_MIN}
            max={LIMITS.TASK_MINUTES_MAX}
            step={1}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            disabled={busy}
            error={fields.estimatedMinutes}
          />
          <p className="mt-1 text-xs text-muted">
            {LIMITS.TASK_MINUTES_MIN} to {LIMITS.TASK_MINUTES_MAX} minutes.
          </p>
        </div>
      </div>

      {formError && (
        <p role="alert" className="mt-4 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {formError}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "Adding…" : "Add task"}
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={busy || (!subject && !description && minutes === String(DEFAULT_MINUTES))}
          className="rounded-xl border border-border bg-surface px-4 py-2 text-sm font-medium hover:border-primary disabled:opacity-60"
        >
          Clear
        </button>
      </div>
    </form>
  );
}
