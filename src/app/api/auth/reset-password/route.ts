import { notImplemented } from "@backend/lib/not-implemented";

/**
 * POST /api/auth/reset-password - { email } -> { sent: true } (always)
 *
 * Full contract: docs/API.md - FR-1.7
 * Owner: backend (Arnaud + Isaiah). TODO: implement via src/backend/services + validation/schemas.
 */

export async function POST() {
  return notImplemented();
}
