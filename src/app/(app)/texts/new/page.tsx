import Link from "next/link";
import { ROUTES } from "@shared/constants";
import { StudyTextEditor } from "@frontend/components/texts/StudyTextEditor";

/** Add study text: paste or upload a .txt file, then save (FR-2.1 - FR-2.7, WBS 1.4.2). */
export default async function Page({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const fromTask = (await searchParams).from === "task";
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Add study text</h1>
      <p className="mt-2 text-sm text-muted">
        Paste your notes or upload a Word (.docx), PDF, PowerPoint (.pptx), or .txt file. After saving, you can generate a practice quiz from it.
      </p>
      {fromTask && (
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <p role="status">Task added. Add your study notes now, or come back later.</p>
          <Link href={ROUTES.tasks} className="rounded-xl border border-border px-4 py-2 hover:border-primary">Skip for now</Link>
        </div>
      )}
      <div className="mt-6">
        <StudyTextEditor />
      </div>
    </div>
  );
}
