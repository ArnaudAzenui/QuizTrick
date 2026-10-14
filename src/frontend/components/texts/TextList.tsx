"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, errorMessage } from "@frontend/lib/api-client";
import { ROUTES } from "@shared/constants";
import type { StudyTextSummary } from "@shared/types";
import { formatDateTime } from "@shared/utils/format";

type Load = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; texts: StudyTextSummary[] };

/**
 * The signed-in student's saved study texts, newest first (FR-2.6, WBS 1.4.2).
 * GET /api/texts already returns them in that order with a quiz count each.
 * `limit` shows only the first few (used on the dashboard).
 */
export function TextList({ limit }: { limit?: number }) {
  const [load, setLoad] = useState<Load>({ state: "loading" });

  const fetchTexts = useCallback(async () => {
    setLoad({ state: "loading" });
    try {
      setLoad({ state: "ready", texts: await api.get<StudyTextSummary[]>("/api/texts") });
    } catch (err) {
      setLoad({ state: "error", message: errorMessage(err, "We couldn't load your study texts. Please try again.") });
    }
  }, []);

  useEffect(() => {
    void fetchTexts();
  }, [fetchTexts]);

  if (load.state === "loading") {
    return (
      <p role="status" className="text-sm text-muted">
        Loading your study texts…
      </p>
    );
  }

  if (load.state === "error") {
    return (
      <div className="space-y-3">
        <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {load.message}
        </p>
        <button
          type="button"
          onClick={() => void fetchTexts()}
          className="rounded-xl border border-border bg-surface px-4 py-2 text-sm font-medium hover:border-primary"
        >
          Try again
        </button>
      </div>
    );
  }

  if (load.texts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-6 text-center">
        <p className="font-medium">No study texts yet</p>
        <p className="mt-1 text-sm text-muted">Add your notes and QuizTrick will turn them into a practice quiz.</p>
        <Link
          href={ROUTES.newText}
          className="mt-4 inline-block rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-fg hover:opacity-90"
        >
          Add study text
        </Link>
      </div>
    );
  }

  const shown = limit ? load.texts.slice(0, limit) : load.texts;

  return (
    <div>
      <ul className="space-y-3">
        {shown.map((text) => (
          <li key={text.textId}>
            <Link
              href={ROUTES.text(text.textId)}
              className="block rounded-2xl border border-border bg-surface p-4 hover:border-primary"
            >
              <span className="block font-medium">{text.title ?? "Untitled text"}</span>
              <span className="mt-1 block text-sm text-muted">
                {text.charCount.toLocaleString()} characters · {text.quizCount} {text.quizCount === 1 ? "quiz" : "quizzes"} ·{" "}
                <time dateTime={text.createdAt}>{formatDateTime(text.createdAt)}</time>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {limit && load.texts.length > limit && (
        <Link href={ROUTES.texts} className="mt-3 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline">
          See all {load.texts.length} texts
        </Link>
      )}
    </div>
  );
}
