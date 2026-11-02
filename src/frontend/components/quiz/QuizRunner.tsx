"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@frontend/lib/api-client";
import { LIMITS, ROUTES } from "@shared/constants";
import type { Attempt, QuizForTaking } from "@shared/types";
import {
  answeredPercent,
  countAnswered,
  isAnswered,
  isTypingTarget,
  leavesQuiz,
  optionLetter,
  shortcutOptionIndex,
  submitAttempt,
  type AnswerMap,
} from "./quiz-runner";

const LEAVE_MESSAGE = "Leave this quiz? Your unsubmitted answers and question flags will be lost.";

type Load = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; data: QuizForTaking };

/**
 * Take a quiz (FR-4.1, FR-4.2, WBS 1.4.4.1).
 *
 * Loads GET /api/quizzes/:id (questions arrive without answer keys), shows one
 * question at a time with Previous / Next, and keeps every answer in state keyed
 * by question id so it stays editable until Submit. Submit posts to
 * POST /api/quizzes/:id/attempts and opens /quizzes/[id]/results/[attemptId].
 * If the request fails the message is shown and the answers are kept so the
 * student can try again.
 *
 * Leaving with unsubmitted answers asks first, both for reload / closing the tab
 * (beforeunload) and for in-app links like the nav bar. Enter never submits the
 * quiz: it moves to the next question, and on the last one the student has to
 * press Submit quiz themselves.
 *
 * On a four-option multiple-choice question, pressing A, B, C or D picks that
 * answer. Shortcuts are ignored while typing in a text field or with Ctrl / Cmd /
 * Alt held. A progress bar under the title follows the "x of y answered" count.
 */
export function QuizRunner({ quizId }: { quizId: string }) {
  const router = useRouter();
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [flagged, setFlagged] = useState<Set<string>>(() => new Set());
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
      setFlagged(new Set());
      setLoad({ state: "ready", data });
    } catch (err) {
      setLoad({ state: "error", message: errorMessage(err, "We couldn't load this quiz. Please try again.") });
    }
  }, [quizId]);

  useEffect(() => {
    void fetchQuiz();
  }, [fetchQuiz]);

  const setAnswer = useCallback((questionId: string, response: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: response }));
    if (response.trim()) {
      setFlagged((previous) => {
        if (!previous.has(questionId)) return previous;
        const next = new Set(previous);
        next.delete(questionId);
        return next;
      });
    }
    setConfirming(false);
    setSubmitError(undefined);
  }, []);

  // A/B/C/D shortcuts for the question on screen (multiple choice only).
  useEffect(() => {
    if (load.state !== "ready" || submitting) return;
    const { questions } = load.data;
    const question = questions[Math.min(index, questions.length - 1)];
    if (!question) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
      if (isTypingTarget(event.target as HTMLElement | null)) return;
      const option = shortcutOptionIndex(event.key, question);
      if (option === null) return;
      event.preventDefault();
      setAnswer(question.questionId, String(option));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [load, index, submitting, setAnswer]);

  // UC-4 alternate flow: warn before leaving with unsubmitted answers.
  const hasProgress = flagged.size > 0 || Object.values(answers).some((a) => a.trim().length > 0);
  useEffect(() => {
    if (!hasProgress) return;
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
  }, [hasProgress]);

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
  const currentIsFlagged = flagged.has(current.questionId);
  const flaggedQuestions = questions
    .map((question, questionIndex) => ({ question, questionIndex }))
    .filter(({ question }) => flagged.has(question.questionId));

  function toggleFlag() {
    setFlagged(previous => {
      const next = new Set(previous);
      if (next.has(current.questionId)) next.delete(current.questionId);
      else next.add(current.questionId);
      return next;
    });
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
        <p id="quiz-progress-label" className="mt-1 text-sm text-muted">
          {answered} of {total} answered · you can change any answer until you submit
        </p>
        <div
          role="progressbar"
          aria-labelledby="quiz-progress-label"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={answered}
          aria-valuetext={`${answered} of ${total} answered`}
          className="mt-3 h-2 w-full overflow-hidden rounded-full bg-primary/15"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
            style={{ width: `${answeredPercent(answered, total)}%` }}
          />
        </div>
      </div>

      <nav aria-label="Questions" className="flex flex-wrap gap-2">
        {questions.map((q, i) => {
          const done = isAnswered(answers, q.questionId);
          const active = i === index;
          const isFlagged = flagged.has(q.questionId);
          return (
            <button
              key={q.questionId}
              type="button"
              onClick={() => goTo(i)}
              disabled={submitting}
              aria-current={active ? "step" : undefined}
              aria-label={`Question ${i + 1}${done ? ", answered" : ", not answered"}${isFlagged ? ", flagged for review" : ""}`}
              className={`relative h-9 w-9 rounded-full border text-sm font-medium ${
                active
                  ? "border-primary bg-primary text-primary-fg"
                  : done
                    ? "border-primary/60 bg-primary/10 text-fg"
                    : "border-border bg-surface text-muted hover:border-primary"
              }`}
            >
              {i + 1}
              {isFlagged && (
                <span aria-hidden="true" className="absolute -right-1 -top-2 rounded-full bg-surface p-0.5 text-primary">
                  <FlagIcon />
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {flaggedQuestions.length > 0 && (
        <section aria-labelledby="flagged-heading" className="rounded-xl border border-border bg-surface p-4">
          <h2 id="flagged-heading" className="text-sm font-semibold">
            Flagged for review ({flaggedQuestions.length})
          </h2>
          <p className="mt-1 text-sm text-muted">Select a question to return to it. Answering a question clears its flag.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {flaggedQuestions.map(({ question, questionIndex }) => (
              <button
                key={question.questionId}
                type="button"
                onClick={() => goTo(questionIndex)}
                disabled={submitting}
                aria-current={questionIndex === index ? "step" : undefined}
                className="rounded-lg border border-border px-3 py-2 text-sm hover:border-primary disabled:opacity-50"
              >
                Question {questionIndex + 1}
                {!isAnswered(answers, question.questionId) && " · unanswered"}
              </button>
            ))}
          </div>
        </section>
      )}

      <form onSubmit={onSubmit} onKeyDown={onKeyDown} className="rounded-2xl border border-border bg-surface p-5" noValidate>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          Question {index + 1} of {total} · {current.type === "mcq" ? (current.options.length === 2 ? "True or false" : "Multiple choice") : "Short answer"}
        </p>

        <button
          type="button"
          onClick={toggleFlag}
          disabled={submitting}
          aria-pressed={currentIsFlagged}
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-primary hover:border-primary disabled:opacity-50"
        >
          <FlagIcon />
          {currentIsFlagged ? "Remove flag" : "Flag for review"}
        </button>

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
                      {current.options.length === 4 && <span className="font-semibold">{optionLetter(i)}. </span>}{option}
                    </span>
                  </label>
                );
              })}
            </div>
            {current.options.length === 4 && (
              <p className="mt-3 text-xs text-muted">
                Tip: press <kbd className="rounded border border-border px-1">A</kbd>, <kbd className="rounded border border-border px-1">B</kbd>,{" "}
                <kbd className="rounded border border-border px-1">C</kbd> or <kbd className="rounded border border-border px-1">D</kbd> to pick an answer.
              </p>
            )}
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

function FlagIcon() {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 21V3h14l-3 5 3 5H5" />
    </svg>
  );
}
