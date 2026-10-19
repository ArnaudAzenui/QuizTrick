"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, errorMessage } from "@frontend/lib/api-client";
import type { AttemptReview, Question } from "@shared/types";
import { formatScore } from "@shared/utils/format";
import { ROUTES } from "@shared/constants";
import { optionLetter } from "./quiz-runner";

export function reviewAnswer(question: Question, response: string): string {
  if (!response.trim()) return "Not answered";
  if (question.type === "short_answer") return response;
  const i = Number(response);
  return /^[0-3]$/.test(response) && question.options[i] !== undefined ? optionLetter(i) + ". " + question.options[i] : "Invalid answer";
}
export function ResultsReview({ data }: { data: AttemptReview }) {
  const items = [...data.items].sort((a, b) => a.question.position - b.question.position);
  return <div className="space-y-6">
    <header className="rounded-2xl border border-border bg-surface p-6">
      <h1 className="text-2xl font-semibold">{data.quiz.title ?? "Practice quiz"} results</h1>
      <p className="mt-4 text-4xl font-semibold text-primary" aria-label="Score">{formatScore(data.attempt.score)}</p>
      <p className="mt-2 text-sm text-muted">{items.filter(item => item.isCorrect).length} of {items.length} correct</p>
    </header>
    <ol className="space-y-4" aria-label="Question review">{items.map(({ question, response, isCorrect }, index) =>
      <li key={question.questionId} className="rounded-2xl border border-border bg-surface p-5">
        <p className="text-sm font-medium">Question {index + 1} ? {isCorrect ? "Correct" : "Incorrect"}</p>
        <h2 className="mt-2 whitespace-pre-wrap text-lg font-medium">{question.text}</h2>
        {question.type === "mcq" && <ol className="mt-3 space-y-1 text-sm" aria-label="Answer options">{question.options.map((option, i) => <li key={i}>{optionLetter(i)}. {option}</li>)}</ol>}
        <dl className="mt-4 space-y-2 break-words text-sm">
          <div><dt className="font-semibold">Your answer</dt><dd className="whitespace-pre-wrap">{reviewAnswer(question, response)}</dd></div>
          <div><dt className="font-semibold">Correct answer</dt><dd className="whitespace-pre-wrap">{question.type === "mcq" ? reviewAnswer(question, String(question.correctOption)) : question.expectedAnswer}</dd></div>
        </dl>
      </li>)}</ol>
    <div className="flex flex-wrap gap-4 text-sm"><Link className="text-primary underline" href={ROUTES.history}>View score history</Link><Link className="text-primary underline" href={ROUTES.quiz(data.quiz.quizId)}>Retake quiz</Link><Link className="text-primary underline" href={ROUTES.texts}>Back to my texts</Link></div>
  </div>;
}
type Load = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; data: AttemptReview };
export function QuizResults({ quizId, attemptId }: { quizId: string; attemptId: string }) {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoad({ state: "loading" });
    void api.get<AttemptReview>("/api/attempts/" + encodeURIComponent(attemptId)).then(data => {
      if (!active) return;
      if (data.quiz.quizId !== quizId || data.attempt.quizId !== quizId) setLoad({ state: "error", message: "This attempt does not belong to this quiz." });
      else setLoad({ state: "ready", data });
    }).catch(err => { if (active) setLoad({ state: "error", message: errorMessage(err) }); });
    return () => { active = false; };
  }, [quizId, attemptId, retry]);
  if (load.state === "loading") return <p role="status">Loading your results?</p>;
  if (load.state === "error") return <div className="space-y-3"><h1 className="text-2xl font-semibold">Quiz results</h1><p role="alert">{load.message}</p><button type="button" className="rounded-xl border border-border px-4 py-2" onClick={() => setRetry(value => value + 1)}>Try again</button></div>;
  return <ResultsReview data={load.data} />;
}
