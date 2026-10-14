"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@frontend/lib/api-client";
import { GeneratePanel } from "@frontend/components/quiz/GeneratePanel";
import { ROUTES } from "@shared/constants";
import type { Quiz, StudyText } from "@shared/types";
import { formatDateTime } from "@shared/utils/format";

type Load =
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "ready"; text: StudyText; quizzes: Quiz[] };

/**
 * One saved study text: read it, generate a quiz from it, open earlier
 * quizzes, or delete it (FR-2.6, FR-3.1, FR-3.7, SEC-10; WBS 1.4.2 - 1.4.3).
 *
 * Deleting asks first, because the API also removes this text's quizzes and
 * their score history (docs/API.md).
 */
export function TextDetail({ textId }: { textId: string }) {
  const router = useRouter();
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string>();

  const fetchText = useCallback(async () => {
    setLoad({ state: "loading" });
    try {
      const [text, quizzes] = await Promise.all([
        api.get<StudyText>(`/api/texts/${textId}`),
        api.get<Quiz[]>(`/api/texts/${textId}/quizzes`),
      ]);
      setLoad({ state: "ready", text, quizzes });
    } catch (err) {
      setLoad({ state: "error", message: errorMessage(err, "We couldn't load this study text. Please try again.") });
    }
  }, [textId]);

  useEffect(() => {
    void fetchText();
  }, [fetchText]);

  async function remove() {
    if (deleting) return;
    setDeleting(true);
    setDeleteError(undefined);
    try {
      await api.delete(`/api/texts/${textId}`);
      router.replace(ROUTES.texts);
      router.refresh();
    } catch (err) {
      setDeleteError(errorMessage(err, "We couldn't delete this text. Please try again."));
      setDeleting(false);
    }
  }

  if (load.state === "loading") {
    return (
      <p role="status" className="text-sm text-muted">
        Loading study text…
      </p>
    );
  }

  if (load.state === "error") {
    return (
      <div className="space-y-3">
        <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {load.message}
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => void fetchText()}
            className="rounded-xl border border-border bg-surface px-4 py-2 text-sm font-medium hover:border-primary"
          >
            Try again
          </button>
          <Link href={ROUTES.texts} className="px-2 py-2 text-sm text-muted underline-offset-4 hover:text-fg hover:underline">
            Back to my texts
          </Link>
        </div>
      </div>
    );
  }

  const { text, quizzes } = load;

  return (
    <div className="space-y-6">
      <div>
        <Link href={ROUTES.texts} className="text-sm text-muted underline-offset-4 hover:text-fg hover:underline">
          ← My study texts
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{text.title ?? "Untitled text"}</h1>
        <p className="mt-1 text-sm text-muted">
          {text.charCount.toLocaleString()} characters · saved <time dateTime={text.createdAt}>{formatDateTime(text.createdAt)}</time>
        </p>
      </div>

      <GeneratePanel textId={text.textId} hasQuizzes={quizzes.length > 0} />

      {quizzes.length > 0 && (
        <section aria-labelledby="quizzes-heading">
          <h2 id="quizzes-heading" className="text-lg font-semibold">
            Quizzes from this text
          </h2>
          <ul className="mt-3 space-y-2">
            {quizzes.map((quiz) => (
              <li key={quiz.quizId}>
                <Link
                  href={ROUTES.quiz(quiz.quizId)}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm hover:border-primary"
                >
                  <span>
                    {quiz.questionCount} questions · <time dateTime={quiz.createdAt}>{formatDateTime(quiz.createdAt)}</time>
                  </span>
                  <span className="font-medium text-primary">Take quiz</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="body-heading">
        <h2 id="body-heading" className="text-lg font-semibold">
          Your text
        </h2>
        <div
          tabIndex={0}
          className="mt-3 max-h-96 overflow-y-auto whitespace-pre-wrap break-words rounded-2xl border border-border bg-surface p-4 text-sm"
        >
          {text.body}
        </div>
      </section>

      <section aria-labelledby="delete-heading" className="border-t border-border pt-6">
        <h2 id="delete-heading" className="text-lg font-semibold">
          Delete this text
        </h2>
        <p className="mt-1 text-sm text-muted">
          This also deletes its quizzes and their scores. A saved text can&apos;t be edited, so to change it, add a new one.
        </p>
        {deleteError && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {deleteError}
          </p>
        )}
        {confirming ? (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium">Delete this text, its quizzes and scores?</span>
            <button
              type="button"
              onClick={() => void remove()}
              disabled={deleting}
              className="rounded-xl border border-danger bg-danger/10 px-4 py-2 text-sm font-medium text-danger hover:bg-danger/20 disabled:opacity-60"
            >
              {deleting ? "Deleting…" : "Yes, delete"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={deleting}
              className="rounded-xl border border-border bg-surface px-4 py-2 text-sm font-medium hover:border-primary disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="mt-3 rounded-xl border border-danger/50 px-4 py-2 text-sm font-medium text-danger hover:bg-danger/10"
          >
            Delete text
          </button>
        )}
      </section>
    </div>
  );
}
