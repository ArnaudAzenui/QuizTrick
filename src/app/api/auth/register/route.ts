import { notImplemented } from "@backend/lib/not-implemented";

/**
 * POST /api/auth/register - { email, password, displayName? } -> { userId, needsEmailConfirmation } (201)
 *
 * Full contract: docs/API.md - FR-1.1, FR-1.2
 * Owner: backend (Arnaud + Isaiah). TODO: implement via src/backend/services + validation/schemas.
 */

export async function POST() {
  return notImplemented();
}
