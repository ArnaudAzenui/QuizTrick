"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, errorMessage } from "@frontend/lib/api-client";
import { reviewAnswer } from "@frontend/components/quiz/QuizResults";
import type { AttemptReview, HistoryEntry } from "@shared/types";
import { formatDateTime, formatElapsed, formatScore } from "@shared/utils/format";
import { ROUTES } from "@shared/constants";

type Load<T> = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; data: T };
const buttonClass = "rounded-xl border border-border px-4 py-2 text-sm font-medium hover:border-primary";

export function IncorrectAnswers({ review }: { review: AttemptReview }) {
  const incorrect = review.items.filter(item => !item.isCorrect)
    .sort((a, b) => a.question.position - b.question.position);

  if (incorrect.length === 0) return <p className="text-sm">Perfect score! You got every question right.</p>;
  return <div className="space-y-3">
    <h3 className="font-semibold">Questions to review ({incorrect.length})</h3>
    <ol className="space-y-3" aria-label="Incorrect answers">
      {incorrect.map(({ question, response }) => (
        <li key={question.questionId} className="rounded-xl border border-border p-4">
          <p className="text-sm font-medium">Question {question.position} - Incorrect</p>
          <h4 className="mt-2 whitespace-pre-wrap font-medium">{question.text}</h4>
          <dl className="mt-3 space-y-2 break-words text-sm">
            <div><dt className="font-semibold">Your answer</dt><dd className="whitespace-pre-wrap">{reviewAnswer(question, response)}</dd></div>
            <div><dt className="font-semibold">Correct answer</dt><dd className="whitespace-pre-wrap">{question.type === "mcq" ? reviewAnswer(question, String(question.correctOption)) : question.expectedAnswer}</dd></div>
          </dl>
        </li>
      ))}
    </ol>
  </div>;
}

function AttemptDetails({ entry }: { entry: HistoryEntry }) {
  const [load, setLoad] = useState<Load<AttemptReview>>({ state: "loading" });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoad({ state: "loading" });
    void api.get<AttemptReview>("/api/attempts/" + encodeURIComponent(entry.attemptId)).then(data => {
      if (!active) return;
      if (data.attempt.attemptId !== entry.attemptId || data.attempt.quizId !== entry.quizId) {
        setLoad({ state: "error", message: "These results do not match this attempt." });
      } else setLoad({ state: "ready", data });
    }).catch(err => { if (active) setLoad({ state: "error", message: errorMessage(err) }); });
    return () => { active = false; };
  }, [entry.attemptId, entry.quizId, retry]);

  if (load.state === "loading") return <p role="status" className="text-sm">Loading answers...</p>;
  if (load.state === "error") return <div className="space-y-3"><p role="alert">{load.message}</p><button type="button" className={buttonClass} onClick={() => setRetry(value => value + 1)}>Retry answers</button></div>;
  return <div className="space-y-4">
    <IncorrectAnswers review={load.data} />
    <Link className="inline-block text-sm text-primary underline" href={ROUTES.results(entry.quizId, entry.attemptId)}>View all answers</Link>
  </div>;
}

export function HistoryAttempt({ entry }: { entry: HistoryEntry }) {
  const [expanded, setExpanded] = useState(false);
  const [opened, setOpened] = useState(false);
  const [date, setDate] = useState(entry.submittedAt);
  const panelId = "attempt-" + entry.attemptId;
  useEffect(() => { setDate(formatDateTime(entry.submittedAt)); }, [entry.submittedAt]);

  return <li className="overflow-hidden rounded-2xl border border-border bg-surface">
    <h2>
      <button type="button" aria-expanded={expanded} aria-controls={panelId}
        onClick={() => { setExpanded(value => !value); setOpened(true); }}
        className="flex w-full flex-wrap items-center justify-between gap-3 p-5 text-left hover:bg-primary/5">
        <span className="space-y-1">
          <span className="block font-semibold">{entry.quizTitle ?? "Practice quiz"}</span>
          <time dateTime={entry.submittedAt} className="block text-sm font-normal text-muted">{date}</time>
          <span className="block text-sm font-normal text-muted">Quiz study time: {entry.durationSeconds == null ? "Unavailable" : formatElapsed(entry.durationSeconds)}</span>
        </span>
        <span className="flex items-center gap-3">
          {entry.isBest && <span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">Best score</span>}
          <span className="text-xl font-semibold">{formatScore(entry.score)}</span>
          <span className="text-sm font-normal">{expanded ? "Hide" : "Review"}</span>
        </span>
      </button>
    </h2>
    <div id={panelId} hidden={!expanded} className="border-t border-border p-5">
      {opened && <AttemptDetails entry={entry} />}
    </div>
  </li>;
}

export function ScoreHistory() {
  const [load, setLoad] = useState<Load<HistoryEntry[]>>({ state: "loading" });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoad({ state: "loading" });
    void api.get<HistoryEntry[]>("/api/history").then(data => {
      if (active) setLoad({ state: "ready", data });
    }).catch(err => { if (active) setLoad({ state: "error", message: errorMessage(err) }); });
    return () => { active = false; };
  }, [retry]);

  return <div className="space-y-6">
    <header><h1 className="text-2xl font-semibold">Score history</h1></header>
    {load.state === "loading" && <p role="status">Loading score history...</p>}
    {load.state === "error" && <div className="space-y-3"><p role="alert">{load.message}</p><button type="button" className={buttonClass} onClick={() => setRetry(value => value + 1)}>Try again</button></div>}
    {load.state === "ready" && (load.data.length === 0
      ? <div className="rounded-2xl border border-dashed border-border p-6"><p>No quiz attempts yet. Complete a quiz to see your score here.</p><Link className="mt-3 inline-block text-primary underline" href={ROUTES.texts}>Go to my texts</Link></div>
      : <ol className="space-y-4" aria-label="Past quiz attempts">{load.data.map(entry => <HistoryAttempt key={entry.attemptId} entry={entry} />)}</ol>)}
  </div>;
}
