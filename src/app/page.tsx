import Link from "next/link";
import { ThemeToggle } from "@frontend/components/ThemeToggle";
import { ROUTES } from "@shared/constants";

const steps = [
  {
    number: "01",
    title: "Bring your notes",
    detail: "Paste study text or upload a .txt file. Keep your materials together in your own library.",
  },
  {
    number: "02",
    title: "Practice what you know",
    detail: "Generate multiple-choice and short-answer questions, then review your answers and score.",
  },
  {
    number: "03",
    title: "Build your study rhythm",
    detail: "Plan tasks, time focused sessions, and return to your score history to see your progress.",
  },
];

const tools = [
  {
    title: "Practice with purpose",
    body: "Multiple-choice and short-answer questions based on your own study text.",
  },
  {
    title: "Learn from each attempt",
    body: "Instant results and saved score history help you decide what to review next.",
  },
  {
    title: "Make time to focus",
    body: "Study tasks and a built-in timer help turn your plan into a focused session.",
  },
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-surface focus:p-4">Skip to content</a>
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-8">
          <Link href={ROUTES.home} className="text-2xl font-semibold tracking-tight">QuizTrick<span className="text-primary">.</span>
          </Link>
          <nav aria-label="Account navigation" className="flex items-center gap-4">
            <ThemeToggle account={false} />
            <Link href={ROUTES.login} className="text-sm font-medium text-primary hover:underline">Log in</Link>
          </nav>
        </div>
      </header>
      <main id="main-content" className="mx-auto w-full max-w-6xl flex-1 px-4 py-12 sm:px-8 lg:py-20">
        <section className="grid items-center gap-10 lg:grid-cols-[1.2fr_1fr] lg:gap-16" aria-labelledby="hero-heading">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">A little practice. A clearer picture.</p>
            <h1 id="hero-heading" className="mt-5 max-w-2xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Your notes.<br />Your next breakthrough.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
              Turn your study notes into practice quizzes. Find what needs another look, track your progress,
              and make room for focused study.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={ROUTES.register} className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-fg hover:underline">Create a free account</Link>
              <Link href={ROUTES.login} className="rounded-xl border border-border bg-surface px-5 py-3 text-sm font-semibold hover:border-primary">Log in to study</Link>
            </div>
            <p className="mt-4 text-sm text-muted">
              Your texts, quizzes, tasks, and timer. One study space.
            </p>
          </div>
          <aside aria-label="Example study workflow" className="rounded-3xl border border-border bg-surface p-6 shadow-sm sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted">A study session, simplified</p>
            <h2 className="mt-4 text-2xl font-semibold">Start with what you&apos;re learning.</h2>
            <ol className="mt-6 space-y-5">
            {steps.map((step) => (
              <li key={step.number} className="flex gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-fg">{step.number}</span>
                <div>
                  <h3 className="font-semibold">{step.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{step.detail}</p>
                </div>
              </li>
            ))}
            </ol>
            <p className="mt-6 border-t border-border pt-5 text-sm text-muted">
              Practice at your pace. Come back whenever you&apos;re ready.
            </p>
          </aside>
        </section>
        <section aria-labelledby="tools-heading" className="mt-16 border-t border-border pt-8">
          <h2 id="tools-heading" className="text-xl font-semibold">Keep the whole study loop connected</h2>
          <div className="mt-5 grid gap-5 md:grid-cols-3">
          {tools.map((tool) => (
            <article key={tool.title} className="rounded-2xl border border-border bg-surface p-5">
              <h3 className="font-semibold">{tool.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{tool.body}</p>
            </article>
          ))}
          </div>
        </section>
      </main>
      <footer className="border-t border-border px-4 py-6">
        <p className="mx-auto max-w-6xl text-sm leading-relaxed text-muted">
          QuizTrick is a self-study practice tool. AI-generated quizzes may contain errors; check answers
          against your course materials.
        </p>
      </footer>
    </div>
  );
}
