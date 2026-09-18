import { notImplemented } from "@backend/lib/not-implemented";

/**
 * GET /api/tasks - ?scope=today|all -> StudyTask[]
 * POST /api/tasks - { subject, description?, estimatedMinutes } -> StudyTask (201)
 *
 * Full contract: docs/API.md - FR-6.1 - FR-6.3
 * Owner: backend (Arnaud + Isaiah). TODO: implement via src/backend/services + validation/schemas.
 */

export async function GET() {
  return notImplemented();
}

export async function POST() {
  return notImplemented();
}
