import { notImplemented } from "@backend/lib/not-implemented";

/**
 * GET /api/texts - -> StudyTextSummary[] (newest first)
 * POST /api/texts - { title?, body } -> StudyText (201)
 *
 * Full contract: docs/API.md - FR-2.4 - FR-2.7
 * Owner: backend (Arnaud + Isaiah). TODO: implement via src/backend/services + validation/schemas.
 */

export async function GET() {
  return notImplemented();
}

export async function POST() {
  return notImplemented();
}
