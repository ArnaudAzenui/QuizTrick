import { StudyTextEditor } from "@frontend/components/texts/StudyTextEditor";

/** Add study text: paste or upload a .txt file, then save (FR-2.1 - FR-2.7, WBS 1.4.2). */
export default function Page() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Add study text</h1>
      <p className="mt-2 text-sm text-muted">
        Paste your notes or upload a .txt file. After saving, you can generate a practice quiz from it.
      </p>
      <div className="mt-6">
        <StudyTextEditor />
      </div>
    </div>
  );
}
