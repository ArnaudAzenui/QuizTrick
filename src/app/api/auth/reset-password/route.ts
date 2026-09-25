import { handle, ok, parseBody } from "@backend/lib/api";
import { requestPasswordReset } from "@backend/services/auth.service";
import { resetPasswordSchema } from "@backend/validation/schemas";

/**
 * POST /api/auth/reset-password - { email } -> { sent: true } (always)
 *
 * Full contract: docs/API.md - FR-1.7
 * "Always" is the point: a different answer for a registered address would turn
 * this into a way to discover who has an account.
 */
export const POST = handle(async (req) => ok(await requestPasswordReset(await parseBody(req, resetPasswordSchema))));
