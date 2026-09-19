import Link from "next/link";
import { ROUTES } from "@shared/constants";

/**
 * Temporary stand-in rendered by every unbuilt screen so the skeleton runs
 * end to end from day one. Replace the page that renders it with the real
 * feature, then delete this component when nothing imports it any more.
 *
 * Visitors (Vercel, previews) only ever see a neutral "coming soon" card.
 * The build note, spec references and owner are TEAM notes and render only
 * under `npm run dev` — never put names or internal IDs on the public site.
 */
export function Placeholder({ title, note, refs, owner }: { title: string; note: string; refs: string; owner: string }) {
  const showDevNotes = process.env.NODE_ENV === "development";

  return (
    <div className="mx-auto max-w-xl">
      <section className="rounded-2xl border border-border bg-surface px-8 py-10 text-center">
        <span aria-hidden="true" className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z" />
            <path d="M19 15l.8 1.9 1.9.8-1.9.8L19 20.5l-.8-1.9-1.9-.8 1.9-.8z" />
          </svg>
        </span>
        <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-primary">Coming soon</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mx-auto mt-3 max-w-sm text-muted">
          We&apos;re still building this part of QuizTrick. It&apos;ll be here shortly — thanks for your patience.
        </p>
        <div className="mt-7 flex justify-center">
          <Link href={ROUTES.home} className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-fg hover:opacity-90">
            Back to home
          </Link>
        </div>
      </section>

      {showDevNotes && (
        <details open className="mt-4 rounded-xl border border-dashed border-border px-4 py-3 text-sm">
          <summary className="cursor-pointer font-medium text-muted">Dev notes — hidden in production</summary>
          <p className="mt-2 text-fg">{note}</p>
          <dl className="mt-3 space-y-1 text-muted">
            <div className="flex gap-2">
              <dt className="font-medium text-fg">Spec:</dt>
              <dd>{refs}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-medium text-fg">Owner:</dt>
              <dd>{owner}</dd>
            </div>
          </dl>
        </details>
      )}
    </div>
  );
}
