"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@frontend/lib/api-client";
import { LIMITS, ROUTES } from "@shared/constants";
import type { Quiz } from "@shared/types";
import { splitQuestionMix } from "@shared/utils/text";

/**
 * Generate (or regenerate) a quiz from a saved text (FR-3.1, FR-3.6 - FR-3.8, WBS 1.4.3).
 *
 * POST /api/generate can take up to 30 seconds, so a progress message with a
 * running timer shows the moment the button is pressed. On failure nothing is
 * saved server-side; the API's message is shown and the same button retries.
 */
export function GeneratePanel({ textId, hasQuizzes = false }: { textId: string; hasQuizzes?: boolean }) {
  const router = useRouter();
  const [count, setCount] = useState<number>(LIMITS.DEFAULT_QUESTION_COUNT);
  const [mix, setMix] = useState(() => ({ ...splitQuestionMix(LIMITS.DEFAULT_QUESTION_COUNT), trueFalse: 0 }));
  const selectedCount = mix.mcq + mix.trueFalse + mix.shortAnswer;
  const validMix = Object.values(mix).every(value => Number.isInteger(value) && value >= 0) && selectedCount === count;
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!busy) return;
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [busy]);

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !validMix) return;
    setError(undefined);
    setElapsed(0);
    setBusy(true);
    try {
      const quiz = await api.post<Quiz>("/api/generate", { textId, questionCount: count, questionMix: mix });
      router.push(ROUTES.quiz(quiz.quizId));
    } catch (err) {
      setError(errorMessage(err, "We couldn't generate a quiz. Please try again."));
      setBusy(false);
    }
  }


  return (
    <form onSubmit={generate} className="rounded-2xl border border-border bg-surface p-4">
      <h2 className="text-lg font-semibold">{hasQuizzes ? "Generate another quiz" : "Generate a quiz"}</h2>
      <p className="mt-1 text-sm text-muted">
        QuizTrick writes practice questions from this text. Earlier quizzes and scores are kept.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="questionCount" className="block text-sm font-medium">
            Number of questions
          </label>
          <select
            id="questionCount"
            name="questionCount"
            value={count}
            onChange={(event) => {
              const total = Number(event.target.value);
              setCount(total);
              setMix({ ...splitQuestionMix(total), trueFalse: 0 });
            }}
            disabled={busy}
            className="mt-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm focus:border-primary"
          >
            {LIMITS.QUESTION_COUNTS.map((n) => (
              <option key={n} value={n}>
                {n} questions
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={busy || !validMix}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "Generating…" : error ? "Try again" : "Generate quiz"}
        </button>
      </div>

      <fieldset disabled={busy} aria-describedby="question-mix-help" className="mt-5">
        <legend className="text-sm font-medium">Choose your question types</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          {([
            { key: "mcq", label: "Multiple choice (A–D)" },
            { key: "trueFalse", label: "True or false" },
            { key: "shortAnswer", label: "Short answer" },
          ] as const).map(({ key, label }) => (
            <div key={key}>
              <label htmlFor={"mix-" + key} className="block text-sm">{label}</label>
              <input
                id={"mix-" + key}
                type="number"
                min={0}
                max={count}
                step={1}
                value={Number.isNaN(mix[key]) ? "" : mix[key]}
                aria-invalid={!validMix}
                onChange={event => setMix(previous => ({ ...previous, [key]: event.target.valueAsNumber }))}
                className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm"
              />
            </div>
          ))}
        </div>
        <p id="question-mix-help" aria-live="polite" className="mt-2 text-sm text-muted">
          {Number.isFinite(selectedCount) ? selectedCount : 0} of {count} questions selected. Counts must add up to {count}; use 0 to leave a type out.
        </p>
      </fieldset>

      {busy && (
        <p role="status" aria-live="polite" className="mt-3 text-sm text-muted">
          Checking your study material and writing your quiz… this can take up to {LIMITS.GENERATION_TIMEOUT_MS / 1000} seconds ({elapsed}s). Please keep this page open.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
