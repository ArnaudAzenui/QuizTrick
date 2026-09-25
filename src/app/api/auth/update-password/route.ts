import { handle, ok, parseBody } from "@backend/lib/api";
import { updatePassword } from "@backend/services/auth.service";
import { updatePasswordSchema } from "@backend/validation/schemas";

/**
 * POST /api/auth/update-password - { password } -> { updated: true }
 *
 * Full contract: docs/API.md - FR-1.7
 * Authenticated by the session /auth/callback established from the reset link.
 */
export const POST = handle(async (req) => ok(await updatePassword(await parseBody(req, updatePasswordSchema))));
