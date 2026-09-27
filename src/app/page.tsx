import Link from "next/link";
import { ROUTES } from "@shared/constants";

/**
 * Public landing page (skeleton). TODO(frontend): design pass per the Figma
 * wireframes (WBS 1.2.3); redirect signed-in users to the dashboard once
 * auth.service exists.
 */
export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-4">
        <span className="text-[22px] font-semibold">QuizTrick</span>
        <Link href={ROUTES.login} className="text-sm text-primary underline-offset-2 hover:underline">
          Log in
        </Link>
      </header>
      <main className="mx-auto flex max-w-2xl flex-1 flex-col items-center justify-center px-6 text-center">
        <h1 className="text-4xl font-semibold tracking-tight">From your notes to a practice quiz in under a minute.</h1>
        <p className="mt-4 text-lg text-muted">
          Paste or upload your study text. QuizTrick writes multiple-choice and short-answer questions from it, grades you
          instantly, and keeps your tasks and study timer in the same place.
        </p>
        <div className="mt-8 flex gap-3">
          <Link href={ROUTES.register} className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-fg">
            Create a free account
          </Link>
          <Link href={ROUTES.login} className="rounded-xl border border-border px-4 py-2 text-sm font-medium">
            Log in
          </Link>
        </div>
        <p className="mt-10 text-xs text-muted">
          QuizTrick is a self-study practice tool, not a graded assessment platform. Quizzes are AI-generated and may contain
          errors.
        </p>
      </main>
    </div>
  );
}
