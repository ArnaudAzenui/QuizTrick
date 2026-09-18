import { notImplemented } from "@backend/lib/not-implemented";

/**
 * GET /api/quizzes/:id - -> QuizForTaking (questions WITHOUT answer keys)
 * DELETE /api/quizzes/:id - -> { deleted: true }
 *
 * Full contract: docs/API.md - FR-4.1, SEC-10
 * Owner: backend (Arnaud + Isaiah). TODO: implement via src/backend/services + validation/schemas.
 */

export async function GET() {
  return notImplemented();
}

export async function DELETE() {
  return notImplemented();
}
