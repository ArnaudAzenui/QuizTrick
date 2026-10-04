import Link from "next/link";
import { TextList } from "@frontend/components/texts/TextList";
import { ROUTES } from "@shared/constants";

const QUICK_LINKS = [
  { href: ROUTES.tasks, label: "Study tasks", note: "Plan what to study today." },
  { href: ROUTES.timer, label: "Study timer", note: "Track a focused session." },
  { href: ROUTES.history, label: "Score history", note: "See how past quizzes went." },
] as const;

/**
 * Signed-in landing page (WBS 1.4 - 1.6). The study loop starts here:
 * add text, then generate a quiz from it. Tasks, timer and history are
 * linked now and get their own summaries as those features land.
 */
export default function Page() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <section className="rounded-2xl border border-border bg-surface p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Turn your notes into a practice quiz</h1>
        <p className="mt-2 text-sm text-muted">
          Paste your notes or upload a .txt file. QuizTrick saves it and writes a quiz from it.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href={ROUTES.newText} className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-fg hover:opacity-90">
            Add study text
          </Link>
          <Link href={ROUTES.texts} className="rounded-xl border border-border bg-surface px-4 py-2 text-sm font-medium hover:border-primary">
            My study texts
          </Link>
        </div>
      </section>

      <section aria-labelledby="recent-heading">
        <h2 id="recent-heading" className="text-lg font-semibold">
          Recent study texts
        </h2>
        <div className="mt-3">
          <TextList limit={3} />
        </div>
      </section>

      <section aria-labelledby="more-heading">
        <h2 id="more-heading" className="text-lg font-semibold">
          More study tools
        </h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-3">
          {QUICK_LINKS.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="block rounded-2xl border border-border bg-surface p-4 hover:border-primary">
                <span className="block font-medium">{item.label}</span>
                <span className="mt-1 block text-sm text-muted">{item.note}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
