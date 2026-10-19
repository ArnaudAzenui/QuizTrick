import { handle, ok, parseBody, type RouteCtx } from "@backend/lib/api";
import { submitAttempt } from "@backend/services/attempt.service";
import { submitAttemptSchema } from "@backend/validation/schemas";

/**
 * POST /api/quizzes/:id/attempts - { startedAt?, answers: [{ questionId, response }] } -> Attempt (201, atomic)
 *
 * Full contract: docs/API.md - FR-4.3 - FR-4.5, NFR-R3
 */
export const POST = handle<RouteCtx<{ id: string }>>(async (req, { params }) =>
  ok(await submitAttempt((await params).id, await parseBody(req, submitAttemptSchema)), 201),
);
