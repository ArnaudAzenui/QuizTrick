import { QuizResults } from "@frontend/components/quiz/QuizResults";
export default async function Page({ params }: { params: Promise<{ id: string; attemptId: string }> }) {
  const { id, attemptId } = await params;
  return <div className="mx-auto max-w-2xl"><QuizResults key={attemptId} quizId={id} attemptId={attemptId} /></div>;
}
