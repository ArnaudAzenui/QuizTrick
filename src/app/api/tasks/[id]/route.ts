import { notImplemented } from "@backend/lib/not-implemented";

/**
 * PATCH /api/tasks/:id - partial task -> StudyTask
 * DELETE /api/tasks/:id - -> { deleted: true }
 *
 * Full contract: docs/API.md - FR-6.4, FR-6.5
 * Owner: backend (Arnaud + Isaiah). TODO: implement via src/backend/services + validation/schemas.
 */

export async function PATCH() {
  return notImplemented();
}

export async function DELETE() {
  return notImplemented();
}
