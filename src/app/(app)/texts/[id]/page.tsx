import { TextDetail } from "@frontend/components/texts/TextDetail";

/** One saved text: view it and generate a quiz from it (FR-3.1 - FR-3.9, WBS 1.4.3). */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-3xl">
      <TextDetail textId={id} />
    </div>
  );
}
