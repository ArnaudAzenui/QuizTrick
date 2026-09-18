/**
 * Temporary stand-in rendered by every unbuilt screen so the skeleton runs
 * end to end from day one. Replace the page that renders it with the real
 * feature, then delete this component when nothing imports it any more.
 */
export function Placeholder({ title, note, refs, owner }: { title: string; note: string; refs: string; owner: string }) {
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-border bg-surface p-8">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">Not built yet</p>
      <h1 className="mt-1 text-2xl font-semibold">{title}</h1>
      <p className="mt-3 text-muted">{note}</p>
      <dl className="mt-6 space-y-1 text-sm text-muted">
        <div className="flex gap-2">
          <dt className="font-medium text-fg">Spec:</dt>
          <dd>{refs}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-medium text-fg">Owner:</dt>
          <dd>{owner}</dd>
        </div>
      </dl>
    </div>
  );
}
