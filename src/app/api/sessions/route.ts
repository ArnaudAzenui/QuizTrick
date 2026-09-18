import { notImplemented } from "@backend/lib/not-implemented";

/**
 * GET /api/sessions - -> StudySession[] (last 20)
 * POST /api/sessions - { taskId?, startTime, endTime, durationSeconds } -> StudySession (201)
 *
 * Full contract: docs/API.md - FR-7.4
 * Owner: backend (Arnaud + Isaiah). TODO: implement via src/backend/services + validation/schemas.
 */

export async function GET() {
  return notImplemented();
}

export async function POST() {
  return notImplemented();
}
