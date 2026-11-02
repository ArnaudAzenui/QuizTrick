"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiClientError, api, errorMessage } from "@frontend/lib/api-client";
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
 * their score history (docs/API.md). The same goes for deleting one quiz from
 * the list: DELETE /api/quizzes/:id takes that quiz's score history with it.
 */
export function TextDetail({ textId }: { textId: string }) {
  const router = useRouter();
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string>();
  // One quiz at a time can be in the "are you sure?" step.
  const [confirmQuizId, setConfirmQuizId] = useState<string>();
  const [deletingQuizId, setDeletingQuizId] = useState<string>();
  const [quizError, setQuizError] = useState<{ quizId: string; message: string }>();

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

  async function removeQuiz(quizId: string) {
    if (deletingQuizId) return;
    setDeletingQuizId(quizId);
    setQuizError(undefined);
    try {
      await api.delete(`/api/quizzes/${quizId}`);
    } catch (err) {
      // Already gone (deleted in another tab): treat it as deleted.
      if (!(err instanceof ApiClientError && err.code === "NOT_FOUND")) {
        setQuizError({ quizId, message: errorMessage(err, "We couldn't delete this quiz. Please try again.") });
        setDeletingQuizId(undefined);
        return;
      }
    }
    setLoad((current) =>
      current.state === "ready" ? { ...current, quizzes: current.quizzes.filter((q) => q.quizId !== quizId) } : current,
    );
    setConfirmQuizId(undefined);
    setDeletingQuizId(undefined);
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

      <section aria-labelledby="quizzes-heading">
        <h2 id="quizzes-heading" className="text-lg font-semibold">
          Quizzes from this text
        </h2>
        {quizzes.length === 0 ? (
          <p className="mt-2 rounded-2xl border border-dashed border-border p-4 text-sm text-muted">
            No quizzes from this text yet. Generate one above to start practicing.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {quizzes.map((quiz) => {
              const label = `${quiz.questionCount}-question quiz from ${formatDateTime(quiz.createdAt)}`;
              const isConfirming = confirmQuizId === quiz.quizId;
              const isDeleting = deletingQuizId === quiz.quizId;
              return (
                <li key={quiz.quizId} className="rounded-xl border border-border bg-surface px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {quiz.questionCount} questions · <time dateTime={quiz.createdAt}>{formatDateTime(quiz.createdAt)}</time>
                    </span>
                    <span className="flex items-center gap-2">
                      <Link
                        href={ROUTES.quiz(quiz.quizId)}
                        className="rounded-lg px-2 py-1 font-medium text-primary underline-offset-4 hover:underline"
                      >
                        Take quiz
                      </Link>
                      {!isConfirming && (
                        <button
                          type="button"
                          onClick={() => {
                            setQuizError(undefined);
                            setConfirmQuizId(quiz.quizId);
                          }}
                          aria-label={`Delete ${label}`}
                          className="rounded-lg border border-danger/40 px-2 py-1 font-medium text-danger hover:bg-danger/10"
                        >
                          Delete
                        </button>
                      )}
                    </span>
                  </div>
                  {isConfirming && (
                    <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border pt-3">
                      <span className="font-medium">Delete this quiz? Its score history will be deleted too.</span>
                      <button
                        type="button"
                        onClick={() => void removeQuiz(quiz.quizId)}
                        disabled={isDeleting}
                        className="rounded-xl border border-danger bg-danger/10 px-3 py-1.5 font-medium text-danger hover:bg-danger/20 disabled:opacity-60"
                      >
                        {isDeleting ? "Deleting…" : "Yes, delete quiz"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmQuizId(undefined)}
                        disabled={isDeleting}
                        className="rounded-xl border border-border bg-surface px-3 py-1.5 font-medium hover:border-primary disabled:opacity-60"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                  {quizError?.quizId === quiz.quizId && (
                    <p role="alert" className="mt-2 text-danger">
                      {quizError.message}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

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
