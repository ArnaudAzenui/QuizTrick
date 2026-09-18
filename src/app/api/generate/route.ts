import { notImplemented } from "@backend/lib/not-implemented";

/**
 * POST /api/generate - { textId, questionCount?: 5|10|15 } -> Quiz (201). RATE_LIMITED after 20/hr; no partial quiz is ever stored.
 *
 * Full contract: docs/API.md - FR-3.1 - FR-3.9, SEC-6, SEC-7
 * Owner: backend (Arnaud + Isaiah). TODO: implement via src/backend/services + validation/schemas.
 */

export const maxDuration = 60; // Vercel: allow the 30 s generation ceiling (PR-2)

export async function POST() {
  return notImplemented();
}
