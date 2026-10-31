import { handle, ok, parseBody } from "@backend/lib/api";
import { getPreference, setTheme } from "@backend/services/preference.service";
import { preferenceSchema } from "@backend/validation/schemas";

/**
 * GET /api/preferences - -> Preference
 * PUT /api/preferences - { theme: "light" | "dark" } -> Preference
 *
 * Full contract: docs/API.md - FR-8.3
 */
export const GET = handle(async () => ok(await getPreference()));

export const PUT = handle(async (req) => ok(await setTheme(await parseBody(req, preferenceSchema))));
