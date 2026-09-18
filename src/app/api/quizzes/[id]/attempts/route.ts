import { notImplemented } from "@backend/lib/not-implemented";

/**
 * POST /api/quizzes/:id/attempts - { startedAt?, answers: [{ questionId, response }] } -> Attempt (201, atomic)
 *
 * Full contract: docs/API.md - FR-4.3 - FR-4.5, NFR-R3
 * Owner: backend (Arnaud + Isaiah). TODO: implement via src/backend/services + validation/schemas.
 */

export async function POST() {
  return notImplemented();
}
