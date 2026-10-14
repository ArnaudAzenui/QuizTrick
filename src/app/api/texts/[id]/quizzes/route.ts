import { handle, ok, type RouteCtx } from "@backend/lib/api";
import { listQuizzesForText } from "@backend/services/quiz.service";

/**
 * GET /api/texts/:id/quizzes - -> Quiz[] newest first
 *
 * Full contract: docs/API.md - FR-3.7
 */
export const GET = handle<RouteCtx<{ id: string }>>(async (_req, { params }) =>
  ok(await listQuizzesForText((await params).id)),
);
