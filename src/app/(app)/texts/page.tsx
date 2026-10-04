import Link from "next/link";
import { TextList } from "@frontend/components/texts/TextList";
import { ROUTES } from "@shared/constants";

/** My study texts: saved texts, newest first (FR-2.6, WBS 1.4.2). */
export default function Page() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">My study texts</h1>
        <Link href={ROUTES.newText} className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-fg hover:opacity-90">
          Add study text
        </Link>
      </div>
      <p className="mt-2 text-sm text-muted">Open a text to generate a quiz from it.</p>
      <div className="mt-6">
        <TextList />
      </div>
    </div>
  );
}
