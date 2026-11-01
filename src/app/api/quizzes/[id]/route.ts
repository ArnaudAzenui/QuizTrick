import { handle, ok, type RouteCtx } from "@backend/lib/api";
import { deleteQuiz, getQuizForTaking } from "@backend/services/quiz.service";

/**
 * GET /api/quizzes/:id - -> QuizForTaking (questions WITHOUT answer keys)
 * DELETE /api/quizzes/:id - -> { deleted: true } (cascades to questions and attempts)
 *
 * Full contract: docs/API.md - FR-4.1, SEC-10
 */
export const GET = handle<RouteCtx<{ id: string }>>(async (_req, { params }) => ok(await getQuizForTaking((await params).id)));

export const DELETE = handle<RouteCtx<{ id: string }>>(async (_req, { params }) => ok(await deleteQuiz((await params).id)));
