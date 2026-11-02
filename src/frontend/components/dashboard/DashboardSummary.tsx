"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@frontend/lib/api-client";
import type { HistoryEntry, StudySession, StudyTask } from "@shared/types";
import { ROUTES } from "@shared/constants";
import { formatDateTime, formatElapsed, formatScore } from "@shared/utils/format";

type Summary = {
  value: string;
  detail: string;
  href?: string;
};

type SummaryCardProps<T> = {
  title: string;
  endpoint: string;
  href: string;
  linkLabel: string;
  summarize: (rows: T[]) => Summary;
};

type LoadState =
  | { state: "loading" }
  | { state: "error" }
  | { state: "ready"; summary: Summary };

export function taskSummary(tasks: StudyTask[]): Summary {
  const remaining = tasks.filter(task => !task.isComplete).length;
  const completed = tasks.length - remaining;

  return {
    value: remaining + " remaining",
    detail: tasks.length
      ? completed + " of " + tasks.length + " complete · includes unfinished tasks"
      : "A clear day. Add a task to plan your next session.",
  };
}

export function sessionSummary(sessions: StudySession[]): Summary {
  const finished = sessions.filter(session => session.endTime !== null);
  const latest = finished.sort((a, b) => Date.parse(b.endTime!) - Date.parse(a.endTime!))[0];

  if (!latest) {
    return {
      value: "No sessions yet",
      detail: "Start the study timer to record your first session.",
    };
  }

  return {
    value: formatElapsed(latest.durationSeconds),
    detail: "Finished " + formatDateTime(latest.endTime!),
  };
}

export function scoreSummary(history: HistoryEntry[]): Summary {
  const latest = [...history].sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt))[0];

  if (!latest) {
    return {
      value: "No scores yet",
      detail: "Complete a practice quiz to see your progress.",
    };
  }

  return {
    value: formatScore(latest.score),
    detail: (latest.quizTitle ?? "Practice quiz") + " · " + formatDateTime(latest.submittedAt),
    href: ROUTES.results(latest.quizId, latest.attemptId),
  };
}

function SummaryCard<T>({ title, endpoint, href, linkLabel, summarize }: SummaryCardProps<T>) {
  const [load, setLoad] = useState<LoadState>({ state: "loading" });
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setLoad({ state: "loading" });

    async function fetchSummary() {
      try {
        const rows = await api.get<T[]>(endpoint);
        if (active) setLoad({ state: "ready", summary: summarize(rows) });
      } catch {
        if (active) setLoad({ state: "error" });
      }
    }

    void fetchSummary();
    return () => { active = false; };
  }, [endpoint, summarize, retry]);

  const summary = load.state === "ready" ? load.summary : undefined;

  return (
    <article className="flex min-w-0 flex-col rounded-2xl border border-border bg-surface p-5">
      <h3 className="text-sm font-medium text-muted">{title}</h3>

      {load.state === "loading" && (
        <p role="status" className="mt-3 text-sm text-muted">Loading summary…</p>
      )}

      {load.state === "error" && (
        <div className="mt-3 space-y-2">
          <p role="alert" className="text-sm">Couldn&apos;t load this summary.</p>
          <button
            type="button"
            className="text-sm text-primary underline"
            onClick={() => setRetry(value => value + 1)}
          >
            Try again
          </button>
        </div>
      )}

      {summary && (
        <>
          <p className="mt-3 text-2xl font-semibold tracking-tight">{summary.value}</p>
          <p className="mt-2 text-sm text-muted">{summary.detail}</p>
        </>
      )}

      <Link
        className="mt-auto pt-4 text-sm font-medium text-primary underline underline-offset-4"
        href={summary?.href ?? href}
      >
        {summary?.href ? "Review latest quiz" : linkLabel}
      </Link>
    </article>
  );
}

export function DashboardSummary() {
  return (
    <section aria-labelledby="summary-heading">
      <h2 id="summary-heading" className="text-lg font-semibold">Your study snapshot</h2>
      <div className="mt-3 grid gap-4 md:grid-cols-3">
        <SummaryCard
          title="Today's tasks"
          endpoint="/api/tasks?scope=today"
          href={ROUTES.tasks}
          linkLabel="View today's tasks"
          summarize={taskSummary}
        />
        <SummaryCard
          title="Last session"
          endpoint="/api/sessions"
          href={ROUTES.timer}
          linkLabel="View last session"
          summarize={sessionSummary}
        />
        <SummaryCard
          title="Latest score"
          endpoint="/api/history"
          href={ROUTES.history}
          linkLabel="View latest score"
          summarize={scoreSummary}
        />
      </div>
    </section>
  );
}
