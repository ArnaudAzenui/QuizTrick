import { handle, ok, parseBody } from "@backend/lib/api";
import { createText, listTexts } from "@backend/services/text.service";
import { createTextSchema } from "@backend/validation/schemas";

/**
 * GET /api/texts - -> StudyTextSummary[] (newest first)
 * POST /api/texts - { title?, body } -> StudyText (201)
 *
 * Full contract: docs/API.md - FR-2.4 - FR-2.7
 */
export const GET = handle(async () => ok(await listTexts()));

export const POST = handle(async (req) => ok(await createText(await parseBody(req, createTextSchema)), 201));
