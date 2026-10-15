"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@frontend/lib/api-client";
import { LIMITS, ROUTES } from "@shared/constants";
import type { Attempt, QuizForTaking } from "@shared/types";
import { countAnswered, isAnswered, leavesQuiz, optionLetter, submitAttempt, type AnswerMap } from "./quiz-runner";

const LEAVE_MESSAGE = "You have answers you haven't submitted. Leave this quiz? Your answers will be lost.";

type Load = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; data: QuizForTaking };

/**
 * Take a quiz (FR-4.1, FR-4.2, WBS 1.4.4.1).
 *
 * Loads GET /api/quizzes/:id (questions arrive without answer keys), shows one
 * question at a time with Previous / Next, and keeps every answer in state keyed
 * by question id so it stays editable until Submit. Submit posts to
 * POST /api/quizzes/:id/attempts and opens /quizzes/[id]/results/[attemptId].
 * If the request fails (including "not implemented yet" before the route lands)
 * the message is shown and the answers are kept so the student can try again.
 *
 * Leaving with unsubmitted answers asks first, both for reload / closing the tab
 * (beforeunload) and for in-app links like the nav bar. Enter never submits the
 * quiz: it moves to the next question, and on the last one the student has to
 * press Submit quiz themselves.
 */
export function QuizRunner({ quizId }: { quizId: string }) {
  const router = useRouter();
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>();
  const startedAt = useRef<string>("");
  const submitted = useRef(false);

  const fetchQuiz = useCallback(async () => {
    setLoad({ state: "loading" });
    try {
      const data = await api.get<QuizForTaking>(`/api/quizzes/${quizId}`);
      startedAt.current = new Date().toISOString();
      setLoad({ state: "ready", data });
    } catch (err) {
      setLoad({ state: "error", message: errorMessage(err, "We couldn't load this quiz. Please try again.") });
    }
  }, [quizId]);

  useEffect(() => {
    void fetchQuiz();
  }, [fetchQuiz]);

  // UC-4 alternate flow: warn before leaving with unsubmitted answers.
  const hasAnswers = Object.values(answers).some((a) => a.trim().length > 0);
  useEffect(() => {
    if (!hasAnswers) return;
    const warn = (event: BeforeUnloadEvent) => {
      if (submitted.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    // In-app links (nav bar, logo, "Back to my texts") change the page without a
    // reload, so beforeunload never fires for them. Catch the click first, in the
    // capture phase, before Next's <Link> handles it.
    const guardLinks = (event: MouseEvent) => {
      if (submitted.current || event.defaultPrevented) return;
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (!(link instanceof HTMLAnchorElement)) return;
      const click = {
        href: link.href,
        target: link.getAttribute("target"),
        download: link.hasAttribute("download"),
        button: event.button,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
      };
      if (!leavesQuiz(click, window.location.href)) return;
      if (window.confirm(LEAVE_MESSAGE)) {
        submitted.current = true; // they chose to leave, so don't ask again on the way out
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", guardLinks, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", guardLinks, true);
    };
  }, [hasAnswers]);

  if (load.state === "loading") {
    return (
      <p role="status" className="text-sm text-muted">
        Loading your quiz…
      </p>
    );
  }

  if (load.state === "error") {
    return (
      <div className="space-y-3">
        <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {load.message}
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void fetchQuiz()}
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

  const { quiz, questions } = load.data;
  const total = questions.length;

  if (total === 0) {
    return (
      <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
        This quiz has no questions. Go back and generate a new one.
      </p>
    );
  }

  const current = questions[Math.min(index, total - 1)];
  const answered = countAnswered(questions, answers);
  const unanswered = total - answered;
  const isLast = index === total - 1;
  const value = answers[current.questionId] ?? "";

  function setAnswer(questionId: string, response: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: response }));
    setConfirming(false);
    setSubmitError(undefined);
  }

  function goTo(next: number) {
    setIndex(Math.max(0, Math.min(total - 1, next)));
    setConfirming(false);
  }

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(undefined);
    try {
      const resultsUrl = await submitAttempt(
        (path, body) => api.post<Attempt>(path, body),
        quizId,
        questions,
        answers,
        startedAt.current,
      );
      submitted.current = true;
      router.push(resultsUrl);
    } catch (err) {
      setSubmitError(errorMessage(err, "We couldn't submit your quiz. Your answers are still here, so please try again."));
      setSubmitting(false);
      setConfirming(false);
    }
  }

  // Enter in an answer field never submits the whole quiz. It moves on to the
  // next question; on the last one it does nothing, so submitting always takes
  // a deliberate press of Submit quiz. Enter on a focused button still clicks it.
  function onKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key !== "Enter" || !(event.target instanceof HTMLInputElement)) return;
    event.preventDefault();
    if (!isLast) goTo(index + 1);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isLast) {
      goTo(index + 1);
      return;
    }
    if (unanswered > 0 && !confirming) {
      setConfirming(true);
      return;
    }
    void submit();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{quiz.title ?? "Practice quiz"}</h1>
        <p className="mt-1 text-sm text-muted">
          {answered} of {total} answered · you can change any answer until you submit
        </p>
      </div>

      <nav aria-label="Questions" className="flex flex-wrap gap-2">
        {questions.map((q, i) => {
          const done = isAnswered(answers, q.questionId);
          const active = i === index;
          return (
            <button
              key={q.questionId}
              type="button"
              onClick={() => goTo(i)}
              disabled={submitting}
              aria-current={active ? "step" : undefined}
              aria-label={`Question ${i + 1}${done ? ", answered" : ", not answered"}`}
              className={`h-9 w-9 rounded-full border text-sm font-medium ${
                active
                  ? "border-primary bg-primary text-primary-fg"
                  : done
                    ? "border-primary/60 bg-primary/10 text-fg"
                    : "border-border bg-surface text-muted hover:border-primary"
              }`}
            >
              {i + 1}
            </button>
          );
        })}
      </nav>

      <form onSubmit={onSubmit} onKeyDown={onKeyDown} className="rounded-2xl border border-border bg-surface p-5" noValidate>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          Question {index + 1} of {total} · {current.type === "mcq" ? "Multiple choice" : "Short answer"}
        </p>

        {current.type === "mcq" ? (
          <fieldset className="mt-3">
            <legend className="text-lg font-medium">{current.text}</legend>
            <div className="mt-4 space-y-2">
              {current.options.map((option, i) => {
                const id = `${current.questionId}-${i}`;
                const checked = value === String(i);
                return (
                  <label
                    key={id}
                    htmlFor={id}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
                      checked ? "border-primary bg-primary/10" : "border-border hover:border-primary"
                    }`}
                  >
                    <input
                      id={id}
                      type="radio"
                      name={`q-${current.questionId}`}
                      value={String(i)}
                      checked={checked}
                      onChange={() => setAnswer(current.questionId, String(i))}
                      disabled={submitting}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="font-semibold">{optionLetter(i)}.</span> {option}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ) : (
          <div className="mt-3">
            <label htmlFor={`sa-${current.questionId}`} className="block text-lg font-medium">
              {current.text}
            </label>
            <input
              id={`sa-${current.questionId}`}
              type="text"
              autoComplete="off"
              maxLength={LIMITS.SHORT_ANSWER_RESPONSE_MAX}
              value={value}
              onChange={(e) => setAnswer(current.questionId, e.target.value)}
              disabled={submitting}
              placeholder="Type your answer"
              aria-describedby={`sa-${current.questionId}-count`}
              className="mt-4 w-full rounded-xl border border-border bg-surface px-3 py-2 focus:border-primary"
            />
            <p id={`sa-${current.questionId}-count`} className="mt-1 text-xs text-muted">
              {value.length} / {LIMITS.SHORT_ANSWER_RESPONSE_MAX} characters
            </p>
          </div>
        )}

        {confirming && (
          <p role="alert" className="mt-5 rounded-xl border border-warning/50 bg-warning/10 px-3 py-2 text-sm">
            {unanswered === 1
              ? "You have 1 unanswered question. It will be marked wrong. Press Submit quiz again to submit anyway, or go back and answer it."
              : `You have ${unanswered} unanswered questions. They will be marked wrong. Press Submit quiz again to submit anyway, or go back and answer them.`}
          </p>
        )}
        {submitError && (
          <p role="alert" className="mt-5 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            {submitError}
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            disabled={index === 0 || submitting}
            className="rounded-xl border border-border bg-surface px-4 py-2 text-sm font-medium hover:border-primary disabled:opacity-50"
          >
            Previous
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-primary px-5 py-2 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-60"
          >
            {isLast ? (submitting ? "Submitting…" : "Submit quiz") : "Next"}
          </button>
        </div>
      </form>
    </div>
  );
}
