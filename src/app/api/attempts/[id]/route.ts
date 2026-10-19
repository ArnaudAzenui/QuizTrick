import { handle, ok, type RouteCtx } from "@backend/lib/api";
import { getAttemptReview } from "@backend/services/attempt.service";

/**
 * GET /api/attempts/:id - -> AttemptReview (with correct answers + per-question isCorrect)
 *
 * Full contract: docs/API.md - FR-4.6
 */
export const GET = handle<RouteCtx<{ id: string }>>(async (_req, { params }) => ok(await getAttemptReview((await params).id)));
