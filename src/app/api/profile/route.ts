import { handle, ok, parseBody } from "@backend/lib/api";
import { getProfile, updateDisplayName } from "@backend/services/profile.service";
import { profileUpdateSchema } from "@backend/validation/schemas";

/**
 * GET /api/profile - -> UserProfile
 * PATCH /api/profile - { displayName } -> UserProfile
 *
 * Full contract: docs/API.md - FR-1.6
 */
export const GET = handle(async () => ok(await getProfile()));

export const PATCH = handle(async (req) => ok(await updateDisplayName(await parseBody(req, profileUpdateSchema))));
