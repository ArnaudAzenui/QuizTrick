import { handle, ok, type RouteCtx } from "@backend/lib/api";
import { notImplemented } from "@backend/lib/not-implemented";
import { getQuizForTaking } from "@backend/services/quiz.service";

/**
 * GET /api/quizzes/:id - -> QuizForTaking (questions WITHOUT answer keys)
 * DELETE /api/quizzes/:id - -> { deleted: true }
 *
 * Full contract: docs/API.md - FR-4.1, SEC-10
 * Owner: backend (Arnaud + Isaiah). TODO: DELETE via quiz.service deleteQuiz.
 */
export const GET = handle<RouteCtx<{ id: string }>>(async (_req, { params }) => ok(await getQuizForTaking((await params).id)));

export async function DELETE() {
  return notImplemented();
}
