import { notImplemented } from "@backend/lib/not-implemented";

/**
 * GET /api/texts/:id - -> StudyText
 * DELETE /api/texts/:id - -> { deleted: true } (cascades)
 *
 * Full contract: docs/API.md - FR-2.6, SEC-10
 * Owner: backend (Arnaud + Isaiah). TODO: implement via src/backend/services + validation/schemas.
 */

export async function GET() {
  return notImplemented();
}

export async function DELETE() {
  return notImplemented();
}
