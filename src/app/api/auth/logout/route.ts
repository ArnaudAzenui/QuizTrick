import { handle, ok } from "@backend/lib/api";
import { logoutUser } from "@backend/services/auth.service";

/**
 * POST /api/auth/logout - -> { loggedOut: true }
 *
 * Full contract: docs/API.md - FR-1.3, SEC-8
 * POST rather than GET so a prefetch or an <img> tag can't sign a user out.
 */
export const POST = handle(async () => ok(await logoutUser()));
