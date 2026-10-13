import { QuizRunner } from "@frontend/components/quiz/QuizRunner";

/** Take a quiz: one question at a time, answers editable until submit (FR-4.1, FR-4.2, WBS 1.4.4.1). */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-2xl">
      <QuizRunner quizId={id} />
    </div>
  );
}
