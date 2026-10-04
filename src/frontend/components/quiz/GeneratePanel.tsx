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
    if (busy) return;
    setError(undefined);
    setElapsed(0);
    setBusy(true);
    try {
      const quiz = await api.post<Quiz>("/api/generate", { textId, questionCount: count });
      router.push(ROUTES.quiz(quiz.quizId));
    } catch (err) {
      setError(errorMessage(err, "We couldn't generate a quiz. Please try again."));
      setBusy(false);
    }
  }

  const mix = splitQuestionMix(count);

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
            onChange={(e) => setCount(Number(e.target.value))}
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
          disabled={busy}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "Generating…" : error ? "Try again" : "Generate quiz"}
        </button>
      </div>

      <p className="mt-2 text-xs text-muted">
        {mix.mcq} multiple choice and {mix.shortAnswer} short answer.
      </p>

      {busy && (
        <p role="status" aria-live="polite" className="mt-3 text-sm text-muted">
          Writing your quiz… this can take up to {LIMITS.GENERATION_TIMEOUT_MS / 1000} seconds ({elapsed}s). Please keep this page open.
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
